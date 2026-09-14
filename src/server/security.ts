/**
 * Code4Ever — server side security primitives.
 *
 * Everything in this module is shared by the Express routes in `server.ts`:
 *  - SSRF-safe outbound fetch (scheme/host allow-listing + private address blocking)
 *  - Supabase session verification (bearer token -> user + profile)
 *  - HMAC helpers for signed OAuth state and inbound webhooks
 *  - A sliding-window rate limiter that does not leak memory
 */

import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import type { Request, Response, NextFunction } from 'express';

// -------------------------------------------------------------
// ENVIRONMENT
// -------------------------------------------------------------

export function env(name: string, fallback = ''): string {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export const SUPABASE_URL = env('SUPABASE_URL', env('VITE_SUPABASE_URL')).replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY', env('VITE_SUPABASE_ANON_KEY'));
export const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Secret used to sign OAuth state values. A random per-process secret is generated when the
 * variable is missing so the flow still works locally (sessions simply do not survive a restart).
 */
export const OAUTH_STATE_SECRET = env('OAUTH_STATE_SECRET') || crypto.randomBytes(32).toString('hex');

// -------------------------------------------------------------
// CONSTANT TIME COMPARISON / HMAC
// -------------------------------------------------------------

export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Creates a tamper proof, time limited state token for the GitHub OAuth round trip. */
export function createSignedState(ttlMs = 10 * 60 * 1000): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + ttlMs;
  const payload = `${nonce}.${expiresAt}`;
  return `${payload}.${hmacHex(OAUTH_STATE_SECRET, payload)}`;
}

export function verifySignedState(state?: string | null): boolean {
  if (!state || typeof state !== 'string') return false;
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [nonce, expiresAt, signature] = parts;
  if (!/^[a-f0-9]{32}$/.test(nonce)) return false;
  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  return safeEquals(signature, hmacHex(OAUTH_STATE_SECRET, `${nonce}.${expiresAt}`));
}

// -------------------------------------------------------------
// HTML ESCAPING (for the OAuth bridge page)
// -------------------------------------------------------------

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Serializes a value for embedding inside an inline <script> block.
 * `</script>` sequences and unicode line separators inside the JSON would otherwise break
 * out of the script element and turn any attacker controlled field into stored XSS.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// -------------------------------------------------------------
// SSRF-SAFE OUTBOUND REQUESTS
// -------------------------------------------------------------

const PRIVATE_IPV4_PATTERNS: Array<(parts: number[]) => boolean> = [
  (p) => p[0] === 0,
  (p) => p[0] === 10,
  (p) => p[0] === 127,
  (p) => p[0] === 169 && p[1] === 254, // link-local + cloud metadata (169.254.169.254)
  (p) => p[0] === 172 && p[1] >= 16 && p[1] <= 31,
  (p) => p[0] === 192 && p[1] === 168,
  (p) => p[0] === 192 && p[1] === 0 && p[2] === 0,
  (p) => p[0] === 100 && p[1] >= 64 && p[1] <= 127, // CGNAT
  (p) => p[0] >= 224 // multicast + reserved
];

export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const parts = address.split('.').map(Number);
    return PRIVATE_IPV4_PATTERNS.some((test) => test(parts));
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // IPv4-mapped addresses such as ::ffff:169.254.169.254
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

export interface OutboundUrlOptions {
  /** Exact hostnames (or *.suffix entries) the URL is allowed to point at. */
  allowedHosts?: string[];
  /** Allow plain http:// (never for user supplied destinations). */
  allowInsecure?: boolean;
}

export function hostMatches(hostname: string, allowed: string): boolean {
  const host = hostname.toLowerCase();
  const pattern = allowed.toLowerCase().trim();
  if (!pattern) return false;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".example.com"
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === pattern;
}

