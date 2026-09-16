/**
 * Vercel serverless entry point.
 *
 * Vercel does not run `server.ts` as a long-lived process — it invokes a function per
 * request. An Express app is already a `(req, res)` handler, so the whole API surface is
 * reused verbatim; `server.ts` skips its own `app.listen()` when it detects a serverless
 * environment (see `isServerless`).
 *
 * MODULE SYSTEM: see `api/package.json`. This directory is deliberately CommonJS even though
 * the repository root is `"type": "module"`, because Express's dependency tree is CommonJS
 * and fails to load when bundled into an ESM function.
 *
 * WHAT WORKS HERE AND WHAT DOES NOT
 *
 *   ✅ Everything request/response shaped: the community API, OAuth callbacks, admin
 *      endpoints, and SMTP sending (one short-lived outbound connection per request).
 *
 *   ❌ IMAP inbox reading. IMAP is a stateful session held open over a TCP socket; a
 *      serverless function is frozen between invocations and is capped at a few seconds of
 *      execution, so the connection cannot be maintained. `getImapConfig()` returns null
 *      here on purpose and the admin UI explains why, rather than hanging until a timeout.
 *
 *   ❌ Durable local files. The filesystem is read-only apart from /tmp, and /tmp does not
 *      survive between invocations. The donation ledger therefore falls back to a temporary
 *      directory and should be treated as a cache, not a record.
 *
 * Moving the backend to a platform that runs a persistent Node process (Railway, Render,
 * Fly.io, a VPS) restores both of the above with no code change.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Loading the app can fail for environment reasons (a missing dependency in the traced
 * bundle, a bad module format). Vercel reports that as an opaque FUNCTION_INVOCATION_FAILED
 * page with no cause, so the failure is captured here and reported as readable JSON instead
 * — the platform's Runtime Logs still receive the full stack.
 */
let app: Handler | null = null;
let loadError: Error | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded = require('../server');
  const candidate = loaded?.default ?? loaded?.app ?? loaded;
  if (typeof candidate !== 'function') {
    throw new Error(`Beklenen Express handler'ı bulunamadı (tip: ${typeof candidate}).`);
  }
  app = candidate as Handler;
} catch (error: any) {
  loadError = error instanceof Error ? error : new Error(String(error));
  console.error('[c4e] Sunucu uygulaması yüklenemedi:', loadError.stack || loadError.message);
}

module.exports = function handler(req: IncomingMessage, res: ServerResponse) {
  if (app) {
    app(req, res);
    return;
  }

  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      success: false,
      error: 'server_init_failed',
      message:
        'Sunucu uygulaması başlatılamadı. Ayrıntılı yığın izi için dağıtım sağlayıcısının Runtime Logs bölümüne bakın.',
      detail: loadError?.message || 'bilinmeyen hata'
    })
  );
};
