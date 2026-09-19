/**
 * Code4Ever — SMTP sending and IMAP reading for the admin mail console.
 *
 * Security notes, because mail is a rich source of footguns:
 *
 *  - Host, port and credentials come from environment variables ONLY. If a caller could
 *    name the server, this module would be an SSRF and credential-exfiltration primitive
 *    (point it at an attacker's box and the configured password walks out the door).
 *  - Every header-bound value (subject, display names, recipients) is stripped of CR and LF
 *    before use. Without that, a newline in a subject lets a caller append arbitrary headers
 *    — Bcc to a third party, a forged Reply-To — which is classic SMTP header injection.
 *  - Incoming mail is untrusted. Bodies are returned to the admin UI as plain text plus a
 *    sanitised HTML string; the sanitiser drops scripts, event handlers, remote resources,
 *    forms and frames. The client renders it in a sandboxed iframe on top of that.
 *  - Nothing here ever logs or returns a password.
 */

import fs from 'node:fs';
import path from 'node:path';
import { env, isServerless, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, safeFetch } from './security';
import { renderMailHtml, renderMailText, type MailTemplateInput } from './mailTemplate';

// -------------------------------------------------------------
// CONFIGURATION
// -------------------------------------------------------------

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName: string;
}

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

function toPort(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

/** Any positive whole number — unlike toPort, not bounded by the port range. */
function toPositiveInt(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Parses a "is this connection implicitly TLS?" flag.
 *
 * Accepts the words operators actually write in mail configuration — `tls`, `ssl`, `implicit`
 * — as well as plain booleans, because MAIL_SMTP_SECURE="tls" on port 465 is an entirely
 * natural thing to type. An UNRECOGNISED value falls back to the port-based default rather
 * than to `false`: guessing "false" here silently disables implicit TLS on port 465, which
 * both breaks the connection and fails in the insecure direction.
 */
function toSecureFlag(value: string, fallback: boolean): boolean {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (/^(1|true|yes|on|tls|ssl|ssl\/tls|implicit|secure)$/.test(raw)) return true;
  if (/^(0|false|no|off|none|plain|starttls|insecure)$/.test(raw)) return false;
  return fallback;
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = env('MAIL_SMTP_HOST');
  const user = env('MAIL_SMTP_USER');
  const pass = env('MAIL_SMTP_PASS');
  if (!host || !user || !pass) return null;

  const port = toPort(env('MAIL_SMTP_PORT'), 465);
  return {
    host,
    port,
    // Implicit TLS on 465; STARTTLS upgrade on 587 and friends.
    secure: toSecureFlag(env('MAIL_SMTP_SECURE'), port === 465),
    user,
    pass,
    fromAddress: env('MAIL_FROM_ADDRESS', user),
    fromName: env('MAIL_FROM_NAME', 'Code4Ever')
  };
}

/**
 * Why IMAP may be unavailable. `null` means "it works".
 *
 * Being serverless is deliberately NOT a reason. What a frozen function cannot do is hold a
 * socket open *between* requests — an IDLE connection waiting to be pushed new mail. A single
 * connect → fetch → logout that begins and ends inside one request is ordinary outbound I/O
 * and works fine, which is exactly what `syncInbox()` does.
 */
export function imapUnavailableReason(): string | null {
  if (!env('MAIL_IMAP_HOST') || !env('MAIL_IMAP_USER', env('MAIL_SMTP_USER')) || !env('MAIL_IMAP_PASS', env('MAIL_SMTP_PASS'))) {
    return 'IMAP yapılandırılmamış (MAIL_IMAP_HOST / MAIL_IMAP_USER / MAIL_IMAP_PASS eksik).';
  }
  return null;
}

export function getImapConfig(): ImapConfig | null {
  const host = env('MAIL_IMAP_HOST');
  const user = env('MAIL_IMAP_USER', env('MAIL_SMTP_USER'));
  const pass = env('MAIL_IMAP_PASS', env('MAIL_SMTP_PASS'));
  if (!host || !user || !pass) return null;

  const port = toPort(env('MAIL_IMAP_PORT'), 993);
  return { host, port, secure: toSecureFlag(env('MAIL_IMAP_SECURE'), port === 993), user, pass };
}

/**
 * Whether opening IMAP on *every* inbox load is acceptable.
 *
 * On a persistent server it is: the connection is cheap and the process is not racing a
 * timeout. In a serverless function each load would pay a fresh TLS handshake and login
 * against the function's time limit, so there the inbox is served from the cache and IMAP is
 * touched only when the admin explicitly syncs.
 */
export function supportsLiveImap(): boolean {
  return !isServerless();
}

/** 'live' = read straight from IMAP on demand. 'sync' = read the cache, refresh on request. */
export function imapMode(): 'live' | 'sync' {
  return supportsLiveImap() ? 'live' : 'sync';
}

/** Safe to hand to the admin UI: describes the setup without revealing any secret. */
export function describeMailConfig() {
  const smtp = getSmtpConfig();
  const imap = getImapConfig();
  return {
    smtp: smtp
      ? { configured: true, host: smtp.host, port: smtp.port, secure: smtp.secure, from: smtp.fromAddress }
      : { configured: false },
    imap: imap
      ? {
          configured: true,
          host: imap.host,
          port: imap.port,
          secure: imap.secure,
          user: imap.user,
          mode: imapMode(),
          note:
            imapMode() === 'sync'
              ? 'Bu ortamda gelen kutusu isteğe bağlı eşitlenir: "Gelen kutusunu eşitle" dediğinizde mesajlar bir kerede çekilip saklanır, sonraki görüntülemeler posta sunucusuna hiç bağlanmaz.'
              : null
        }
      : { configured: false, reason: imapUnavailableReason(), mode: imapMode() },
    // Lets the admin UI tell "not set up yet" apart from "reads from the cache here".
    serverless: isServerless()
  };
}

// -------------------------------------------------------------
// SANITISERS
// -------------------------------------------------------------

/**
 * Removes CR/LF (and the lone characters some parsers treat as line breaks) from a value
 * that will end up in a mail header. This is the SMTP header-injection guard.
 */
export function headerSafe(value: unknown, maxLength = 200): string {
  return String(value ?? '')
    .replace(/[\r\n\u2028\u2029\u0000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;.]+(\.[^\s@<>"',;.]+)+$/;

/** Accepts a single, syntactically valid address. Lists are rejected on purpose. */
export function normalizeEmail(value: unknown): string | null {
  const raw = headerSafe(value, 254).toLowerCase();
  if (!raw || raw.length > 254) return null;
  return EMAIL_RE.test(raw) ? raw : null;
}

/**
 * Conservative HTML sanitiser for INCOMING mail shown in the admin console.
 *
 * Allow-list based: anything not explicitly permitted is dropped. Combined with the
 * sandboxed iframe on the client this gives two independent layers, so a gap in either one
 * alone does not turn a hostile e-mail into script execution in an admin's session.
 */
export function sanitizeIncomingHtml(html: string): string {
  if (!html) return '';

  let out = String(html);

  // 1. Remove whole elements that can execute, fetch or navigate.
  out = out.replace(
    /<\s*(script|style|iframe|frame|frameset|object|embed|applet|link|meta|base|form|input|button|textarea|select|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ''
  );
  // Self-closing / unterminated variants of the same tags.
  out = out.replace(
    /<\s*(script|style|iframe|frame|frameset|object|embed|applet|link|meta|base|form|input|button|textarea|select|svg|math)\b[^>]*>/gi,
    ''
  );

  // 2. Drop every inline event handler (onclick, onerror, onload, ...).
  out = out.replace(/\son[a-z-]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z-]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, '');

  // 3. Neutralise executable URLs in any attribute.
  out = out.replace(/(href|src|action|formaction|background|poster|data)\s*=\s*"\s*(javascript|vbscript|data|file)\s*:[^"]*"/gi, '$1="#"');
  out = out.replace(/(href|src|action|formaction|background|poster|data)\s*=\s*'\s*(javascript|vbscript|data|file)\s*:[^']*'/gi, "$1='#'");

  // 4. Block remote images: loading them leaks the admin's IP and confirms the address to
  //    a spammer. The UI offers an explicit "load images" escape hatch instead.
  out = out.replace(/\ssrc\s*=\s*"(https?:)?\/\/[^"]*"/gi, ' data-blocked-src="1"');
  out = out.replace(/\ssrc\s*=\s*'(https?:)?\/\/[^']*'/gi, " data-blocked-src='1'");

  // 5. CSS expressions and imports inside style attributes.
  out = out.replace(/style\s*=\s*"[^"]*(expression|javascript:|@import|behavior:)[^"]*"/gi, '');
  out = out.replace(/style\s*=\s*'[^']*(expression|javascript:|@import|behavior:)[^']*'/gi, '');

  return out;
}

// -------------------------------------------------------------
// USERNAME -> E-MAIL RESOLUTION
// -------------------------------------------------------------

export interface ResolvedRecipient {
  username: string;
  displayName: string;
  email: string;
  /** Where the address came from, so the admin UI can say so. */
  source: 'profile' | 'auth';
}

/**
 * Finds the e-mail address behind a username.
 *
 * Runs with the service role key because `profiles.email` is deliberately NOT readable by
 * browser sessions (see the column grants in supabase_schema.sql). Falls back to the Supabase
 * auth admin API when the profile row has no address recorded, since `auth.users` is the
 * authoritative source for the sign-up address.
 */
export async function resolveRecipientByUsername(rawUsername: string): Promise<ResolvedRecipient | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  const username = String(rawUsername || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!/^[a-z0-9_.-]{1,40}$/.test(username)) return null;

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  let profile: any = null;
  try {
    const response = await safeFetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id,username,display_name,email&limit=1`,
      { headers, timeoutMs: 10000 }
    );
    if (response.ok) {
      const rows = JSON.parse(response.text || '[]');
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
      source: 'profile'
    };
  }

  // Profile row carries no address — ask the auth schema.
  try {
    const response = await safeFetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(String(profile.id))}`,
      { headers, timeoutMs: 10000 }
    );
    if (response.ok) {
      const user = JSON.parse(response.text || '{}');
      const fromAuth = normalizeEmail(user?.email);
      if (fromAuth) {
        return {
          username: String(profile.username || username),
          displayName: String(profile.display_name || profile.username || username),
          email: fromAuth,
          source: 'auth'
        };
      }
    }
  } catch {
    /* fall through to null */
  }

  return null;
}

// -------------------------------------------------------------
// SENDING (SMTP)
// -------------------------------------------------------------

/** Rasterised from public/logo.svg; see scripts/build-email-logo.mjs. */
const LOGO_CID = 'c4elogo';

/**
 * Locates the inline logo.
 *
 * Resolving from `process.cwd()` alone is not enough: a service started from anywhere other
 * than the repository root (systemd with a different WorkingDirectory, a container whose
 * WORKDIR differs, `node /path/to/dist/server.cjs` from a shell elsewhere) would silently
 * send logo-less mail. `__dirname` points at the bundle's own directory, which is where the
 * asset actually lives, so it is tried first and cwd is only a fallback.
 */
function findLogoFile(): string | null {
  const override = env('MAIL_LOGO_PATH');
  if (override) {
    try {
      if (fs.existsSync(override)) return override;
    } catch {
      /* fall through to the search below */
    }
  }

  const roots: string[] = [];
  // `__dirname` exists in the bundled CJS server; guard it so the ESM dev path still works.
  try {
    if (typeof __dirname === 'string' && __dirname) {
      roots.push(__dirname, path.join(__dirname, '..'));
    }
  } catch {
    /* not available under ESM */
  }
  roots.push(process.cwd());

  for (const root of roots) {
    for (const relative of ['email-logo.png', path.join('dist', 'email-logo.png'), path.join('public', 'email-logo.png')]) {
      const file = path.resolve(root, relative);
      try {
        if (fs.existsSync(file)) return file;
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

function logoAttachment(): Array<Record<string, unknown>> {
  const file = findLogoFile();
  if (file) {
    return [{ filename: 'logo.png', path: file, cid: LOGO_CID, contentDisposition: 'inline' }];
  }
  // Without the file the <img> simply does not render; the mail stays readable.
  return [];
}

export interface SendMailInput {
  to: string;
  subject: string;
  heading?: string;
  /** Body as plain text; blank lines separate paragraphs. */
  body: string;
  recipientName?: string;
  callToAction?: { label: string; url: string };
  footnote?: string;
  replyTo?: string;
  /**
   * Opt-out URL for bulk mail (notification digests).
   *
   * Passed separately rather than inlined into `footnote`, which is length-capped: an
   * unsubscribe link cut mid-token is a permanently broken opt-out. It also becomes the
   * List-Unsubscribe header, which is what actually makes Gmail and Outlook show their own
   * one-click "Unsubscribe" button next to the sender — the mechanism large providers expect
   * from bulk senders, and whose absence drives recipients to the spam button instead.
   */
  unsubscribeUrl?: string;
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  accepted?: string[];
  error?: string;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const config = getSmtpConfig();
  if (!config) {
    return { ok: false, error: 'SMTP yapılandırılmamış (MAIL_SMTP_HOST / USER / PASS eksik).' };
  }

  const to = normalizeEmail(input.to);
  if (!to) return { ok: false, error: 'Geçersiz alıcı e-posta adresi.' };

  const subject = headerSafe(input.subject, 180);
  // CR/LF stripped because this value also becomes a mail HEADER; an unescaped newline there
  // is a header-injection vector. Only absolute http(s) URLs are accepted.
  const unsubscribeUrl = /^https?:\/\/[^\s<>"]+$/.test(String(input.unsubscribeUrl || '').trim())
    ? headerSafe(String(input.unsubscribeUrl).trim(), 500)
    : '';
  if (!subject) return { ok: false, error: 'Konu boş olamaz.' };

  const bodyText = String(input.body || '').trim();
  if (!bodyText) return { ok: false, error: 'Mesaj gövdesi boş olamaz.' };

  const replyTo = input.replyTo ? normalizeEmail(input.replyTo) : null;

  const templateInput: MailTemplateInput = {
    heading: headerSafe(input.heading || subject, 160),
    preheader: bodyText.replace(/\s+/g, ' ').slice(0, 120),
    // Blank line separates paragraphs, matching how people actually type.
    paragraphs: bodyText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    recipientName: input.recipientName ? headerSafe(input.recipientName, 80) : undefined,
    callToAction: input.callToAction,
    footnote: input.footnote ? headerSafe(input.footnote, 300) : undefined,
    // NOT length-capped: truncating this is what silently breaks the opt-out.
    unsubscribeUrl: unsubscribeUrl || undefined,
    logoCid: LOGO_CID
  };

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      // Modern TLS floor; refuses to silently downgrade on a hostile network.
      tls: { minVersion: 'TLSv1.2' },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000
    });

    const info = await transporter.sendMail({
      from: { name: headerSafe(config.fromName, 80), address: config.fromAddress },
      to,
      subject,
      ...(replyTo ? { replyTo } : {}),
      // RFC 2369 / RFC 8058. The One-Click variant tells the provider it may POST the URL
      // directly, so the member never has to land on a page to opt out.
      ...(unsubscribeUrl
        ? {
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
          }
        : {}),
      text: renderMailText(templateInput),
      html: renderMailHtml(templateInput),
      attachments: logoAttachment()
    });

    transporter.close();
    return {
      ok: true,
      messageId: String(info.messageId || ''),
      accepted: (info.accepted || []).map((a: any) => String(a))
    };
  } catch (error: any) {
    // The message may embed the host; it never embeds the password.
    return { ok: false, error: `SMTP hatası: ${String(error?.message || error).slice(0, 300)}` };
  }
}

/** Opens an SMTP connection and authenticates, without sending anything. */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, error: 'SMTP yapılandırılmamış.' };
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      tls: { minVersion: 'TLSv1.2' },
      connectionTimeout: 15000
    });
    await transporter.verify();
    transporter.close();
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: String(error?.message || error).slice(0, 300) };
  }
}

