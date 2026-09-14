/**
 * Vercel serverless entry point.
 *
 * Vercel does not run `server.ts` as a long-lived process — it invokes a function per
 * request. An Express app is already a `(req, res)` handler, so the whole API surface is
 * reused verbatim; `server.ts` skips its own `app.listen()` when it detects a serverless
 * environment (see `isServerless`).
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

import app from '../server';

export default app;

export const config = {
  // The Express app parses its own body (and keeps the raw bytes for webhook signature
  // verification), so Vercel must hand it the untouched stream.
  api: { bodyParser: false }
};
