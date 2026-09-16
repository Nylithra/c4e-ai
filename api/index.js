/* OLUSTURULMUS DOSYA - ELLE DUZENLEMEYIN. Kaynak: src/server/vercelEntry.ts. Yeniden uretmek icin: npm run build:fn */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/vercelEntry.ts
var vercelEntry_exports = {};
__export(vercelEntry_exports, {
  default: () => handler
});
module.exports = __toCommonJS(vercelEntry_exports);

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_node_crypto3 = __toESM(require("node:crypto"), 1);

// src/server/security.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_promises = __toESM(require("node:dns/promises"), 1);
var import_node_net = __toESM(require("node:net"), 1);
function env(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function isServerless() {
  return Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.FUNCTION_TARGET
  );
}
var SUPABASE_URL = env("SUPABASE_URL", env("VITE_SUPABASE_URL")).replace(/\/+$/, "");
var SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY", env("VITE_SUPABASE_ANON_KEY"));
var SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
var OAUTH_STATE_SECRET = env("OAUTH_STATE_SECRET") || import_node_crypto.default.randomBytes(32).toString("hex");
function safeEquals(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return import_node_crypto.default.timingSafeEqual(bufA, bufB);
}
function hmacHex(secret, payload) {
  return import_node_crypto.default.createHmac("sha256", secret).update(payload).digest("hex");
}
function createSignedState(ttlMs = 10 * 60 * 1e3) {
  const nonce = import_node_crypto.default.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + ttlMs;
  const payload = `${nonce}.${expiresAt}`;
  return `${payload}.${hmacHex(OAUTH_STATE_SECRET, payload)}`;
}
function verifySignedState(state) {
  if (!state || typeof state !== "string") return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expiresAt, signature] = parts;
  if (!/^[a-f0-9]{32}$/.test(nonce)) return false;
  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  return safeEquals(signature, hmacHex(OAUTH_STATE_SECRET, `${nonce}.${expiresAt}`));
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function jsonForScript(value) {
  return JSON.stringify(value ?? null).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
var PRIVATE_IPV4_PATTERNS = [
  (p) => p[0] === 0,
  (p) => p[0] === 10,
  (p) => p[0] === 127,
  (p) => p[0] === 169 && p[1] === 254,
  // link-local + cloud metadata (169.254.169.254)
  (p) => p[0] === 172 && p[1] >= 16 && p[1] <= 31,
  (p) => p[0] === 192 && p[1] === 168,
  (p) => p[0] === 192 && p[1] === 0 && p[2] === 0,
  (p) => p[0] === 100 && p[1] >= 64 && p[1] <= 127,
  // CGNAT
  (p) => p[0] >= 224
  // multicast + reserved
];
function isPrivateAddress(address) {
  const version = import_node_net.default.isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    return PRIVATE_IPV4_PATTERNS.some((test) => test(parts));
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}
function hostMatches(hostname, allowed) {
  const host = hostname.toLowerCase();
  const pattern = allowed.toLowerCase().trim();
  if (!pattern) return false;
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === pattern;
}
async function assertSafeOutboundUrl(rawUrl, options = {}) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("Ge\xE7ersiz URL bi\xE7imi.");
  }
  const allowedProtocols = options.allowInsecure ? ["https:", "http:"] : ["https:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error("Yaln\u0131zca https:// adresleri desteklenir.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL i\xE7inde kimlik bilgisi ta\u015F\u0131namaz.");
  }
  if (options.allowedHosts && options.allowedHosts.length > 0) {
    const permitted = options.allowedHosts.some((allowed) => hostMatches(parsed.hostname, allowed));
    if (!permitted) {
      throw new Error(`\u0130zin verilmeyen hedef alan ad\u0131: ${parsed.hostname}`);
    }
  }
  if (import_node_net.default.isIP(parsed.hostname)) {
    if (isPrivateAddress(parsed.hostname)) {
      throw new Error("\xD6zel/i\xE7 a\u011F adreslerine istek g\xF6nderilemez.");
    }
    return parsed;
  }
  let records;
  try {
    records = await import_promises.default.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error(`Alan ad\u0131 \xE7\xF6z\xFCmlenemedi: ${parsed.hostname}`);
  }
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("\xD6zel/i\xE7 a\u011F adreslerine istek g\xF6nderilemez.");
  }
  return parsed;
}
async function safeFetch(rawUrl, options = {}) {
  const url = await assertSafeOutboundUrl(rawUrl, options);
  const timeoutMs = options.timeoutMs ?? 1e4;
  const maxResponseBytes = options.maxResponseBytes ?? 64 * 1024;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
      // Never follow redirects automatically: a 302 to http://169.254.169.254 would
      // otherwise bypass every check performed above.
      redirect: "manual"
    });
    const raw = await response.text().catch(() => "");
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: raw.slice(0, maxResponseBytes)
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Hedef sunucu ${Math.round(timeoutMs / 1e3)} saniye i\xE7inde yan\u0131t vermedi.`);
    }
    throw new Error(err?.message || "Ba\u011Flant\u0131 hatas\u0131.");
  } finally {
    clearTimeout(timeout);
  }
}
var rateLimitBuckets = /* @__PURE__ */ new Map();
var MAX_TRACKED_KEYS = 2e4;
function pruneRateLimitBuckets(now, windowMs) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.lastSeen > windowMs * 4) {
      rateLimitBuckets.delete(key);
    }
  }
  if (rateLimitBuckets.size > MAX_TRACKED_KEYS) {
    const excess = rateLimitBuckets.size - MAX_TRACKED_KEYS;
    let removed = 0;
    for (const key of rateLimitBuckets.keys()) {
      rateLimitBuckets.delete(key);
      if (++removed >= excess) break;
    }
  }
}
var lastPrune = Date.now();
function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}
function rateLimit(options = {}) {
  const windowMs = options.windowMs ?? 6e4;
  const max = options.max ?? 60;
  const scope = options.scope ?? "global";
  return (req, res, next) => {
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
      const retryAfter = Math.ceil((windowMs - (now - bucket.hits[0])) / 1e3);
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("Retry-After", String(Math.max(1, retryAfter)));
      res.status(429).json({
        success: false,
        error: "Too Many Requests",
        message: `Rate limit exceeded. Please wait ${Math.max(1, retryAfter)} seconds.`
      });
      return;
    }
    bucket.hits.push(now);
    rateLimitBuckets.set(key, bucket);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.hits.length)));
    next();
  };
}
var sessionCache = /* @__PURE__ */ new Map();
var SESSION_CACHE_TTL_MS = 3e4;
function bearerToken(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : "";
}
function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
function supabaseAdminHeaders() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}
async function fetchSupabaseProfile(userId) {
  const headers = supabaseAdminHeaders();
  if (!headers) return null;
  try {
    const response = await safeFetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=username,is_admin`,
      { headers, timeoutMs: 8e3 }
    );
    if (!response.ok) return null;
    const rows = JSON.parse(response.text || "[]");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}