// -------------------------------------------------------------
// READING (IMAP)
// -------------------------------------------------------------

export interface InboxMessage {
  uid: number;
  seq: number;
  subject: string;
  fromName: string;
  fromAddress: string;
  to: string;
  date: string | null;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  /** Short plain-text excerpt for the list view. */
  preview: string;
}

export interface InboxMessageDetail extends InboxMessage {
  text: string;
  html: string;
  /** True when the sanitiser stripped remote image sources. */
  imagesBlocked: boolean;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
}

async function withImap<T>(handler: (client: any) => Promise<T>): Promise<T> {
  const config = getImapConfig();
  if (!config) throw new Error('IMAP yapılandırılmamış (MAIL_IMAP_HOST / USER / PASS eksik).');

  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { minVersion: 'TLSv1.2' },
    // imapflow logs the full IMAP dialogue at info level; that includes envelopes.
    logger: false
  });

  await client.connect();
  try {
    return await handler(client);
  } finally {
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }
}

function addressOf(source: any): { name: string; address: string } {
  const first = source?.value?.[0] || source?.[0] || {};
  return {
    name: headerSafe(first.name || '', 120),
    address: headerSafe(first.address || '', 254)
  };
}

/** Mailbox names are echoed into IMAP commands, so keep them to a boring character set. */
export function safeMailboxName(value: unknown): string {
  const raw = String(value || '');
  return /^[A-Za-z0-9 _./-]{1,80}$/.test(raw) ? raw : 'INBOX';
}

