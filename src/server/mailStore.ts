/**
 * Cache for synced inbox messages.
 *
 * WHY THIS EXISTS
 *
 * Reading mail used to require a live IMAP connection on every page load, which ruled the
 * inbox out on serverless entirely. It does not have to work that way. A frozen function
 * cannot hold a socket open *between* requests, but a single connect → fetch → logout inside
 * one request is ordinary outbound I/O. So the admin presses "sync", one request pulls the
 * messages, and they are written here; every later view reads this cache and never touches
 * the mail server.
 *
 * TWO BACKENDS
 *
 *   Supabase — the real one. Survives restarts and is shared by every function instance, so a
 *   sync performed by one invocation is visible to the next. Reached with the service role
 *   key; the tables deny every other role outright (see supabase_schema.sql).
 *
 *   In-memory — the fallback when no service key is configured. Correct on a persistent
 *   server, and honest rather than broken on serverless: it lasts as long as the warm
 *   instance does, and `storeIsDurable()` reports false so the UI can say so.
 *
 * WHAT IS STORED: message headers, the plain-text and *already sanitised* HTML body, and
 * attachment metadata. Attachment bytes are never stored — they stay on the mail server.
 */

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, safeFetch } from './security';
import type { InboxMessage, InboxMessageDetail } from './mail';

const CACHE_TABLE = 'admin_mail_cache';
const STATE_TABLE = 'admin_mail_sync_state';

/** Keeps one oversized message from crowding out a whole sync. */
const MAX_TEXT_BYTES = 200000;
const MAX_HTML_BYTES = 400000;

export interface SyncState {
  mailbox: string;
  lastSyncedAt: string | null;
  messageCount: number;
  bodiesCached: number;
  /** Why the last sync stopped early, if it did. */
  truncated: boolean;
}

export interface CachedInbox {
  messages: InboxMessage[];
  state: SyncState;
}