/**
 * Validates a user supplied URL before the server is allowed to call it.
 * Rejects non-https schemes, credentials in the URL, non-allow-listed hosts, and any host
 * that resolves to a private / loopback / link-local address (SSRF into the internal network
 * or the cloud metadata service).
 */
export async function assertSafeOutboundUrl(rawUrl: string, options: OutboundUrlOptions = {}): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('Geçersiz URL biçimi.');
  }

  const allowedProtocols = options.allowInsecure ? ['https:', 'http:'] : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error('Yalnızca https:// adresleri desteklenir.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL içinde kimlik bilgisi taşınamaz.');
  }

  if (options.allowedHosts && options.allowedHosts.length > 0) {
    const permitted = options.allowedHosts.some((allowed) => hostMatches(parsed.hostname, allowed));
    if (!permitted) {
      throw new Error(`İzin verilmeyen hedef alan adı: ${parsed.hostname}`);
    }
  }

  if (net.isIP(parsed.hostname)) {
    if (isPrivateAddress(parsed.hostname)) {
      throw new Error('Özel/iç ağ adreslerine istek gönderilemez.');
    }
    return parsed;
  }

  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error(`Alan adı çözümlenemedi: ${parsed.hostname}`);
  }

  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error('Özel/iç ağ adreslerine istek gönderilemez.');
  }

  return parsed;
}

export interface SafeFetchOptions extends OutboundUrlOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Hard cap on the response body we are willing to read back. */
  maxResponseBytes?: number;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const url = await assertSafeOutboundUrl(rawUrl, options);
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxResponseBytes = options.maxResponseBytes ?? 64 * 1024;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
      // Never follow redirects automatically: a 302 to http://169.254.169.254 would
      // otherwise bypass every check performed above.
      redirect: 'manual'
    });

    const raw = await response.text().catch(() => '');
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: raw.slice(0, maxResponseBytes)
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Hedef sunucu ${Math.round(timeoutMs / 1000)} saniye içinde yanıt vermedi.`);
    }
    throw new Error(err?.message || 'Bağlantı hatası.');
  } finally {
    clearTimeout(timeout);
  }
}

// -------------------------------------------------------------
// RATE LIMITING (sliding window, self cleaning)
// -------------------------------------------------------------

interface RateLimitBucket {
  hits: number[];
  lastSeen: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const MAX_TRACKED_KEYS = 20000;

function pruneRateLimitBuckets(now: number, windowMs: number): void {
  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.lastSeen > windowMs * 4) {
      rateLimitBuckets.delete(key);
    }
  }
  // Hard cap so a flood of unique keys can never exhaust memory.
  if (rateLimitBuckets.size > MAX_TRACKED_KEYS) {
    const excess = rateLimitBuckets.size - MAX_TRACKED_KEYS;
    let removed = 0;
    for (const key of rateLimitBuckets.keys()) {
      rateLimitBuckets.delete(key);
      if (++removed >= excess) break;
    }
  }
}

let lastPrune = Date.now();

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  /** Distinguishes independent limits (e.g. "everychat" vs "webhook"). */
  scope?: string;
  /** Adds the authenticated user id to the key when available. */
  perUser?: boolean;
}

export function clientIp(req: Request): string {
  // `req.ip` already honours the `trust proxy` setting. The raw X-Forwarded-For header is
  // attacker controlled when the app is not behind a proxy, so it is only a last resort.
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60000;
  const max = options.max ?? 60;
  const scope = options.scope ?? 'global';

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastPrune > windowMs) {
      pruneRateLimitBuckets(now, windowMs);
      lastPrune = now;
    }

    const identity = options.perUser && req.auth?.userId ? `u:${req.auth.userId}` : `ip:${clientIp(req)}`;
    const key = `${scope}|${identity}`;
    const bucket = rateLimitBuckets.get(key) || { hits: [], lastSeen: now };
    bucket.hits = bucket.hits.filter((timestamp) => now - timestamp < windowMs);
    bucket.lastSeen = now;

    if (bucket.hits.length >= max) {
      rateLimitBuckets.set(key, bucket);
      const retryAfter = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please wait ${Math.max(1, retryAfter)} seconds.`
      });
      return;
    }

    bucket.hits.push(now);
    rateLimitBuckets.set(key, bucket);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.hits.length)));
    next();
  };
}