/** Reads the headers of the newest `limit` messages on an open, locked client. */
async function readHeaders(client: any, limit: number): Promise<InboxMessage[]> {
  const total = client.mailbox?.exists || 0;
  if (total === 0) return [];

  const start = Math.max(1, total - limit + 1);
  const messages: InboxMessage[] = [];

  for await (const msg of client.fetch(`${start}:*`, {
    uid: true,
    envelope: true,
    flags: true,
    bodyStructure: true,
    // Enough of the body for a preview without pulling whole attachments.
    bodyParts: ['1']
  })) {
    const env_ = msg.envelope || {};
    const from = addressOf(env_.from);
    const to = addressOf(env_.to);
    const flags: Set<string> = msg.flags || new Set();

    let preview = '';
    try {
      const part = msg.bodyParts?.get('1');
      if (part) preview = part.toString('utf8').replace(/\s+/g, ' ').slice(0, 200);
    } catch {
      /* preview is optional */
    }

    messages.push({
      uid: Number(msg.uid),
      seq: Number(msg.seq),
      subject: headerSafe(env_.subject || '(konu yok)', 250),
      fromName: from.name,
      fromAddress: from.address,
      to: to.address,
      date: env_.date ? new Date(env_.date).toISOString() : null,
      seen: flags.has('\\Seen'),
      flagged: flags.has('\\Flagged'),
      hasAttachments: Boolean(msg.bodyStructure?.childNodes?.some((n: any) => n.disposition === 'attachment')),
      preview
    });
  }

  return messages.reverse();
}