async function verifySupabaseToken(token) {
  if (!supabaseConfigured() || !token) return null;
  const cacheKey = import_node_crypto.default.createHash("sha256").update(token).digest("hex");
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
      timeoutMs: 8e3
    });
    if (!response.ok) return null;
    const user = JSON.parse(response.text || "{}");
    if (!user?.id) return null;
    const profile = await fetchSupabaseProfile(user.id);
    const context = {
      userId: String(user.id),
      email: user.email ? String(user.email) : void 0,
      username: profile?.username ? String(profile.username) : void 0,
      isAdmin: profile?.is_admin === true
    };
    if (sessionCache.size > 5e3) sessionCache.clear();
    sessionCache.set(cacheKey, { context, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
    return context;
  } catch {
    return null;
  }
}
async function attachOptionalAuth(req, _res, next) {
  const token = bearerToken(req);
  if (token) {
    const context = await verifySupabaseToken(token);
    if (context) req.auth = context;
  }
  next();
}
async function requireAuth(req, res, next) {
  if (!supabaseConfigured()) {
    res.status(503).json({
      success: false,
      error: "auth_unavailable",
      message: "Kimlik do\u011Frulama servisi yap\u0131land\u0131r\u0131lmam\u0131\u015F (SUPABASE_URL / SUPABASE_ANON_KEY)."
    });
    return;
  }
  const token = bearerToken(req);
  const context = token ? await verifySupabaseToken(token) : null;
  if (!context) {
    res.status(401).json({
      success: false,
      error: "unauthorized",
      message: "Bu i\u015Flem i\xE7in ge\xE7erli bir oturum gereklidir."
    });
    return;
  }
  req.auth = context;
  next();
}
async function requireAdmin(req, res, next) {
  const adminToken = env("ADMIN_API_TOKEN");
  const presented = String(req.headers["x-admin-token"] || "");
  if (adminToken && presented && safeEquals(presented, adminToken)) {
    req.auth = { userId: "service-account", isAdmin: true };
    next();
    return;
  }
  const token = bearerToken(req);
  const context = token ? await verifySupabaseToken(token) : null;
  if (!context || !context.isAdmin) {
    res.status(403).json({
      success: false,
      error: "forbidden",
      message: "Bu i\u015Flem yaln\u0131zca y\xF6neticiler taraf\u0131ndan ger\xE7ekle\u015Ftirilebilir."
    });
    return;
  }
  req.auth = context;
  next();
}
function asString(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}
function normalizeUsername(value) {
  return asString(value, 40).replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_.-]/g, "");
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/server/communityApi.ts
var import_node_crypto2 = __toESM(require("node:crypto"), 1);
var API_KEY_PREFIX = "lnx_live_";
function toPublicKey(row) {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    created_at: row.created_at,
    created_by_username: row.created_by_username,
    last_used_at: row.last_used_at,
    request_count: Number(row.request_count || 0),
    revoked_at: row.revoked_at
  };
}
function serviceRoleConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}
function adminHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}
function hashApiKey(plaintext) {
  return import_node_crypto2.default.createHash("sha256").update(plaintext, "utf8").digest("hex");
}
function generateApiKey() {
  const secret = import_node_crypto2.default.randomBytes(32).toString("base64url");
  const plaintext = `${API_KEY_PREFIX}${secret}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    // Enough to recognise a key in a list, far too little to reconstruct it.
    prefix: plaintext.slice(0, 16)
  };
}
async function restRequest(pathAndQuery, init = {}) {
  const response = await safeFetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: init.method || "GET",
    headers: adminHeaders(init.headers),
    body: init.body,
    timeoutMs: 1e4,
    maxResponseBytes: 1024 * 1024
  });
  let rows = [];
  if (response.text) {
    try {
      const parsed = JSON.parse(response.text);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      rows = [];
    }
  }
  return { ok: response.ok, status: response.status, rows };
}
async function findCommunityByHandle(handle) {
  const clean = handle.replace(/^@/, "").toLowerCase();
  if (!clean) return null;
  const { ok, rows } = await restRequest(
    `communities?handle=in.(${encodeURIComponent(`"@${clean}","${clean}"`)})&select=id,name,handle,description,is_private,created_by,creator_username,members_count&limit=1`
  );
  if (!ok || rows.length === 0) return null;
  return rows[0];
}
async function findCommunityById(id) {
  if (!id) return null;
  const { ok, rows } = await restRequest(
    `communities?id=eq.${encodeURIComponent(id)}&select=id,name,handle,description,is_private,created_by,creator_username,members_count&limit=1`
  );
  if (!ok || rows.length === 0) return null;
  return rows[0];
}
function canManageCommunity(community, auth) {
  if (!auth?.userId) return false;
  if (auth.isAdmin) return true;
  if (community.created_by && community.created_by === auth.userId) return true;
  const me = (auth.username || "").toLowerCase().replace(/^@/, "");
  const owner = (community.creator_username || "").toLowerCase().replace(/^@/, "");
  return Boolean(me && owner && me === owner);
}
async function listKeysForCommunity(communityId) {
  const { ok, rows } = await restRequest(
    `community_api_keys?community_id=eq.${encodeURIComponent(communityId)}&order=created_at.desc&limit=50`
  );
  return ok ? rows : [];
}
async function countActiveKeys(communityId) {
  const keys = await listKeysForCommunity(communityId);
  return keys.filter((k) => !k.revoked_at).length;
}
async function insertKey(row) {
  const { ok, rows } = await restRequest("community_api_keys", {
    method: "POST",
    body: JSON.stringify(row),
    headers: { Prefer: "return=representation" }
  });
  return ok && rows.length > 0 ? rows[0] : null;
}
async function revokeKey(keyId, communityId) {
  const { ok, rows } = await restRequest(
    `community_api_keys?id=eq.${encodeURIComponent(keyId)}&community_id=eq.${encodeURIComponent(communityId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ revoked_at: (/* @__PURE__ */ new Date()).toISOString() }),
      headers: { Prefer: "return=representation" }
    }
  );
  return ok && rows.length > 0;
}
async function resolveApiKey(plaintext) {
  if (!plaintext || !plaintext.startsWith(API_KEY_PREFIX)) return null;
  const hash = hashApiKey(plaintext);
  const { ok, rows } = await restRequest(
    `community_api_keys?key_hash=eq.${encodeURIComponent(hash)}&limit=1`
  );
  if (!ok || rows.length === 0) return null;
  const row = rows[0];
  if (row.revoked_at) return null;
  return row;
}
async function touchApiKey(row) {
  try {
    await restRequest(`community_api_keys?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        last_used_at: (/* @__PURE__ */ new Date()).toISOString(),
        request_count: Number(row.request_count || 0) + 1
      }),
      headers: { Prefer: "return=minimal" }
    });
  } catch {
  }
}
async function insertCommunityPost(post) {
  const { ok, rows } = await restRequest("posts", {
    method: "POST",
    body: JSON.stringify({
      ...post,
      likes_count: 0,
      liked_by: [],
      comments_count: 0,
      comments: [],
      reposts_count: 0,
      reposted_by: [],
      bookmarked_by: [],
      is_pinned: false,
      is_deleted: false,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }),
    headers: { Prefer: "return=representation" }
  });
  return ok && rows.length > 0 ? rows[0] : null;
}
async function listCommunityPosts(communityHandle, limit) {
  const { ok, rows } = await restRequest(
    `posts?community_handle=eq.${encodeURIComponent(communityHandle)}&is_deleted=eq.false&order=created_at.desc&limit=${limit}&select=id,content,code_snippet,code_language,category,category_name,author,community_id,community_name,community_handle,likes_count,comments_count,reposts_count,created_at`
  );
  return ok ? rows : [];
}
async function listPublicCommunities(limit) {
  const { ok, rows } = await restRequest(
    `communities?is_private=eq.false&order=members_count.desc&limit=${limit}&select=id,name,handle,description,is_private,created_by,creator_username,members_count`
  );
  return ok ? rows : [];
}
var LIMITS = {
  content: 2e3,
  codeSnippet: 1e4,
  codeLanguage: 32,
  authorName: 60,
  category: 40,
  keyName: 60,
  maxActiveKeysPerCommunity: 10
};
var KNOWN_LANGUAGES = /* @__PURE__ */ new Set([
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "sql",
  "html",
  "css",
  "csharp",
  "cpp",
  "c",
  "java",
  "kotlin",
  "swift",
  "php",
  "ruby",
  "bash",
  "shell",
  "yaml",
  "json",
  "dockerfile",
  "plaintext"
]);
function sanitizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, "").slice(0, maxLength).trim();
}
function normalizeLanguage(value) {
  const raw = sanitizeText(value, LIMITS.codeLanguage).toLowerCase();
  if (!raw) return "plaintext";
  const alias = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    golang: "go",
    "c++": "cpp",
    "c#": "csharp",
    sh: "bash",
    postgres: "sql",
    postgresql: "sql",
    yml: "yaml"
  };
  const mapped = alias[raw] || raw;
  return KNOWN_LANGUAGES.has(mapped) ? mapped : "plaintext";
}
function validatePostPayload(body) {
  const content = sanitizeText(body.content, LIMITS.content);
  const codeSnippet = sanitizeText(body.code_snippet ?? body.codeSnippet, LIMITS.codeSnippet);
  if (!content && !codeSnippet) {
    return {
      ok: false,
      field: "content",
      error: "`content` veya `code_snippet` alanlar\u0131ndan en az biri dolu olmal\u0131d\u0131r. / Provide at least one of `content` or `code_snippet`."
    };
  }
  if (typeof body.content === "string" && body.content.length > LIMITS.content) {
    return {
      ok: false,
      field: "content",
      error: `\`content\` en fazla ${LIMITS.content} karakter olabilir. / \`content\` may be at most ${LIMITS.content} characters.`
    };
  }
  const rawSnippet = body.code_snippet ?? body.codeSnippet;
  if (typeof rawSnippet === "string" && rawSnippet.length > LIMITS.codeSnippet) {
    return {
      ok: false,
      field: "code_snippet",
      error: `\`code_snippet\` en fazla ${LIMITS.codeSnippet} karakter olabilir. / \`code_snippet\` may be at most ${LIMITS.codeSnippet} characters.`
    };
  }
  const category = sanitizeText(body.category, LIMITS.category).toLowerCase() || "general";
  const authorName = sanitizeText(body.author_name ?? body.authorName, LIMITS.authorName) || "API";
  return {
    ok: true,
    value: {
      content: content || `\`${normalizeLanguage(body.code_language ?? body.codeLanguage)}\` kod par\xE7ac\u0131\u011F\u0131`,
      codeSnippet: codeSnippet || null,
      codeLanguage: codeSnippet ? normalizeLanguage(body.code_language ?? body.codeLanguage) : null,
      category,
      authorName
    }
  };
}
function extractApiKey(req) {
  const header = req.headers["x-api-key"];
  if (typeof header === "string" && header.trim()) return header.trim();
  const authorization = req.headers.authorization;
  if (typeof authorization === "string") {
    const match = /^Bearer\s+(lnx_live_[A-Za-z0-9_-]+)$/i.exec(authorization.trim());
    if (match) return match[1];
  }
  const fromBody = req.body?.api_key;
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();
  return "";
}

// src/server/mail.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);