export function storeIsDurable(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

/** Explains a non-durable store, or null when the store is durable. */
export function storeWarning(): string | null {
  if (storeIsDurable()) return null;
  return 'Eşitlenen mesajlar yalnızca bellekte tutuluyor (SUPABASE_SERVICE_ROLE_KEY tanımlı değil). Sunucu yeniden başlarsa yeniden eşitlemeniz gerekir.';
}

// -------------------------------------------------------------
// SUPABASE BACKEND
// -------------------------------------------------------------

function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function rest(
  pathAndQuery: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<{ ok: boolean; status: number; rows: any[] }> {
  const response = await safeFetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: init.method || 'GET',
    headers: adminHeaders(init.headers),
    body: init.body,
    timeoutMs: 15000,
    // Bodies are capped per message, but a whole page of them still adds up.
    maxResponseBytes: 8 * 1024 * 1024
  });

  let rows: any[] = [];
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

// -------------------------------------------------------------
// IN-MEMORY BACKEND
// -------------------------------------------------------------

interface MemoryEntry {
  header: InboxMessage;
  detail: InboxMessageDetail | null;
}

const memoryMessages = new Map<string, Map<number, MemoryEntry>>();
const memoryState = new Map<string, SyncState>();

function memoryBox(mailbox: string): Map<number, MemoryEntry> {
  let box = memoryMessages.get(mailbox);
  if (!box) {
    box = new Map();
    memoryMessages.set(mailbox, box);
  }
  return box;
}

// -------------------------------------------------------------
// SERIALISATION
// -------------------------------------------------------------

function clip(value: unknown, max: number): string {
  return String(value || '').slice(0, max);
}

function rowFromHeader(mailbox: string, message: InboxMessage, syncedAt: string): Record<string, unknown> {
  return {
    mailbox,
    uid: message.uid,
    subject: clip(message.subject, 250),
    from_name: clip(message.fromName, 120),
    from_address: clip(message.fromAddress, 254),
    to_address: clip(message.to, 254),
    sent_at: message.date,
    seen: Boolean(message.seen),
    flagged: Boolean(message.flagged),
    has_attachments: Boolean(message.hasAttachments),
    preview: clip(message.preview, 400),
    synced_at: syncedAt
  };
}

function bodyFields(detail: InboxMessageDetail): Record<string, unknown> {
  return {
    body_text: clip(detail.text, MAX_TEXT_BYTES),
    body_html: clip(detail.html, MAX_HTML_BYTES),
    images_blocked: Boolean(detail.imagesBlocked),
    attachments: detail.attachments || [],
    body_synced_at: new Date().toISOString()
  };
}

function headerFromRow(row: any): InboxMessage {
  return {
    uid: Number(row.uid),
    seq: 0,
    subject: String(row.subject || '(konu yok)'),
    fromName: String(row.from_name || ''),
    fromAddress: String(row.from_address || ''),
    to: String(row.to_address || ''),
    date: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    seen: Boolean(row.seen),
    flagged: Boolean(row.flagged),
    hasAttachments: Boolean(row.has_attachments),
    preview: String(row.preview || '')
  };
}

/** `null` when the row carries only headers and the body has not been fetched yet. */
function detailFromRow(row: any): InboxMessageDetail | null {
  if (!row.body_synced_at) return null;
  return {
    ...headerFromRow(row),
    text: String(row.body_text || ''),
    html: String(row.body_html || ''),
    imagesBlocked: Boolean(row.images_blocked),
    attachments: Array.isArray(row.attachments) ? row.attachments : []
  };
}

// -------------------------------------------------------------
// WRITES
// -------------------------------------------------------------

/**
 * Replaces the cached view of a mailbox with what the sync just read.
 *
 * Messages deleted on the server must disappear here too, so rows whose UID is no longer
 * present are removed rather than left behind as ghosts.
 */
export async function saveInboxSnapshot(
  mailbox: string,
  messages: InboxMessage[],
  details: Map<number, InboxMessageDetail>,
  meta: { truncated: boolean }
): Promise<SyncState> {
  const syncedAt = new Date().toISOString();
  const keptUids = messages.map((m) => m.uid);

  const state: SyncState = {
    mailbox,
    lastSyncedAt: syncedAt,
    messageCount: messages.length,
    bodiesCached: details.size,
    truncated: meta.truncated
  };

  if (!storeIsDurable()) {
    const box = memoryBox(mailbox);
    const keep = new Set(keptUids);
    for (const uid of [...box.keys()]) if (!keep.has(uid)) box.delete(uid);
    for (const message of messages) {
      const existing = box.get(message.uid);
      box.set(message.uid, {
        header: message,
        // A sync that ran out of time leaves older bodies alone rather than dropping them.
        detail: details.get(message.uid) || existing?.detail || null
      });
    }
    memoryState.set(mailbox, state);
    return state;
  }

  const rows = messages.map((message) => {
    const row = rowFromHeader(mailbox, message, syncedAt);
    const detail = details.get(message.uid);
    return detail ? { ...row, ...bodyFields(detail) } : row;
  });

  if (rows.length > 0) {
    await rest(`${CACHE_TABLE}?on_conflict=mailbox,uid`, {
      method: 'POST',
      body: JSON.stringify(rows),
      // merge-duplicates keeps a body cached by an earlier sync when this row carries none.
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
    });
  }

  const gone =
    keptUids.length > 0
      ? `uid=not.in.(${keptUids.join(',')})`
      : // An empty mailbox clears every row rather than matching nothing.
        'uid=gt.0';
  await rest(`${CACHE_TABLE}?mailbox=eq.${encodeURIComponent(mailbox)}&${gone}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });

  await rest(`${STATE_TABLE}?on_conflict=mailbox`, {
    method: 'POST',
    body: JSON.stringify([
      {
        mailbox,
        last_synced_at: syncedAt,
        message_count: state.messageCount,
        bodies_cached: state.bodiesCached,
        truncated: state.truncated
      }
    ]),
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });

  return state;
}

/** Fills in a body fetched after the sync, so the message is only downloaded once. */
export async function saveMessageBody(mailbox: string, detail: InboxMessageDetail): Promise<void> {
  if (!storeIsDurable()) {
    const box = memoryBox(mailbox);
    const existing = box.get(detail.uid);
    box.set(detail.uid, { header: existing?.header || detail, detail });
    return;
  }

  await rest(`${CACHE_TABLE}?mailbox=eq.${encodeURIComponent(mailbox)}&uid=eq.${detail.uid}`, {
    method: 'PATCH',
    body: JSON.stringify(bodyFields(detail)),
    headers: { Prefer: 'return=minimal' }
  });
}

// -------------------------------------------------------------
// READS
// -------------------------------------------------------------

function emptyState(mailbox: string): SyncState {
  return { mailbox, lastSyncedAt: null, messageCount: 0, bodiesCached: 0, truncated: false };
}

export async function readInboxSnapshot(mailbox: string, limit = 50): Promise<CachedInbox> {
  const capped = Math.min(Math.max(limit, 1), 200);

  if (!storeIsDurable()) {
    const box = memoryBox(mailbox);
    const messages = [...box.values()]
      .map((e) => e.header)
      .sort((a, b) => b.uid - a.uid)
      .slice(0, capped);
    return { messages, state: memoryState.get(mailbox) || emptyState(mailbox) };
  }

  // Bodies are large and the list view never shows them, so they are left out of this select.
  const columns =
    'uid,subject,from_name,from_address,to_address,sent_at,seen,flagged,has_attachments,preview';
  const [cache, state] = await Promise.all([
    rest(
      `${CACHE_TABLE}?mailbox=eq.${encodeURIComponent(mailbox)}&select=${columns}&order=uid.desc&limit=${capped}`
    ),
    rest(`${STATE_TABLE}?mailbox=eq.${encodeURIComponent(mailbox)}&select=*&limit=1`)
  ]);

  const row = state.rows[0];
  return {
    messages: cache.ok ? cache.rows.map(headerFromRow) : [],
    state: row
      ? {
          mailbox,
          lastSyncedAt: row.last_synced_at || null,
          messageCount: Number(row.message_count || 0),
          bodiesCached: Number(row.bodies_cached || 0),
          truncated: Boolean(row.truncated)
        }
      : emptyState(mailbox)
  };
}

/** The full message when its body was cached; `null` when it still has to be downloaded. */
export async function readCachedMessage(mailbox: string, uid: number): Promise<InboxMessageDetail | null> {
  if (!storeIsDurable()) {
    return memoryBox(mailbox).get(uid)?.detail || null;
  }

  const { ok, rows } = await rest(
    `${CACHE_TABLE}?mailbox=eq.${encodeURIComponent(mailbox)}&uid=eq.${uid}&select=*&limit=1`
  );
  if (!ok || rows.length === 0) return null;
  return detailFromRow(rows[0]);
}

export async function readSyncState(mailbox: string): Promise<SyncState> {
  if (!storeIsDurable()) return memoryState.get(mailbox) || emptyState(mailbox);

  const { ok, rows } = await rest(
    `${STATE_TABLE}?mailbox=eq.${encodeURIComponent(mailbox)}&select=*&limit=1`
  );
  if (!ok || rows.length === 0) return emptyState(mailbox);
  const row = rows[0];
  return {
    mailbox,
    lastSyncedAt: row.last_synced_at || null,
    messageCount: Number(row.message_count || 0),
    bodiesCached: Number(row.bodies_cached || 0),
    truncated: Boolean(row.truncated)
  };
}

/** Wipes a mailbox's cache — used by the "clear" action in the admin UI. */
export async function clearMailbox(mailbox: string): Promise<void> {
  if (!storeIsDurable()) {
    memoryMessages.delete(mailbox);
    memoryState.delete(mailbox);
    return;
  }

  await Promise.all([
    rest(`${CACHE_TABLE}?mailbox=eq.${encodeURIComponent(mailbox)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    }),
    rest(`${STATE_TABLE}?mailbox=eq.${encodeURIComponent(mailbox)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    })
  ]);
}