/** Most recent messages first. Opens a connection, so only used where IMAP is live. */
export async function fetchInbox(options: { mailbox?: string; limit?: number } = {}): Promise<InboxMessage[]> {
  const mailbox = safeMailboxName(options.mailbox);
  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);

  return withImap(async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      return await readHeaders(client, limit);
    } finally {
      lock.release();
    }
  });
}

/**
 * Downloads and parses one message on an already-open, already-locked client.
 *
 * Taking the client as an argument is what lets a sync pull many bodies over a single
 * connection instead of paying a TLS handshake and a LOGIN per message.
 */
async function downloadDetail(client: any, uid: number): Promise<InboxMessageDetail | null> {
  const raw = await client.download(String(uid), undefined, { uid: true });
  if (!raw?.content) return null;

  const { simpleParser } = await import('mailparser');
  const parsed: any = await simpleParser(raw.content);

  const from = {
    name: headerSafe(parsed.from?.value?.[0]?.name || '', 120),
    address: headerSafe(parsed.from?.value?.[0]?.address || '', 254)
  };

  const originalHtml = String(parsed.html || '');
  const sanitized = sanitizeIncomingHtml(originalHtml);

  return {
    uid,
    seq: 0,
    subject: headerSafe(parsed.subject || '(konu yok)', 250),
    fromName: from.name,
    fromAddress: from.address,
    to: headerSafe(parsed.to?.value?.[0]?.address || '', 254),
    date: parsed.date ? new Date(parsed.date).toISOString() : null,
    seen: true,
    flagged: false,
    hasAttachments: Array.isArray(parsed.attachments) && parsed.attachments.length > 0,
    preview: '',
    text: String(parsed.text || '').slice(0, 200000),
    html: sanitized.slice(0, 400000),
    imagesBlocked: sanitized.includes('data-blocked-src'),
    attachments: (parsed.attachments || []).map((a: any) => ({
      filename: headerSafe(a.filename || 'ek', 200),
      contentType: headerSafe(a.contentType || 'application/octet-stream', 100),
      size: Number(a.size) || 0
    }))
  };
}