// src/server/mailTemplate.ts
var COLORS = {
  pageBg: "#f4f4f5",
  cardBg: "#ffffff",
  headerBg: "#09090b",
  headerBorder: "#27272a",
  text: "#18181b",
  muted: "#52525b",
  faint: "#a1a1aa",
  border: "#e4e4e7",
  accent: "#18181b",
  accentText: "#ffffff"
};
function escapeHtml2(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeUrl(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
function renderMailHtml(input) {
  const brandName = input.brandName || "Code4Ever";
  const brandDomain = input.brandDomain || "lanux.online";
  const logoCid = input.logoCid || "c4elogo";
  const cta = input.callToAction ? { ...input.callToAction, url: safeUrl(input.callToAction.url) } : null;
  const paragraphs = input.paragraphs.filter((p) => String(p || "").trim()).map(
    (p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${COLORS.text};">${escapeHtml2(p).replace(/\n/g, "<br />")}</p>`
  ).join("");
  const greeting = input.recipientName ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${COLORS.text};">Merhaba <strong>${escapeHtml2(input.recipientName)}</strong>,</p>` : "";
  const ctaBlock = cta && cta.url ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
           <tr>
             <td align="center" bgcolor="${COLORS.accent}" style="border-radius:10px;">
               <a href="${escapeHtml2(cta.url)}"
                  style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;
                         color:${COLORS.accentText};text-decoration:none;border-radius:10px;
                         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                 ${escapeHtml2(cta.label)}
               </a>
             </td>
           </tr>
         </table>` : "";
  const footnote = input.footnote ? `<p class="c4e-note" style="margin:0 0 10px;font-size:12px;line-height:1.6;color:${COLORS.muted};">${escapeHtml2(input.footnote)}</p>` : "";
  const preheader = input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
         ${escapeHtml2(input.preheader)}${"&#8203;&nbsp;".repeat(60)}
       </div>` : "";
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml2(input.heading)}</title>
<style>
  /* Stripped by some clients; every rule here is an enhancement, never a requirement. */
  @media (max-width:600px){
    .c4e-card{width:100% !important;border-radius:0 !important;}
    .c4e-pad{padding-left:22px !important;padding-right:22px !important;}
    .c4e-h1{font-size:21px !important;}
  }
  @media (prefers-color-scheme:dark){
    .c4e-page{background:#09090b !important;}
    .c4e-card{background:#0c0c0e !important;border-color:#27272a !important;}
    /* Paragraphs carry their own inline colour (required for clients that drop this
       block), so the dark override has to target them directly \u2014 an inherited rule on the
       cell alone loses to the inline declaration and left the body near-invisible. */
    .c4e-text,.c4e-h1,.c4e-text p,.c4e-text strong{color:#f4f4f5 !important;}
    .c4e-muted,.c4e-note{color:#a1a1aa !important;}
    .c4e-divider{border-color:#27272a !important;}
    .c4e-cta a{background:#f4f4f5 !important;color:#09090b !important;}
    .c4e-cta td{background:#f4f4f5 !important;}
    .c4e-sent{color:#71717a !important;}
  }
  a{color:#2563eb;}
</style>
</head>
<body class="c4e-page" style="margin:0;padding:0;background:${COLORS.pageBg};
      -webkit-font-smoothing:antialiased;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:${COLORS.pageBg};padding:32px 12px;">
  <tr>
    <td align="center">

      <table role="presentation" class="c4e-card" cellpadding="0" cellspacing="0" border="0" width="600"
             style="width:600px;max-width:600px;background:${COLORS.cardBg};border:1px solid ${COLORS.border};
                    border-radius:16px;overflow:hidden;">

        <!-- Header band -->
        <tr>
          <td class="c4e-pad" align="left"
              style="background:${COLORS.headerBg};padding:26px 34px;border-bottom:1px solid ${COLORS.headerBorder};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding-right:13px;">
                  <img src="cid:${escapeHtml2(logoCid)}" width="44" height="44" alt="${escapeHtml2(brandName)}"
                       style="display:block;width:44px;height:44px;border-radius:11px;border:0;outline:none;" />
                </td>
                <td valign="middle">
                  <div style="font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;line-height:1.2;">
                    ${escapeHtml2(brandName)}
                  </div>
                  <div style="font-size:12px;color:#a1a1aa;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.5;">
                    ${escapeHtml2(brandDomain)}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="c4e-pad c4e-text" align="left" style="padding:34px;color:${COLORS.text};">
            <h1 class="c4e-h1" style="margin:0 0 18px;font-size:24px;line-height:1.3;font-weight:800;
                       letter-spacing:-0.5px;color:${COLORS.text};">
              ${escapeHtml2(input.heading)}
            </h1>
            ${greeting}
            ${paragraphs}
            <div class="c4e-cta">${ctaBlock}</div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="c4e-pad" align="left" style="padding:0 34px 30px;">
            <hr class="c4e-divider" style="border:0;border-top:1px solid ${COLORS.border};margin:0 0 18px;" />
            ${footnote}
            <p class="c4e-muted" style="margin:0;font-size:12px;line-height:1.6;color:${COLORS.faint};">
              ${escapeHtml2(brandName)} \xB7
              <a href="https://${escapeHtml2(brandDomain)}" style="color:${COLORS.muted};text-decoration:none;">${escapeHtml2(brandDomain)}</a> \xB7
              <a href="https://app.${escapeHtml2(brandDomain)}/tos" style="color:${COLORS.muted};text-decoration:none;">Kullan\u0131m \u015Eartlar\u0131</a> \xB7
              <a href="https://app.${escapeHtml2(brandDomain)}/privacy" style="color:${COLORS.muted};text-decoration:none;">Gizlilik</a>
            </p>
          </td>
        </tr>
      </table>

      <p class="c4e-sent" style="margin:18px 0 0;font-size:11px;color:${COLORS.faint};">
        Bu e-posta ${escapeHtml2(brandDomain)} taraf\u0131ndan g\xF6nderildi.
      </p>

    </td>
  </tr>
</table>
</body>
</html>`;
}
function renderMailText(input) {
  const brandName = input.brandName || "Code4Ever";
  const brandDomain = input.brandDomain || "lanux.online";
  const lines = [brandName.toUpperCase(), "=".repeat(brandName.length), "", input.heading, ""];
  if (input.recipientName) lines.push(`Merhaba ${input.recipientName},`, "");
  for (const p of input.paragraphs) {
    if (String(p || "").trim()) lines.push(p, "");
  }
  const url = input.callToAction ? safeUrl(input.callToAction.url) : null;
  if (input.callToAction && url) lines.push(`${input.callToAction.label}: ${url}`, "");
  if (input.footnote) lines.push("--", input.footnote, "");
  lines.push("--", `${brandName} \xB7 ${brandDomain}`);
  return lines.join("\n");
}

// src/server/mail.ts
function toPort(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}
function toSecureFlag(value, fallback) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (/^(1|true|yes|on|tls|ssl|ssl\/tls|implicit|secure)$/.test(raw)) return true;
  if (/^(0|false|no|off|none|plain|starttls|insecure)$/.test(raw)) return false;
  return fallback;
}
function getSmtpConfig() {
  const host = env("MAIL_SMTP_HOST");
  const user = env("MAIL_SMTP_USER");
  const pass = env("MAIL_SMTP_PASS");
  if (!host || !user || !pass) return null;
  const port = toPort(env("MAIL_SMTP_PORT"), 465);
  return {
    host,
    port,
    // Implicit TLS on 465; STARTTLS upgrade on 587 and friends.
    secure: toSecureFlag(env("MAIL_SMTP_SECURE"), port === 465),
    user,
    pass,
    fromAddress: env("MAIL_FROM_ADDRESS", user),
    fromName: env("MAIL_FROM_NAME", "Code4Ever")
  };
}
function imapUnavailableReason() {
  if (isServerless()) {
    return "IMAP, sunucusuz (serverless) ortamda kullan\u0131lamaz: gelen kutusu okumak a\xE7\u0131k ve s\xFCrekli bir TCP ba\u011Flant\u0131s\u0131 gerektirir, sunucusuz fonksiyonlar ise istekler aras\u0131nda donar. G\xF6nderme (SMTP) \xE7al\u0131\u015F\u0131r. Gelen kutusu i\xE7in arka ucu kal\u0131c\u0131 bir Node s\xFCrecinde \xE7al\u0131\u015Ft\u0131r\u0131n (Railway, Render, Fly.io veya bir VPS).";
  }
  if (!env("MAIL_IMAP_HOST") || !env("MAIL_IMAP_USER", env("MAIL_SMTP_USER")) || !env("MAIL_IMAP_PASS", env("MAIL_SMTP_PASS"))) {
    return "IMAP yap\u0131land\u0131r\u0131lmam\u0131\u015F (MAIL_IMAP_HOST / MAIL_IMAP_USER / MAIL_IMAP_PASS eksik).";
  }
  return null;
}
function getImapConfig() {
  if (isServerless()) return null;
  const host = env("MAIL_IMAP_HOST");
  const user = env("MAIL_IMAP_USER", env("MAIL_SMTP_USER"));
  const pass = env("MAIL_IMAP_PASS", env("MAIL_SMTP_PASS"));
  if (!host || !user || !pass) return null;
  const port = toPort(env("MAIL_IMAP_PORT"), 993);
  return { host, port, secure: toSecureFlag(env("MAIL_IMAP_SECURE"), port === 993), user, pass };
}
function describeMailConfig() {
  const smtp = getSmtpConfig();
  const imap = getImapConfig();
  return {
    smtp: smtp ? { configured: true, host: smtp.host, port: smtp.port, secure: smtp.secure, from: smtp.fromAddress } : { configured: false },
    imap: imap ? { configured: true, host: imap.host, port: imap.port, secure: imap.secure, user: imap.user } : { configured: false, reason: imapUnavailableReason() },
    // Lets the admin UI tell "not set up yet" apart from "cannot work on this host".
    serverless: isServerless()
  };
}
function headerSafe(value, maxLength = 200) {
  return String(value ?? "").replace(/[\r\n\u2028\u2029\u0000]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
var EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;.]+(\.[^\s@<>"',;.]+)+$/;
function normalizeEmail(value) {
  const raw = headerSafe(value, 254).toLowerCase();
  if (!raw || raw.length > 254) return null;
  return EMAIL_RE.test(raw) ? raw : null;
}
function sanitizeIncomingHtml(html) {
  if (!html) return "";
  let out = String(html);
  out = out.replace(
    /<\s*(script|style|iframe|frame|frameset|object|embed|applet|link|meta|base|form|input|button|textarea|select|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );
  out = out.replace(
    /<\s*(script|style|iframe|frame|frameset|object|embed|applet|link|meta|base|form|input|button|textarea|select|svg|math)\b[^>]*>/gi,
    ""
  );
  out = out.replace(/\son[a-z-]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z-]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, "");
  out = out.replace(/(href|src|action|formaction|background|poster|data)\s*=\s*"\s*(javascript|vbscript|data|file)\s*:[^"]*"/gi, '$1="#"');
  out = out.replace(/(href|src|action|formaction|background|poster|data)\s*=\s*'\s*(javascript|vbscript|data|file)\s*:[^']*'/gi, "$1='#'");
  out = out.replace(/\ssrc\s*=\s*"(https?:)?\/\/[^"]*"/gi, ' data-blocked-src="1"');
  out = out.replace(/\ssrc\s*=\s*'(https?:)?\/\/[^']*'/gi, " data-blocked-src='1'");
  out = out.replace(/style\s*=\s*"[^"]*(expression|javascript:|@import|behavior:)[^"]*"/gi, "");
  out = out.replace(/style\s*=\s*'[^']*(expression|javascript:|@import|behavior:)[^']*'/gi, "");
  return out;
}
async function resolveRecipientByUsername(rawUsername) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const username = String(rawUsername || "").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_.-]{1,40}$/.test(username)) return null;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
  let profile = null;
  try {
    const response = await safeFetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id,username,display_name,email&limit=1`,
      { headers, timeoutMs: 1e4 }
    );
    if (response.ok) {
      const rows = JSON.parse(response.text || "[]");
      profile = Array.isArray(rows) ? rows[0] : null;
    }
  } catch {
    return null;
  }
  if (!profile) return null;
  const fromProfile = normalizeEmail(profile.email);
  if (fromProfile) {
    return {
      username: String(profile.username || username),
      displayName: String(profile.display_name || profile.username || username),
      email: fromProfile,
      source: "profile"
    };
  }
  try {
    const response = await safeFetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(String(profile.id))}`,
      { headers, timeoutMs: 1e4 }
    );
    if (response.ok) {
      const user = JSON.parse(response.text || "{}");
      const fromAuth = normalizeEmail(user?.email);
      if (fromAuth) {
        return {
          username: String(profile.username || username),
          displayName: String(profile.display_name || profile.username || username),
          email: fromAuth,
          source: "auth"
        };
      }
    }
  } catch {
  }
  return null;
}
var LOGO_CID = "c4elogo";
function findLogoFile() {
  const override = env("MAIL_LOGO_PATH");
  if (override) {
    try {
      if (import_node_fs.default.existsSync(override)) return override;
    } catch {
    }
  }
  const roots = [];
  try {
    if (typeof __dirname === "string" && __dirname) {
      roots.push(__dirname, import_node_path.default.join(__dirname, ".."));
    }
  } catch {
  }
  roots.push(process.cwd());
  for (const root of roots) {
    for (const relative of ["email-logo.png", import_node_path.default.join("dist", "email-logo.png"), import_node_path.default.join("public", "email-logo.png")]) {
      const file = import_node_path.default.resolve(root, relative);
      try {
        if (import_node_fs.default.existsSync(file)) return file;
      } catch {
      }
    }
  }
  return null;
}
function logoAttachment() {
  const file = findLogoFile();
  if (file) {
    return [{ filename: "logo.png", path: file, cid: LOGO_CID, contentDisposition: "inline" }];
  }
  return [];
}
async function sendMail(input) {
  const config = getSmtpConfig();
  if (!config) {
    return { ok: false, error: "SMTP yap\u0131land\u0131r\u0131lmam\u0131\u015F (MAIL_SMTP_HOST / USER / PASS eksik)." };
  }
  const to = normalizeEmail(input.to);
  if (!to) return { ok: false, error: "Ge\xE7ersiz al\u0131c\u0131 e-posta adresi." };
  const subject = headerSafe(input.subject, 180);
  if (!subject) return { ok: false, error: "Konu bo\u015F olamaz." };
  const bodyText = String(input.body || "").trim();
  if (!bodyText) return { ok: false, error: "Mesaj g\xF6vdesi bo\u015F olamaz." };
  const replyTo = input.replyTo ? normalizeEmail(input.replyTo) : null;
  const templateInput = {
    heading: headerSafe(input.heading || subject, 160),
    preheader: bodyText.replace(/\s+/g, " ").slice(0, 120),
    // Blank line separates paragraphs, matching how people actually type.
    paragraphs: bodyText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    recipientName: input.recipientName ? headerSafe(input.recipientName, 80) : void 0,
    callToAction: input.callToAction,
    footnote: input.footnote ? headerSafe(input.footnote, 300) : void 0,
    logoCid: LOGO_CID
  };
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      // Modern TLS floor; refuses to silently downgrade on a hostile network.
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 15e3,
      greetingTimeout: 15e3,
      socketTimeout: 3e4
    });
    const info = await transporter.sendMail({
      from: { name: headerSafe(config.fromName, 80), address: config.fromAddress },
      to,
      subject,
      ...replyTo ? { replyTo } : {},
      text: renderMailText(templateInput),
      html: renderMailHtml(templateInput),
      attachments: logoAttachment()
    });
    transporter.close();
    return {
      ok: true,
      messageId: String(info.messageId || ""),
      accepted: (info.accepted || []).map((a) => String(a))
    };
  } catch (error) {
    return { ok: false, error: `SMTP hatas\u0131: ${String(error?.message || error).slice(0, 300)}` };
  }
}
async function verifySmtp() {
  const config = getSmtpConfig();
  if (!config) return { ok: false, error: "SMTP yap\u0131land\u0131r\u0131lmam\u0131\u015F." };
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 15e3
    });
    await transporter.verify();
    transporter.close();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 300) };
  }
}
async function withImap(handler2) {
  const config = getImapConfig();
  if (!config) throw new Error("IMAP yap\u0131land\u0131r\u0131lmam\u0131\u015F (MAIL_IMAP_HOST / USER / PASS eksik).");
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { minVersion: "TLSv1.2" },
    // imapflow logs the full IMAP dialogue at info level; that includes envelopes.
    logger: false
  });
  await client.connect();
  try {
    return await handler2(client);
  } finally {
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {
      }
    }
  }
}
function addressOf(source) {
  const first = source?.value?.[0] || source?.[0] || {};
  return {
    name: headerSafe(first.name || "", 120),
    address: headerSafe(first.address || "", 254)
  };
}
async function fetchInbox(options = {}) {
  const mailbox = /^[A-Za-z0-9 _./-]{1,80}$/.test(options.mailbox || "") ? options.mailbox : "INBOX";
  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const total = client.mailbox?.exists || 0;
      if (total === 0) return [];
      const start = Math.max(1, total - limit + 1);
      const messages = [];
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        envelope: true,
        flags: true,
        bodyStructure: true,
        // Enough of the body for a preview without pulling whole attachments.
        bodyParts: ["1"]
      })) {
        const env_ = msg.envelope || {};
        const from = addressOf(env_.from);
        const to = addressOf(env_.to);
        const flags = msg.flags || /* @__PURE__ */ new Set();
        let preview = "";
        try {
          const part = msg.bodyParts?.get("1");
          if (part) preview = part.toString("utf8").replace(/\s+/g, " ").slice(0, 200);
        } catch {
        }
        messages.push({
          uid: Number(msg.uid),
          seq: Number(msg.seq),
          subject: headerSafe(env_.subject || "(konu yok)", 250),
          fromName: from.name,
          fromAddress: from.address,
          to: to.address,
          date: env_.date ? new Date(env_.date).toISOString() : null,
          seen: flags.has("\\Seen"),
          flagged: flags.has("\\Flagged"),
          hasAttachments: Boolean(msg.bodyStructure?.childNodes?.some((n) => n.disposition === "attachment")),
          preview
        });
      }
      return messages.reverse();
    } finally {
      lock.release();
    }
  });
}
async function fetchMessage(uid, mailboxName = "INBOX") {
  const mailbox = /^[A-Za-z0-9 _./-]{1,80}$/.test(mailboxName) ? mailboxName : "INBOX";
  if (!Number.isInteger(uid) || uid <= 0) return null;
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const raw = await client.download(String(uid), void 0, { uid: true });
      if (!raw?.content) return null;
      const { simpleParser } = await import("mailparser");
      const parsed = await simpleParser(raw.content);
      const from = {
        name: headerSafe(parsed.from?.value?.[0]?.name || "", 120),
        address: headerSafe(parsed.from?.value?.[0]?.address || "", 254)
      };
      const originalHtml = String(parsed.html || "");
      const sanitized = sanitizeIncomingHtml(originalHtml);
      return {
        uid,
        seq: 0,
        subject: headerSafe(parsed.subject || "(konu yok)", 250),
        fromName: from.name,
        fromAddress: from.address,
        to: headerSafe(parsed.to?.value?.[0]?.address || "", 254),
        date: parsed.date ? new Date(parsed.date).toISOString() : null,
        seen: true,
        flagged: false,
        hasAttachments: Array.isArray(parsed.attachments) && parsed.attachments.length > 0,
        preview: "",
        text: String(parsed.text || "").slice(0, 2e5),
        html: sanitized.slice(0, 4e5),
        imagesBlocked: sanitized.includes("data-blocked-src"),
        attachments: (parsed.attachments || []).map((a) => ({
          filename: headerSafe(a.filename || "ek", 200),
          contentType: headerSafe(a.contentType || "application/octet-stream", 100),
          size: Number(a.size) || 0
        }))
      };
    } finally {
      lock.release();
    }
  });
}
async function verifyImap() {
  try {
    const mailboxes = await withImap(async (client) => {
      const list = await client.list();
      return list.map((m) => String(m.path)).slice(0, 50);
    });
    return { ok: true, mailboxes };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 300) };
  }
}

// server.ts
var app = (0, import_express.default)();
var PORT = Number(env("PORT", "3000"));
var IS_PRODUCTION = process.env.NODE_ENV === "production";
app.set("trust proxy", env("TRUST_PROXY", IS_PRODUCTION ? "1" : "loopback"));
app.disable("x-powered-by");
app.use(
  import_express.default.json({
    limit: "256kb",
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  })
);
var CSP_DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com https://github.com ws://localhost:* ws://127.0.0.1:*",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // No 'unsafe-eval' and no wildcard host: only first-party scripts may execute.
  "script-src 'self' 'unsafe-inline'",
  "script-src-elem 'self' 'unsafe-inline'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'"
].join("; ");
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", CSP_DIRECTIVES);
  if (IS_PRODUCTION) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});
app.use("/api", attachOptionalAuth);
app.use("/api", rateLimit({ scope: "api", windowMs: 6e4, max: 120 }));
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    platform: "Code4Ever (C4E)",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    auth: supabaseConfigured() ? "supabase" : "unconfigured",
    webhooks_supported: true,
    rate_limiter: "sliding_window_active"
  });
});
var DISCORD_HOSTS = ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"];
var TELEGRAM_HOSTS = ["api.telegram.org"];
var JUBBIO_HOSTS = env("JUBBIO_ALLOWED_HOSTS", "jubbio.com,*.jubbio.com").split(",").map((host) => host.trim()).filter(Boolean);
var MAX_WEBHOOK_MESSAGE_LENGTH = 3500;
async function sendDiscordWebhook(webhookUrl, message, botName, avatarUrl) {
  const payload = {
    content: message,
    username: asString(botName, 80) || "Code4Ever Bot",
    avatar_url: asString(avatarUrl, 500) || void 0
  };
  const response = await safeFetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    allowedHosts: DISCORD_HOSTS,
    timeoutMs: 12e3
  });
  if (!response.ok) {
    throw new Error(`Discord Webhook hatas\u0131 (${response.status}): ${response.text || response.statusText}`);
  }
  return true;
}
async function sendJubbioWebhook(config, message) {
  const cleanUrl = asString(config.webhook_url, 500);
  const cleanToken = asString(config.bot_token, 300);
  const cleanChannelId = asString(config.channel_id, 100).replace(/[^a-zA-Z0-9_-]/g, "");
  if (cleanUrl) {
    const response = await safeFetch(cleanUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Code4Ever-Webhook/1.0",
        Accept: "application/json, text/plain, */*"
      },
      body: JSON.stringify({
        content: message,
        text: message,
        message,
        username: "Code4Ever Bot",
        name: "Code4Ever Bot",
        platform: "Code4Ever"
      }),
      allowedHosts: JUBBIO_HOSTS,
      timeoutMs: 12e3
    });
    if (!response.ok) {
      throw new Error(`Jubbio Webhook hatas\u0131 (${response.status}): ${response.text || response.statusText || "Bilinmeyen yan\u0131t"}`);
    }
    return true;
  }
  if (cleanToken && cleanChannelId) {
    const response = await safeFetch(`https://jubbio.com/api/v1/channels/${encodeURIComponent(cleanChannelId)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${cleanToken.replace(/^Bot\s+/i, "")}`,
        "User-Agent": "Code4Ever-Webhook/1.0",
        Accept: "application/json, text/plain, */*"
      },
      body: JSON.stringify({ content: message, message }),
      allowedHosts: JUBBIO_HOSTS,
      timeoutMs: 12e3
    });
    if (!response.ok) {
      throw new Error(`Jubbio Bot API hatas\u0131 (${response.status}): ${response.text || response.statusText || "Bilinmeyen yan\u0131t"}`);
    }
    return true;
  }
  throw new Error("Jubbio i\xE7in l\xFCtfen ge\xE7erli bir Webhook URL veya Bot Token + Kanal ID girin.");
}
async function sendTelegramWebhook(botToken, chatId, message) {
  const cleanToken = asString(botToken, 200).replace(/^bot/i, "");
  const cleanChatId = asString(chatId, 100);
  if (!/^[A-Za-z0-9:_-]+$/.test(cleanToken)) {
    throw new Error("Ge\xE7ersiz Telegram Bot Token bi\xE7imi.");
  }
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  let response = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: cleanChatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: false
    }),
    allowedHosts: TELEGRAM_HOSTS,
    timeoutMs: 12e3
  });
  if (!response.ok) {
    response = await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message.replace(/[*_`[\]()]/g, ""),
        disable_web_page_preview: false
      }),
      allowedHosts: TELEGRAM_HOSTS,
      timeoutMs: 12e3
    });
  }
  if (!response.ok) {
    let description = "";
    try {
      description = JSON.parse(response.text || "{}").description || "";
    } catch {
    }
    throw new Error(`Telegram API hatas\u0131 (${response.status}): ${description || "Ge\xE7ersiz Bot Token veya Chat ID"}`);
  }
  return true;
}
var MAX_TRACKED_DELETIONS = 5e3;
var globalDeletedPostIds = /* @__PURE__ */ new Set();
function trackDeletedPost(postId) {
  globalDeletedPostIds.add(postId);
  if (globalDeletedPostIds.size > MAX_TRACKED_DELETIONS) {
    const overflow = globalDeletedPostIds.size - MAX_TRACKED_DELETIONS;
    let removed = 0;
    for (const id of globalDeletedPostIds) {
      globalDeletedPostIds.delete(id);
      if (++removed >= overflow) break;
    }
  }
}
app.get("/api/posts/deleted", (_req, res) => {
  res.json({ success: true, deleted_ids: Array.from(globalDeletedPostIds) });
});
app.post(
  "/api/posts/delete",
  requireAuth,
  rateLimit({ scope: "post-delete", windowMs: 6e4, max: 30, perUser: true }),
  async (req, res) => {
    const postId = asString(req.body?.postId, 120);
    if (!postId) {
      res.status(400).json({ success: false, error: "postId gereklidir." });
      return;
    }
    const accessToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    let supabaseDeleted = false;
    let supabaseError = null;
    if (SUPABASE_URL && SUPABASE_ANON_KEY && accessToken) {
      const endpoint = `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(postId)}`;
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      };
      try {
        const deleteRes = await safeFetch(endpoint, {
          method: "DELETE",
          headers: { ...headers, Prefer: "return=representation" },
          timeoutMs: 1e4
        });
        if (deleteRes.ok) {
          supabaseDeleted = true;
        } else {
          const patchRes = await safeFetch(endpoint, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ is_deleted: true, content: "[DELETED]" }),
            timeoutMs: 1e4
          });
          if (patchRes.ok) {
            supabaseDeleted = true;
          } else {
            supabaseError = "Bu g\xF6nderiyi silme yetkiniz yok.";
          }
        }
      } catch (err) {
        supabaseError = err?.message || "Network error";
      }
    } else {
      supabaseError = "Supabase yap\u0131land\u0131r\u0131lmam\u0131\u015F.";
    }
    if (!supabaseDeleted) {
      res.status(403).json({ success: false, postId, error: supabaseError || "Silme i\u015Flemi reddedildi." });
      return;
    }
    trackDeletedPost(postId);
    res.json({
      success: true,
      postId,
      supabaseDeleted,
      message: "G\xF6nderi ba\u015Far\u0131yla silindi ve t\xFCm cihazlarda senkronize edildi."
    });
  }
);
function publicCommunityShape(c) {
  return {
    id: c.id,
    name: c.name,
    handle: c.handle,
    description: c.description,
    members_count: c.members_count ?? 0,
    posts_url: `/api/v1/communities/${encodeURIComponent(c.handle)}/posts`
  };
}
function apiKeysUnavailable(res) {
  if (serviceRoleConfigured()) return false;
  res.status(503).json({
    success: false,
    error: "Topluluk API sunucu taraf\u0131nda yap\u0131land\u0131r\u0131lmam\u0131\u015F (SUPABASE_SERVICE_ROLE_KEY eksik). / Community API is not configured on this deployment."
  });
  return true;
}
app.get(["/api/v1/communities", "/api/communities"], async (_req, res) => {
  const communities = serviceRoleConfigured() ? await listPublicCommunities(50) : [];
  res.json({
    success: true,
    api_version: "v1",
    documentation: "/dev/docs",
    endpoints: {
      list_communities: "GET /api/v1/communities",
      get_community: "GET /api/v1/communities/:handle",
      list_posts: "GET /api/v1/communities/:handle/posts?limit=50",
      publish_post: "POST /api/v1/communities/:handle/posts  (X-API-Key required)",
      list_keys: "GET /api/v1/communities/:handle/keys  (session required, founder only)",
      create_key: "POST /api/v1/communities/:handle/keys  (session required, founder only)",
      revoke_key: "DELETE /api/v1/communities/:handle/keys/:keyId  (session required, founder only)"
    },
    limits: {
      content_max_chars: LIMITS.content,
      code_snippet_max_chars: LIMITS.codeSnippet,
      publish_requests_per_minute: 30,
      active_keys_per_community: LIMITS.maxActiveKeysPerCommunity
    },
    payload_example: {
      content: "Performansl\u0131 debounce hook \xF6rne\u011Fi",
      code_snippet: "export const sum = (a: number, b: number) => a + b;",
      code_language: "typescript",
      category: "frontend",
      author_name: "CI Bot"
    },
    count: communities.length,
    communities: communities.map(publicCommunityShape)
  });
});
app.get(
  ["/api/v1/communities/:handle", "/api/communities/:handle"],
  rateLimit({ scope: "community-read", windowMs: 6e4, max: 60 }),
  async (req, res) => {
    if (apiKeysUnavailable(res)) return;
    const community = await findCommunityByHandle(String(req.params.handle || ""));
    if (!community) {
      res.status(404).json({ success: false, error: "Topluluk bulunamad\u0131. / Community not found." });
      return;
    }
    if (community.is_private) {
      res.status(404).json({ success: false, error: "Topluluk bulunamad\u0131. / Community not found." });
      return;
    }
    res.json({ success: true, community: publicCommunityShape(community) });
  }
);
app.get(
  ["/api/v1/communities/:handle/posts", "/api/communities/:handle/posts"],
  rateLimit({ scope: "community-posts", windowMs: 6e4, max: 60 }),
  async (req, res) => {
    if (apiKeysUnavailable(res)) return;
    const community = await findCommunityByHandle(String(req.params.handle || ""));
    if (!community || community.is_private) {
      res.status(404).json({ success: false, error: "Topluluk bulunamad\u0131. / Community not found." });
      return;
    }
    const requested = Number(req.query.limit);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 50;
    const posts = await listCommunityPosts(community.handle, limit);
    res.json({
      success: true,
      community: publicCommunityShape(community),
      count: posts.length,
      posts
    });
  }
);
app.post(
  [
    "/api/v1/communities/:handle/posts",
    "/api/communities/:handle/posts",
    "/api/v1/community/post",
    "/api/v1/community/publish",
    "/api/community/post"
  ],
  rateLimit({ scope: "community-publish", windowMs: 6e4, max: 30 }),
  async (req, res) => {
    if (apiKeysUnavailable(res)) return;
    const body = isPlainObject(req.body) ? req.body : {};
    const presentedKey = extractApiKey({ headers: req.headers, body });
    if (!presentedKey) {
      res.status(401).json({
        success: false,
        error: "API anahtar\u0131 eksik. `X-API-Key` ba\u015Fl\u0131\u011F\u0131n\u0131 g\xF6nderin. / Missing API key: send the `X-API-Key` header.",
        documentation: "/dev/docs"
      });
      return;
    }
    const keyRow = await resolveApiKey(presentedKey);
    if (!keyRow) {
      res.status(401).json({
        success: false,
        error: "API anahtar\u0131 ge\xE7ersiz veya iptal edilmi\u015F. / API key is invalid or revoked."
      });
      return;
    }
    if (!keyRow.scopes?.includes("posts:write")) {
      res.status(403).json({
        success: false,
        error: "Bu anahtar `posts:write` yetkisine sahip de\u011Fil. / This key lacks the `posts:write` scope."
      });
      return;
    }
    const community = await findCommunityById(keyRow.community_id);
    if (!community) {
      res.status(404).json({ success: false, error: "Topluluk bulunamad\u0131. / Community not found." });
      return;
    }
    const routeHandle = String(req.params.handle || body.community_handle || "").replace(/^@/, "").toLowerCase();
    const keyHandle = community.handle.replace(/^@/, "").toLowerCase();
    if (routeHandle && routeHandle !== keyHandle) {
      res.status(403).json({
        success: false,
        error: `Bu anahtar yaln\u0131zca @${keyHandle} toplulu\u011Funda ge\xE7erli. / This key is only valid for @${keyHandle}.`
      });
      return;
    }
    const validation = validatePostPayload(body);
    if (!validation.ok || !validation.value) {
      res.status(422).json({ success: false, field: validation.field, error: validation.error });
      return;
    }
    const payload = validation.value;
    const authorUsername = normalizeUsername(asString(body.author_username ?? body.authorUsername)) || keyRow.created_by_username || "api";
    const post = await insertCommunityPost({
      id: `post_api_${Date.now()}_${import_node_crypto3.default.randomBytes(6).toString("hex")}`,
      author: {
        username: authorUsername,
        display_name: payload.authorName,
        avatar_url: "",
        // Marks the post as machine-published so the UI can label it honestly.
        via_api: true,
        api_key_name: keyRow.name
      },
      author_id: keyRow.created_by,
      content: payload.content,
      category: payload.category,
      category_name: payload.category,
      code_snippet: payload.codeSnippet,
      code_language: payload.codeLanguage,
      community_id: community.id,
      community_name: community.name,
      community_handle: community.handle
    });
    if (!post) {
      res.status(502).json({
        success: false,
        error: "G\xF6nderi veritaban\u0131na yaz\u0131lamad\u0131. / Could not write the post to the database."
      });
      return;
    }
    void touchApiKey(keyRow);
    res.status(201).json({
      success: true,
      message: `G\xF6nderi ${community.handle} toplulu\u011Funa iletildi. / Post published to ${community.handle}.`,
      post: {
        id: post.id,
        content: post.content,
        code_language: post.code_language,
        community_handle: post.community_handle,
        created_at: post.created_at,
        url: `${appOrigin()}/c/${community.handle}#post-${post.id}`
      }
    });
  }
);
async function requireCommunityOwner(req, res) {
  if (apiKeysUnavailable(res)) return null;
  const community = await findCommunityByHandle(String(req.params.handle || ""));
  if (!community) {
    res.status(404).json({ success: false, error: "Topluluk bulunamad\u0131. / Community not found." });
    return null;
  }
  if (!canManageCommunity(community, req.auth)) {
    res.status(403).json({
      success: false,
      error: "Yaln\u0131zca toplulu\u011Fun kurucusu API anahtar\u0131 y\xF6netebilir. / Only the community founder can manage API keys."
    });
    return null;
  }
  return community;
}
app.get(
  "/api/v1/communities/:handle/keys",
  requireAuth,
  rateLimit({ scope: "community-keys-read", windowMs: 6e4, max: 60, perUser: true }),
  async (req, res) => {
    const community = await requireCommunityOwner(req, res);
    if (!community) return;
    const keys = await listKeysForCommunity(community.id);
    res.json({
      success: true,
      community: { id: community.id, handle: community.handle, name: community.name },
      count: keys.length,
      keys: keys.map(toPublicKey)
    });
  }
);
app.post(
  "/api/v1/communities/:handle/keys",
  requireAuth,
  rateLimit({ scope: "community-keys-create", windowMs: 6e4, max: 10, perUser: true }),
  async (req, res) => {
    const community = await requireCommunityOwner(req, res);
    if (!community) return;
    const active = await countActiveKeys(community.id);
    if (active >= LIMITS.maxActiveKeysPerCommunity) {
      res.status(409).json({
        success: false,
        error: `Bir toplulukta en fazla ${LIMITS.maxActiveKeysPerCommunity} etkin anahtar olabilir. \xD6nce birini iptal edin. / At most ${LIMITS.maxActiveKeysPerCommunity} active keys per community; revoke one first.`
      });
      return;
    }
    const body = isPlainObject(req.body) ? req.body : {};
    const name = sanitizeText(body.name, LIMITS.keyName) || "default";
    const generated = generateApiKey();
    const row = await insertKey({
      id: `cak_${Date.now()}_${import_node_crypto3.default.randomBytes(6).toString("hex")}`,
      community_id: community.id,
      community_handle: community.handle,
      name,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
      scopes: ["posts:write"],
      created_by: req.auth?.userId || null,
      created_by_username: req.auth?.username || null
    });
    if (!row) {
      res.status(502).json({
        success: false,
        error: "Anahtar olu\u015Fturulamad\u0131. / Could not create the key."
      });
      return;
    }
    res.status(201).json({
      success: true,
      // The ONLY time the plaintext is ever transmitted.
      api_key: generated.plaintext,
      warning: "Bu anahtar bir daha g\xF6sterilmeyecek. \u015Eimdi kaydedin. / This key will not be shown again. Store it now.",
      key: toPublicKey(row)
    });
  }
);
app.delete(
  "/api/v1/communities/:handle/keys/:keyId",
  requireAuth,
  rateLimit({ scope: "community-keys-revoke", windowMs: 6e4, max: 20, perUser: true }),
  async (req, res) => {
    const community = await requireCommunityOwner(req, res);
    if (!community) return;
    const keyId = asString(req.params.keyId);
    if (!/^cak_[A-Za-z0-9_]+$/.test(keyId)) {
      res.status(400).json({ success: false, error: "Ge\xE7ersiz anahtar kimli\u011Fi. / Invalid key id." });
      return;
    }
    const revoked = await revokeKey(keyId, community.id);
    if (!revoked) {
      res.status(404).json({ success: false, error: "Anahtar bulunamad\u0131. / Key not found." });
      return;
    }
    res.json({ success: true, message: "Anahtar iptal edildi. / Key revoked." });
  }
);
app.post(
  "/api/integrations/webhook/test",
  requireAuth,
  rateLimit({ scope: "webhook-test", windowMs: 6e4, max: 10, perUser: true }),
  async (req, res) => {
    const platform = asString(req.body?.platform, 20).toLowerCase();
    const message = asString(req.body?.message, MAX_WEBHOOK_MESSAGE_LENGTH);
    const config = isPlainObject(req.body?.config) ? req.body.config : {};
    if (!platform || !message) {
      res.status(400).json({ success: false, error: "Platform ve mesaj parametresi zorunludur." });
      return;
    }
    try {
      if (platform === "discord") {
        if (!config.webhook_url) {
          res.status(400).json({ success: false, error: "L\xFCtfen ge\xE7erli bir Discord Webhook URL adresi girin." });
          return;
        }
        await sendDiscordWebhook(config.webhook_url, message, config.bot_name, config.avatar_url);
        res.json({ success: true, platform, message: "Discord test mesaj\u0131 ba\u015Far\u0131yla g\xF6nderildi!" });
        return;
      }
      if (platform === "jubbio") {
        await sendJubbioWebhook(config, message);
        res.json({ success: true, platform, message: "Jubbio test mesaj\u0131 ba\u015Far\u0131yla iletildi!" });
        return;
      }
      if (platform === "telegram") {
        if (!config.bot_token || !config.chat_id) {
          res.status(400).json({ success: false, error: "L\xFCtfen Telegram Bot Token ve Chat ID bilgilerini eksiksiz girin." });
          return;
        }
        await sendTelegramWebhook(config.bot_token, config.chat_id, message);
        res.json({ success: true, platform, message: "Telegram test bildirimi ba\u015Far\u0131yla g\xF6nderildi!" });
        return;
      }
      res.status(400).json({ success: false, error: "Desteklenmeyen platform tipi." });
    } catch (err) {
      res.status(502).json({ success: false, error: err?.message || "Webhook g\xF6nderilirken beklenmeyen bir hata olu\u015Ftu." });
    }
  }
);
app.post(
  "/api/integrations/webhook/send",
  requireAuth,
  rateLimit({ scope: "webhook-send", windowMs: 6e4, max: 20, perUser: true }),
  async (req, res) => {
    const settings = isPlainObject(req.body?.settings) ? req.body.settings : null;
    const message = asString(req.body?.message, MAX_WEBHOOK_MESSAGE_LENGTH);
    if (!settings || !message) {
      res.status(400).json({ success: false, error: "Eksik parametreler." });
      return;
    }
    const results = [];
    if (settings.discord?.enabled && settings.discord?.webhook_url) {
      try {
        await sendDiscordWebhook(settings.discord.webhook_url, message, settings.discord.bot_name, settings.discord.avatar_url);
        results.push({ platform: "discord", success: true });
      } catch (e) {
        results.push({ platform: "discord", success: false, error: e?.message });
      }
    }
    if (settings.jubbio?.enabled && (settings.jubbio?.webhook_url || settings.jubbio?.bot_token && settings.jubbio?.channel_id)) {
      try {
        await sendJubbioWebhook(settings.jubbio, message);
        results.push({ platform: "jubbio", success: true });
      } catch (e) {
        results.push({ platform: "jubbio", success: false, error: e?.message });
      }
    }
    if (settings.telegram?.enabled && settings.telegram?.bot_token && settings.telegram?.chat_id) {
      try {
        await sendTelegramWebhook(settings.telegram.bot_token, settings.telegram.chat_id, message);
        results.push({ platform: "telegram", success: true });
      } catch (e) {
        results.push({ platform: "telegram", success: false, error: e?.message });
      }
    }
    res.json({ success: true, results });
  }
);
function appOrigin() {
  const configured = env("APP_URL");
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
    }
  }
  return `http://localhost:${PORT}`;
}
app.get("/api/auth/github/url", rateLimit({ scope: "oauth-url", windowMs: 6e4, max: 30 }), (_req, res) => {
  const clientId = env("GITHUB_CLIENT_ID");
  if (!clientId) {
    res.status(503).json({ error: "GitHub OAuth yap\u0131land\u0131r\u0131lmam\u0131\u015F (GITHUB_CLIENT_ID eksik)." });
    return;
  }
  const redirectUri = `${appOrigin()}/api/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    // Least privilege: repository *write* access is never needed to list public repos.
    scope: "read:user user:email public_repo",
    // Signed, expiring state so the callback can detect CSRF / replayed authorizations.
    state: createSignedState()
  });
  res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}`, redirect_uri: redirectUri });
});
app.get(
  ["/api/auth/github/callback", "/api/auth/github/callback/"],
  rateLimit({ scope: "oauth-callback", windowMs: 6e4, max: 30 }),
  async (req, res) => {
    const code = asString(req.query.code, 200);
    const state = asString(req.query.state, 200);
    const clientId = env("GITHUB_CLIENT_ID");
    const clientSecret = env("GITHUB_CLIENT_SECRET");
    const renderBridge = (payload) => {
      const targetOrigin = appOrigin();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>Code4Ever GitHub OAuth</title>
    <style>
      body { background: #09090b; color: #f4f4f5; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { background: #121215; padding: 24px; border-radius: 16px; border: 1px solid #27272a; text-align: center; max-width: 420px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>${payload.ok ? "Code4Ever GitHub E\u015Fle\u015Fmesi Ba\u015Far\u0131l\u0131!" : "GitHub Ba\u011Flant\u0131s\u0131 Tamamlanamad\u0131"}</h2>
      <p>${escapeHtml(payload.ok ? "Y\xF6nlendiriliyorsunuz..." : payload.error || "L\xFCtfen tekrar deneyin.")}</p>
      <script>
        (function () {
          var payload = ${jsonForScript(payload)};
          if (window.opener) {
            // SECURITY: never postMessage to "*" \u2014 that hands the GitHub profile (and any
            // future token) to whatever page happens to have opened this popup.
            window.opener.postMessage(
              { type: payload.ok ? 'OAUTH_AUTH_SUCCESS' : 'OAUTH_AUTH_ERROR', user: payload.user, error: payload.error },
              ${jsonForScript(targetOrigin)}
            );
            window.close();
          } else {
            window.location.href = '/';
          }
        })();
      </script>
    </div>
  </body>
</html>`);
    };
    if (!verifySignedState(state)) {
      renderBridge({ ok: false, error: "G\xFCvenlik do\u011Frulamas\u0131 ba\u015Far\u0131s\u0131z (ge\xE7ersiz veya s\xFCresi dolmu\u015F state)." });
      return;
    }
    if (!code || !clientId || !clientSecret) {
      renderBridge({ ok: false, error: "GitHub OAuth yap\u0131land\u0131rmas\u0131 eksik." });
      return;
    }
    try {
      const tokenRes = await safeFetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
        allowedHosts: ["github.com"],
        timeoutMs: 1e4
      });
      const tokenData = JSON.parse(tokenRes.text || "{}");
      if (!tokenData.access_token) {
        renderBridge({ ok: false, error: "GitHub yetkilendirme kodu do\u011Frulanamad\u0131." });
        return;
      }
      const userRes = await safeFetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "Code4Ever-Platform",
          Accept: "application/vnd.github+json"
        },
        allowedHosts: ["api.github.com"],
        timeoutMs: 1e4
      });
      const githubUser = JSON.parse(userRes.text || "{}");
      renderBridge({
        ok: true,
        user: {
          login: asString(githubUser.login, 80),
          name: asString(githubUser.name, 120),
          avatar_url: asString(githubUser.avatar_url, 500),
          bio: asString(githubUser.bio, 300),
          html_url: asString(githubUser.html_url, 300)
        }
      });
    } catch (err) {
      console.error("GitHub token exchange error:", err?.message);
      renderBridge({ ok: false, error: "GitHub ile ileti\u015Fim kurulamad\u0131." });
    }
  }
);
app.get("/api/github/repos", rateLimit({ scope: "github-repos", windowMs: 6e4, max: 30 }), async (req, res) => {
  const username = asString(req.query.username, 40) || "octocat";
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(username)) {
    res.status(400).json({ error: "Ge\xE7ersiz GitHub kullan\u0131c\u0131 ad\u0131." });
    return;
  }
  try {
    const response = await safeFetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=15`,
      {
        headers: { "User-Agent": "Code4Ever-Platform", Accept: "application/vnd.github+json" },
        allowedHosts: ["api.github.com"],
        timeoutMs: 1e4,
        maxResponseBytes: 512 * 1024
      }
    );
    if (!response.ok) {
      res.status(response.status === 404 ? 404 : 502).json({ error: "GitHub kullan\u0131c\u0131s\u0131 veya depolar\u0131 bulunamad\u0131." });
      return;
    }
    res.json({ success: true, username, repos: JSON.parse(response.text || "[]") });
  } catch {
    res.status(502).json({ error: "GitHub sunucusuna ba\u011Flan\u0131rken hata olu\u015Ftu." });
  }
});
var MAX_CHAT_MESSAGES = 20;
var MAX_CHAT_CHARS = 6e3;
app.post(
  "/api/everychat",
  requireAuth,
  rateLimit({ scope: "everychat", windowMs: 5 * 6e4, max: 25, perUser: true }),
  async (req, res) => {
    const groqKey = env("GROQ_API_KEY");
    if (!groqKey) {
      res.status(503).json({ error: "Groq API Key hen\xFCz ayarlanmam\u0131\u015F. L\xFCtfen sunucunuza GROQ_API_KEY ekleyin." });
      return;
    }
    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (rawMessages.length === 0) {
      res.status(400).json({ error: "Ge\xE7erli bir sohbet mesaj listesi gerekli." });
      return;
    }
    const messages = rawMessages.slice(-MAX_CHAT_MESSAGES).filter((entry) => isPlainObject(entry) && typeof entry.content === "string").map((entry) => ({
      role: ["user", "assistant"].includes(entry.role) ? entry.role : "user",
      content: asString(entry.content, 4e3)
    })).filter((entry) => entry.content.length > 0);
    const totalChars = messages.reduce((sum, entry) => sum + entry.content.length, 0);
    if (messages.length === 0 || totalChars > MAX_CHAT_CHARS) {
      res.status(400).json({ error: "Sohbet i\xE7eri\u011Fi \xE7ok uzun veya ge\xE7ersiz." });
      return;
    }
    try {
      const groqRes = await safeFetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: env("GROQ_MODEL", "llama-3.3-70b-versatile"),
          messages: [
            {
              role: "system",
              content: 'Sen Code4Ever platformunun "EveryChat (Beta)" yapay zeka asistan\u0131s\u0131n. Yaz\u0131l\u0131m, mimari, kodlama ve teknoloji alanlar\u0131nda son derece uzman, nazik ve h\u0131zl\u0131 yan\u0131tlar verirsin.'
            },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 2048
        }),
        allowedHosts: ["api.groq.com"],
        timeoutMs: 45e3,
        maxResponseBytes: 256 * 1024
      });
      if (!groqRes.ok) {
        console.warn("Groq API error:", groqRes.status, groqRes.text.slice(0, 300));
        res.status(502).json({ error: `EveryChat sa\u011Flay\u0131c\u0131s\u0131 yan\u0131t veremedi (${groqRes.status}).` });
        return;
      }
      const data = JSON.parse(groqRes.text || "{}");
      res.json({ success: true, reply: data.choices?.[0]?.message?.content || "Yan\u0131t al\u0131namad\u0131.", model: data.model });
    } catch (err) {
      console.warn("EveryChat error:", err?.message);
      res.status(502).json({ error: "EveryChat sunucu hatas\u0131." });
    }
  }
);
app.post("/api/rate-limit-test", rateLimit({ scope: "rate-limit-test", windowMs: 6e4, max: 60 }), (req, res) => {
  res.json({ status: "allowed", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/license/validate", rateLimit({ scope: "license", windowMs: 6e4, max: 20 }), (req, res) => {
  const licenseKey = asString(req.body?.licenseKey, 64);
  if (!licenseKey) {
    res.status(400).json({ valid: false, error: "License key string is required" });
    return;
  }
  if (!/^C4E-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(licenseKey)) {
    res.status(400).json({ valid: false, error: "Invalid license format" });
    return;
  }
  res.json({
    valid: true,
    tier: licenseKey.toUpperCase().includes("PRO") ? "Pro" : "Developer",
    rate_limit: licenseKey.toUpperCase().includes("PRO") ? 5e3 : 1e3,
    expires_at: "2027-12-31T23:59:59Z"
  });
});
var BYNOGAME_STREAM_ID = env("BYNOGAME_STREAM_ID", "5595ad22-dd5a-47c2-93ba-d7bf9a3f85ed");
var BYNOGAME_DONATE_URL = env("BYNOGAME_DONATE_URL", "https://donate.bynogame.com/nylithra");
var BYNOGAME_WEBHOOK_SECRET = env("BYNOGAME_WEBHOOK_SECRET");
var DATA_DIR = env(
  "DATA_DIR",
  // Serverless: everything outside /tmp is read-only and /tmp is wiped between invocations,
  // so the ledger degrades to a per-invocation cache rather than crashing on every write.
  isServerless() ? import_path.default.join(import_node_os.default.tmpdir(), "c4e-data") : import_path.default.join(process.cwd(), "data")
);
var BYNOGAME_DONATIONS_FILE = import_path.default.join(DATA_DIR, "bynogame_donations.json");
var MAX_DONATION_RECORDS = 5e3;
function loadByNoGameDonations() {
  try {
    if (import_fs.default.existsSync(BYNOGAME_DONATIONS_FILE)) {
      const parsed = JSON.parse(import_fs.default.readFileSync(BYNOGAME_DONATIONS_FILE, "utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error("ByNoGame donations load error:", e);
  }
  return [];
}
function saveByNoGameDonations(donations) {
  try {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    const trimmed = donations.slice(0, MAX_DONATION_RECORDS);
    const tempFile = `${BYNOGAME_DONATIONS_FILE}.${process.pid}.tmp`;
    import_fs.default.writeFileSync(tempFile, JSON.stringify(trimmed, null, 2), { encoding: "utf-8", mode: 384 });
    import_fs.default.renameSync(tempFile, BYNOGAME_DONATIONS_FILE);
  } catch (e) {
    console.error("ByNoGame donations save error:", e);
  }
}
function publicDonationView(record) {
  return {
    id: record.id,
    username: record.username,
    amount: record.amount,
    currency: record.currency,
    timestamp: record.timestamp,
    verified: record.verified,
    claimedAt: record.claimedAt
  };
}
function resolveActingUsername(req, requested) {
  const sessionUsername = normalizeUsername(req.auth?.username);
  const requestedUsername = normalizeUsername(requested);
  if (req.auth?.isAdmin) {
    return requestedUsername || sessionUsername || null;
  }
  if (sessionUsername) {
    return sessionUsername;
  }
  return requestedUsername || null;
}
app.get("/api/bynogame/config", (_req, res) => {
  res.json({
    streamId: BYNOGAME_STREAM_ID,
    donateUrl: BYNOGAME_DONATE_URL,
    streamer: "nylithra",
    rewardRole: "Spark",
    rewardBadge: "Spark Destek\xE7i",
    storageMaxMB: 250
  });
});
app.post(
  "/api/bynogame/check-donation",
  requireAuth,
  rateLimit({ scope: "donation-check", windowMs: 6e4, max: 15, perUser: true }),
  async (req, res) => {
    const username = resolveActingUsername(req, req.body?.username);
    if (!username) {
      res.status(400).json({ success: false, error: "Kullan\u0131c\u0131 ad\u0131 belirlenemedi." });
      return;
    }
    const donations = loadByNoGameDonations();
    const matched = donations.find(
      (d) => d.streamId.toLowerCase() === BYNOGAME_STREAM_ID.toLowerCase() && d.verified === true && (d.usernameNormalized === username || d.username.trim().toLowerCase() === username)
    );
    if (matched) {
      if (!matched.claimedAt) {
        matched.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
        saveByNoGameDonations(donations);
      }
      res.json({
        success: true,
        hasDonation: true,
        donation: publicDonationView(matched),
        streamId: BYNOGAME_STREAM_ID,
        message: "Ba\u011F\u0131\u015F\u0131n\u0131z do\u011Fruland\u0131! Spark Destek\xE7isi rozetiniz ve 250MB y\xFCkleme yetkiniz tan\u0131mland\u0131."
      });
      return;
    }
    res.json({
      success: true,
      hasDonation: false,
      streamId: BYNOGAME_STREAM_ID,
      username,
      message: `Hen\xFCz @${username} ad\u0131na do\u011Frulanm\u0131\u015F bir ba\u011F\u0131\u015F bulunamad\u0131. Ba\u011F\u0131\u015F yapt\u0131ysan\u0131z referans/i\u015Flem numaran\u0131z\u0131 girerek bildirimde bulunabilirsiniz.`
    });
  }
);
app.post(
  "/api/bynogame/claim-donation",
  requireAuth,
  rateLimit({ scope: "donation-claim", windowMs: 60 * 6e4, max: 5, perUser: true }),
  (req, res) => {
    const username = resolveActingUsername(req, req.body?.username);
    if (!username) {
      res.status(400).json({ success: false, error: "Kullan\u0131c\u0131 ad\u0131 belirlenemedi." });
      return;
    }
    const donations = loadByNoGameDonations();
    const referenceCode = asString(req.body?.reference_code, 120);
    const newRecord = {
      id: `bng_claim_${Date.now()}_${import_node_crypto3.default.randomBytes(3).toString("hex")}`,
      streamId: BYNOGAME_STREAM_ID,
      username,
      usernameNormalized: username,
      amount: asString(req.body?.amount, 40) || "Destek",
      currency: "TL",
      message: asString(req.body?.message, 400) || (referenceCode ? `Referans: ${referenceCode}` : "Ba\u011F\u0131\u015F Bildirimi"),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      // NEVER verified on creation: verification is an administrator decision.
      verified: false
    };
    donations.unshift(newRecord);
    saveByNoGameDonations(donations);
    res.json({ success: true, recorded: publicDonationView(newRecord) });
  }
);
app.post("/api/bynogame/approve-donation", requireAdmin, async (req, res) => {
  const claimId = asString(req.body?.claimId, 80);
  const username = normalizeUsername(req.body?.username);
  const adminUsername = normalizeUsername(req.auth?.username) || "admin";
  if (!claimId && !username) {
    res.status(400).json({ success: false, error: "claimId veya username gereklidir." });
    return;
  }
  const donations = loadByNoGameDonations();
  let matched = donations.find((d) => claimId && d.id === claimId || username && d.usernameNormalized === username);
  if (!matched && username) {
    matched = {
      id: `bng_manual_${Date.now()}`,
      streamId: BYNOGAME_STREAM_ID,
      username,
      usernameNormalized: username,
      amount: "Destek",
      currency: "TL",
      message: `Y\xF6netici (@${adminUsername}) taraf\u0131ndan onayland\u0131`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      verified: true,
      claimedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    donations.unshift(matched);
  } else if (matched) {
    matched.verified = true;
    matched.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (!matched) {
    res.status(404).json({ success: false, error: "Ba\u011F\u0131\u015F kayd\u0131 bulunamad\u0131." });
    return;
  }
  saveByNoGameDonations(donations);
  const tierApplied = await setSupporterTier(matched.usernameNormalized, "spark");
  res.json({ success: true, approved: publicDonationView(matched), supporter_tier_applied: tierApplied });
});
app.post("/api/bynogame/webhook", rateLimit({ scope: "donation-webhook", windowMs: 6e4, max: 60 }), (req, res) => {
  if (!BYNOGAME_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Webhook devre d\u0131\u015F\u0131: BYNOGAME_WEBHOOK_SECRET tan\u0131ml\u0131 de\u011Fil." });
    return;
  }
  const rawBody = req.rawBody;
  const signature = String(req.headers["x-c4e-signature"] || req.headers["x-signature"] || "").replace(/^sha256=/i, "");
  const expected = rawBody ? hmacHex(BYNOGAME_WEBHOOK_SECRET, rawBody.toString("utf8")) : "";
  if (!rawBody || !signature || !safeEquals(signature, expected)) {
    res.status(401).json({ error: "Ge\xE7ersiz webhook imzas\u0131." });
    return;
  }
  const payload = req.body || {};
  const donor = normalizeUsername(payload.username || payload.donor || payload.user_name || payload.name);
  if (!donor) {
    res.status(400).json({ error: "Donor username is required" });
    return;
  }
  const donations = loadByNoGameDonations();
  const newDonation = {
    id: `bng_${Date.now()}_${import_node_crypto3.default.randomBytes(3).toString("hex")}`,
    streamId: asString(payload.streamId || payload.stream_id, 80) || BYNOGAME_STREAM_ID,
    username: donor,
    usernameNormalized: donor,
    amount: asString(payload.amount ?? payload.total, 40) || "0",
    currency: asString(payload.currency, 10) || "TL",
    message: asString(payload.message ?? payload.note, 400),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    verified: true
  };
  donations.unshift(newDonation);
  saveByNoGameDonations(donations);
  res.json({ success: true, recorded: publicDonationView(newDonation) });
});
app.post("/api/bynogame/register-donation", requireAdmin, (req, res) => {
  const username = normalizeUsername(req.body?.username);
  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }
  const donations = loadByNoGameDonations();
  const record = {
    id: `bng_reg_${Date.now()}`,
    streamId: BYNOGAME_STREAM_ID,
    username,
    usernameNormalized: username,
    amount: asString(req.body?.amount, 40) || "Destek",
    currency: "TL",
    message: asString(req.body?.message, 400) || "ByNoGame Ba\u011F\u0131\u015F\u0131",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    verified: true
  };
  donations.unshift(record);
  saveByNoGameDonations(donations);
  res.json({ success: true, donation: publicDonationView(record) });
});
app.get("/api/bynogame/donations", requireAdmin, (_req, res) => {
  const donations = loadByNoGameDonations();
  res.json({
    streamId: BYNOGAME_STREAM_ID,
    total: donations.length,
    donations: donations.slice(0, 50).map(publicDonationView)
  });
});
async function setSupporterTier(username, tier) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const response = await safeFetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ supporter_tier: tier, updated_at: (/* @__PURE__ */ new Date()).toISOString() }),
        timeoutMs: 1e4
      }
    );
    return response.ok;
  } catch (err) {
    console.warn("setSupporterTier error:", err?.message);
    return false;
  }
}
app.post(
  "/api/bynogame/claim-perks",
  requireAuth,
  rateLimit({ scope: "donation-perks", windowMs: 6e4, max: 10, perUser: true }),
  async (req, res) => {
    const username = resolveActingUsername(req, req.body?.username);
    if (!username) {
      res.status(400).json({ success: false, message: "Kullan\u0131c\u0131 ad\u0131 belirlenemedi." });
      return;
    }
    const verified = req.auth?.isAdmin === true || loadByNoGameDonations().some((donation) => donation.verified === true && donation.usernameNormalized === username);
    if (!verified) {
      res.status(403).json({
        success: false,
        message: "Do\u011Frulanm\u0131\u015F bir ba\u011F\u0131\u015F kayd\u0131 bulunamad\u0131. Ba\u011F\u0131\u015F\u0131n\u0131z y\xF6netici onay\u0131ndan sonra otomatik tan\u0131mlan\u0131r."
      });
      return;
    }
    const applied = await setSupporterTier(username, "spark");
    if (!applied) {
      res.status(503).json({
        success: false,
        message: "Spark ayr\u0131cal\u0131klar\u0131 \u015Fu anda tan\u0131mlanamad\u0131 (SUPABASE_SERVICE_ROLE_KEY eksik). L\xFCtfen y\xF6neticiyle ileti\u015Fime ge\xE7in."
      });
      return;
    }
    res.json({ success: true, username, supporter_tier: "spark", message: "Spark Destek\xE7i ayr\u0131cal\u0131klar\u0131 tan\u0131mland\u0131!" });
  }
);
app.get("/api/bynogame/my-donations", requireAuth, (req, res) => {
  const username = resolveActingUsername(req, void 0);
  const donations = username ? loadByNoGameDonations().filter((d) => d.usernameNormalized === username) : [];
  res.json({ success: true, total: donations.length, donations: donations.slice(0, 50).map(publicDonationView) });
});
function safeMailbox(value) {
  const raw = asString(value, 80);
  return /^[A-Za-z0-9 _./-]{1,80}$/.test(raw) ? raw : "INBOX";
}
app.get("/api/admin/mail/status", requireAdmin, (_req, res) => {
  res.json({ success: true, ...describeMailConfig() });
});
app.post(
  "/api/admin/mail/verify",
  requireAdmin,
  rateLimit({ scope: "mail-verify", windowMs: 6e4, max: 6, perUser: true }),
  async (_req, res) => {
    const [smtp, imap] = await Promise.all([verifySmtp(), verifyImap()]);
    res.json({ success: true, smtp, imap });
  }
);
app.get(
  "/api/admin/mail/inbox",
  requireAdmin,
  rateLimit({ scope: "mail-inbox", windowMs: 6e4, max: 30, perUser: true }),
  async (req, res) => {
    if (!getImapConfig()) {
      res.status(503).json({
        success: false,
        error: imapUnavailableReason() || "IMAP kullan\u0131lam\u0131yor.",
        serverless: isServerless()
      });
      return;
    }
    try {
      const messages = await fetchInbox({
        mailbox: safeMailbox(req.query.mailbox),
        limit: Number(req.query.limit) || 25
      });
      res.json({ success: true, count: messages.length, messages });
    } catch (error) {
      res.status(502).json({ success: false, error: `IMAP hatas\u0131: ${String(error?.message || error).slice(0, 300)}` });
    }
  }
);
app.get(
  "/api/admin/mail/message/:uid",
  requireAdmin,
  rateLimit({ scope: "mail-message", windowMs: 6e4, max: 60, perUser: true }),
  async (req, res) => {
    if (!getImapConfig()) {
      res.status(503).json({
        success: false,
        error: imapUnavailableReason() || "IMAP kullan\u0131lam\u0131yor.",
        serverless: isServerless()
      });
      return;
    }
    const uid = Number(req.params.uid);
    if (!Number.isInteger(uid) || uid <= 0) {
      res.status(400).json({ success: false, error: "Ge\xE7ersiz mesaj kimli\u011Fi." });
      return;
    }
    try {
      const message = await fetchMessage(uid, safeMailbox(req.query.mailbox));
      if (!message) {
        res.status(404).json({ success: false, error: "Mesaj bulunamad\u0131." });
        return;
      }
      res.json({ success: true, message });
    } catch (error) {
      res.status(502).json({ success: false, error: `IMAP hatas\u0131: ${String(error?.message || error).slice(0, 300)}` });
    }
  }
);
app.get(
  "/api/admin/mail/resolve/:username",
  requireAdmin,
  rateLimit({ scope: "mail-resolve", windowMs: 6e4, max: 60, perUser: true }),
  async (req, res) => {
    const recipient = await resolveRecipientByUsername(asString(req.params.username, 40));
    if (!recipient) {
      res.status(404).json({
        success: false,
        error: "Bu kullan\u0131c\u0131 ad\u0131na ait bir e-posta adresi bulunamad\u0131."
      });
      return;
    }
    res.json({ success: true, recipient });
  }
);
app.post(
  "/api/admin/mail/send",
  requireAdmin,
  rateLimit({ scope: "mail-send", windowMs: 6e4, max: 20, perUser: true }),
  async (req, res) => {
    if (!getSmtpConfig()) {
      res.status(503).json({
        success: false,
        error: "SMTP yap\u0131land\u0131r\u0131lmam\u0131\u015F. MAIL_SMTP_HOST / MAIL_SMTP_USER / MAIL_SMTP_PASS tan\u0131mlay\u0131n."
      });
      return;
    }
    const body = isPlainObject(req.body) ? req.body : {};
    let toAddress = "";
    let recipientName = asString(body.recipient_name, 80);
    const username = asString(body.username, 40);
    if (username) {
      const recipient = await resolveRecipientByUsername(username);
      if (!recipient) {
        res.status(404).json({
          success: false,
          error: `"${username}" kullan\u0131c\u0131s\u0131na ait bir e-posta adresi bulunamad\u0131.`
        });
        return;
      }
      toAddress = recipient.email;
      recipientName = recipientName || recipient.displayName;
    } else {
      toAddress = asString(body.to, 254);
    }
    const subject = asString(body.subject, 180);
    const message = asString(body.body ?? body.message, 2e4);
    if (!subject.trim()) {
      res.status(422).json({ success: false, field: "subject", error: "Konu zorunludur." });
      return;
    }
    if (!message.trim()) {
      res.status(422).json({ success: false, field: "body", error: "Mesaj g\xF6vdesi zorunludur." });
      return;
    }
    let callToAction;
    const ctaLabel = asString(body.cta_label, 60);
    const ctaUrl = asString(body.cta_url, 500);
    if (ctaLabel || ctaUrl) {
      if (!ctaLabel || !ctaUrl) {
        res.status(422).json({
          success: false,
          field: "cta",
          error: "Buton i\xE7in hem etiket hem ba\u011Flant\u0131 gereklidir."
        });
        return;
      }
      if (!/^https?:\/\//i.test(ctaUrl)) {
        res.status(422).json({
          success: false,
          field: "cta_url",
          error: "Buton ba\u011Flant\u0131s\u0131 http:// veya https:// ile ba\u015Flamal\u0131d\u0131r."
        });
        return;
      }
      callToAction = { label: ctaLabel, url: ctaUrl };
    }
    const result = await sendMail({
      to: toAddress,
      subject,
      heading: asString(body.heading, 160) || subject,
      body: message,
      recipientName: recipientName || void 0,
      callToAction,
      footnote: asString(body.footnote, 300) || void 0
    });
    if (!result.ok) {
      res.status(502).json({ success: false, error: result.error });
      return;
    }
    res.json({
      success: true,
      message: `E-posta ${toAddress} adresine g\xF6nderildi.`,
      to: toAddress,
      messageId: result.messageId
    });
  }
);
app.post(
  "/api/admin/mail/preview",
  requireAdmin,
  rateLimit({ scope: "mail-preview", windowMs: 6e4, max: 60, perUser: true }),
  (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const subject = asString(body.subject, 180) || "Konu";
    const text = asString(body.body ?? body.message, 2e4) || "Mesaj g\xF6vdesi burada g\xF6r\xFCn\xFCr.";
    const ctaLabel = asString(body.cta_label, 60);
    const ctaUrl = asString(body.cta_url, 500);
    const html = renderMailHtml({
      heading: asString(body.heading, 160) || subject,
      preheader: text.replace(/\s+/g, " ").slice(0, 120),
      paragraphs: text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      recipientName: asString(body.recipient_name, 80) || void 0,
      callToAction: ctaLabel && /^https?:\/\//i.test(ctaUrl) ? { label: ctaLabel, url: ctaUrl } : void 0,
      footnote: asString(body.footnote, 300) || void 0,
      // The preview runs in the browser, where cid: cannot resolve; point at the served file.
      logoCid: "PREVIEW"
    }).replace('src="cid:PREVIEW"', 'src="/email-logo.png"');
    res.json({ success: true, html });
  }
);
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, error: "not_found" });
});
app.use("/api", (err, _req, res, _next) => {
  if (err?.type === "entity.too.large") {
    res.status(413).json({ success: false, error: "payload_too_large" });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ success: false, error: "invalid_json" });
    return;
  }
  console.error("Unhandled API error:", err?.message || err);
  res.status(500).json({ success: false, error: "internal_error" });
});
var server_default = app;
async function startServer() {
  if (!IS_PRODUCTION) {
    const viteSpecifier = "vite";
    const { createServer: createViteServer } = await import(
      /* @vite-ignore */
      viteSpecifier
    );
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(
      import_express.default.static(distPath, {
        index: false,
        maxAge: "1h",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("sw.js") || filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        }
      })
    );
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Code4Ever server running on http://0.0.0.0:${PORT}`);
    if (!supabaseConfigured()) {
      console.warn("[c4e] SUPABASE_URL / SUPABASE_ANON_KEY missing: authenticated endpoints will return 503.");
    }
    if (!BYNOGAME_WEBHOOK_SECRET) {
      console.warn("[c4e] BYNOGAME_WEBHOOK_SECRET missing: the donation webhook is disabled.");
    }
  });
}
if (!isServerless()) {
  startServer();
}

// src/server/vercelEntry.ts
var handlerError = null;
var resolvedApp = null;
try {
  if (typeof server_default !== "function") {
    throw new Error(`Beklenen Express handler'\u0131 bulunamad\u0131 (tip: ${typeof server_default}).`);
  }
  resolvedApp = server_default;
} catch (error) {
  handlerError = error instanceof Error ? error : new Error(String(error));
  console.error("[c4e] Sunucu uygulamas\u0131 y\xFCklenemedi:", handlerError.stack || handlerError.message);
}
function handler(req, res) {
  if (resolvedApp) {
    resolvedApp(req, res);
    return;
  }
  res.statusCode = 500;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      success: false,
      error: "server_init_failed",
      message: "Sunucu uygulamas\u0131 ba\u015Flat\u0131lamad\u0131. Ayr\u0131nt\u0131l\u0131 y\u0131\u011F\u0131n izi i\xE7in da\u011F\u0131t\u0131m sa\u011Flay\u0131c\u0131s\u0131n\u0131n Runtime Logs b\xF6l\xFCm\xFCne bak\u0131n.",
      detail: handlerError?.message || "bilinmeyen hata"
    })
  );
}