// -------------------------------------------------------------
// SUPABASE SESSION VERIFICATION
// -------------------------------------------------------------

export interface AuthContext {
  userId: string;
  email?: string;
  username?: string;
  isAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

interface CachedSession {
  context: AuthContext;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const SESSION_CACHE_TTL_MS = 30000;

function bearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : '';
}

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Uses the Supabase service role key when present so privileged reads bypass RLS safely. */
function supabaseAdminHeaders(): Record<string, string> | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

export async function fetchSupabaseProfile(userId: string): Promise<{ username?: string; is_admin?: boolean } | null> {
  const headers = supabaseAdminHeaders();
  if (!headers) return null;
  try {
    const response = await safeFetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=username,is_admin`,
      { headers, timeoutMs: 8000 }
    );
    if (!response.ok) return null;
    const rows = JSON.parse(response.text || '[]');
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

async function verifySupabaseToken(token: string): Promise<AuthContext | null> {
  if (!supabaseConfigured() || !token) return null;

  const cacheKey = crypto.createHash('sha256').update(token).digest('hex');
  const cached = sessionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  try {
    const response = await safeFetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      },
      timeoutMs: 8000
    });
    if (!response.ok) return null;

    const user = JSON.parse(response.text || '{}');
    if (!user?.id) return null;

    const profile = await fetchSupabaseProfile(user.id);
    const context: AuthContext = {
      userId: String(user.id),
      email: user.email ? String(user.email) : undefined,
      username: profile?.username ? String(profile.username) : undefined,
      isAdmin: profile?.is_admin === true
    };

    if (sessionCache.size > 5000) sessionCache.clear();
    sessionCache.set(cacheKey, { context, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
    return context;
  } catch {
    return null;
  }
}

/** Populates `req.auth` when a valid session token is present, but never rejects. */
export async function attachOptionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = bearerToken(req);
  if (token) {
    const context = await verifySupabaseToken(token);
    if (context) req.auth = context;
  }
  next();
}

/** Rejects the request unless a valid Supabase session is attached. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!supabaseConfigured()) {
    res.status(503).json({
      success: false,
      error: 'auth_unavailable',
      message: 'Kimlik doğrulama servisi yapılandırılmamış (SUPABASE_URL / SUPABASE_ANON_KEY).'
    });
    return;
  }

  const token = bearerToken(req);
  const context = token ? await verifySupabaseToken(token) : null;
  if (!context) {
    res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Bu işlem için geçerli bir oturum gereklidir.'
    });
    return;
  }

  req.auth = context;
  next();
}

/**
 * Administrator gate. Accepts either a Supabase session whose profile carries `is_admin`,
 * or a static `X-Admin-Token` shared secret for server-to-server maintenance scripts.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminToken = env('ADMIN_API_TOKEN');
  const presented = String(req.headers['x-admin-token'] || '');
  if (adminToken && presented && safeEquals(presented, adminToken)) {
    req.auth = { userId: 'service-account', isAdmin: true };
    next();
    return;
  }

  const token = bearerToken(req);
  const context = token ? await verifySupabaseToken(token) : null;
  if (!context || !context.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'forbidden',
      message: 'Bu işlem yalnızca yöneticiler tarafından gerçekleştirilebilir.'
    });
    return;
  }

  req.auth = context;
  next();
}

// -------------------------------------------------------------
// INPUT NORMALISATION
// -------------------------------------------------------------

export function asString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, maxLength);
}

export function normalizeUsername(value: unknown): string {
  return asString(value, 40)
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '');
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