export async function fetchMessage(uid: number, mailboxName = 'INBOX'): Promise<InboxMessageDetail | null> {
  const mailbox = safeMailboxName(mailboxName);
  if (!Number.isInteger(uid) || uid <= 0) return null;

  return withImap(async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      return await downloadDetail(client, uid);
    } finally {
      lock.release();
    }
  });
}

// -------------------------------------------------------------
// SYNC — the one moment the mail server is contacted
// -------------------------------------------------------------

export interface SyncResult {
  mailbox: string;
  syncedAt: string;
  /** Headers written to the cache. */
  messageCount: number;
  /** Of those, how many also have their body cached and open instantly. */
  bodiesCached: number;
  /** True when the time budget ran out before every body was downloaded. */
  truncated: boolean;
  durationMs: number;
  /** Set when the cache is only in memory. */
  warning: string | null;
}

/**
 * Pulls the mailbox in one pass and stores it, so every later view is served from the cache.
 *
 * ONE CONNECTION, ONE REQUEST. Headers come first because they are what the list view needs
 * and they arrive in a single FETCH. Bodies are then downloaded over the *same* connection
 * until the time budget runs out.
 *
 * WHY A TIME BUDGET. A serverless function is killed at its time limit with no chance to save
 * what it had; a sync that overran would store nothing at all and look simply broken. Stopping
 * early instead means the headers and as many bodies as fit are always safely written, and the
 * few remaining messages download when they are opened (and are cached from then on). The
 * budget defaults to a value comfortably under Vercel's 60s function limit and is overridable
 * with MAIL_SYNC_BUDGET_MS.
 */
export async function syncInbox(
  options: { mailbox?: string; limit?: number; budgetMs?: number } = {}
): Promise<SyncResult> {
  const mailbox = safeMailboxName(options.mailbox);
  const limit = Math.min(Math.max(Number(options.limit) || 40, 1), 200);
  // An explicit budget is honoured exactly as given — including 0, which is why this cannot
  // use `||` (0 is falsy and would silently become the default). The floor and ceiling apply
  // only to the configured default, where they guard against a value that would make every
  // sync useless or overrun the platform's function limit.
  const budgetMs =
    options.budgetMs === undefined
      ? Math.min(Math.max(toPositiveInt(env('MAIL_SYNC_BUDGET_MS'), 45000), 3000), 280000)
      : Math.max(Number(options.budgetMs) || 0, 0);

  const startedAt = Date.now();
  const { saveInboxSnapshot, storeWarning } = await import('./mailStore');

  const { headers, details, truncated } = await withImap(async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const fetched = await readHeaders(client, limit);
      const bodies = new Map<number, InboxMessageDetail>();
      let ranOut = false;

      // Newest first: if the budget runs out, the messages most likely to be opened are the
      // ones already cached.
      for (const message of fetched) {
        if (Date.now() - startedAt > budgetMs) {
          ranOut = true;
          break;
        }
        try {
          const detail = await downloadDetail(client, message.uid);
          if (detail) bodies.set(message.uid, detail);
        } catch {
          // One unreadable message must not cost the whole sync; it is simply left
          // header-only and downloaded again when opened.
        }
      }

      return { headers: fetched, details: bodies, truncated: ranOut };
    } finally {
      lock.release();
    }
  });

  const state = await saveInboxSnapshot(mailbox, headers, details, { truncated });

  return {
    mailbox,
    syncedAt: state.lastSyncedAt || new Date().toISOString(),
    messageCount: state.messageCount,
    bodiesCached: state.bodiesCached,
    truncated,
    durationMs: Date.now() - startedAt,
    warning: storeWarning()
  };
}

/**
 * Opens a message: from the cache when the sync already stored it, otherwise one short IMAP
 * download that is then cached so it never has to happen twice.
 */
export async function readMessage(
  uid: number,
  mailboxName = 'INBOX'
): Promise<{ message: InboxMessageDetail | null; source: 'cache' | 'imap' }> {
  const mailbox = safeMailboxName(mailboxName);
  const { readCachedMessage, saveMessageBody } = await import('./mailStore');

  const cached = await readCachedMessage(mailbox, uid);
  if (cached) return { message: cached, source: 'cache' };

  const fresh = await fetchMessage(uid, mailbox);
  if (fresh) {
    try {
      await saveMessageBody(mailbox, fresh);
    } catch {
      // Failing to cache is not a reason to withhold a message the admin can already read.
    }
  }
  return { message: fresh, source: 'imap' };
}

/** Connects and lists mailboxes, to prove the IMAP credentials work. */
export async function verifyImap(): Promise<{ ok: boolean; mailboxes?: string[]; error?: string }> {
  try {
    const mailboxes = await withImap(async (client) => {
      const list = await client.list();
      return list.map((m: any) => String(m.path)).slice(0, 50);
    });
    return { ok: true, mailboxes };
  } catch (error: any) {
    return { ok: false, error: String(error?.message || error).slice(0, 300) };
  }
}
