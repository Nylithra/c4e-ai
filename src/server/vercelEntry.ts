/**
 * Source for the Vercel serverless function.
 *
 * This file is NOT the function itself — the build bundles it into `api/index.js` as a
 * single self-contained CommonJS file (see the `build:vercel` script).
 *
 * WHY PRE-BUNDLE INSTEAD OF LETTING THE PLATFORM COMPILE `api/*.ts`
 *
 * The platform compiles each TypeScript file separately and drops the results next to each
 * other: `server.ts` becomes `/var/task/server.js`, the function becomes
 * `/var/task/api/index.js`. The repository root declares `"type": "module"` for Vite, so
 * `server.js` is an ES module — and a CommonJS function cannot `require()` it:
 *
 *     require() of ES Module /var/task/server.js from /var/task/api/index.js not supported
 *
 * Flipping the function to ESM only moves the problem: Express's dependency tree is
 * CommonJS, and extensionless relative specifiers stop resolving under Node's ESM loader.
 * Bundling removes the entire class of failure — there is no cross-file import left to
 * resolve, no module-format boundary, and no dependence on how the platform happens to
 * compile TypeScript this month. Only `node_modules` stays external, which Node resolves
 * normally.
 *
 * WHAT WORKS IN A SERVERLESS FUNCTION AND WHAT DOES NOT
 *
 *   ✅ Everything request/response shaped: the community API, OAuth callbacks, admin
 *      endpoints, and SMTP sending (one short-lived outbound connection per request).
 *
 *   ❌ IMAP inbox reading — a stateful session held open over a TCP socket, which cannot
 *      survive a function that is frozen between invocations. `getImapConfig()` returns null
 *      there on purpose and the admin UI explains why.
 *
 *   ❌ Durable local files — the filesystem is read-only apart from /tmp, and /tmp does not
 *      persist between invocations.
 *
 * A platform that runs a persistent Node process (Railway, Render, Fly.io, a VPS) restores
 * both with no code change.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../../server';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Importing the app can still fail for environment reasons. The platform reports that as an
 * opaque FUNCTION_INVOCATION_FAILED page with no cause, so the failure is captured here and
 * returned as readable JSON — the full stack still reaches the platform's Runtime Logs.
 */
let handlerError: Error | null = null;
let resolvedApp: Handler | null = null;

try {
  if (typeof app !== 'function') {
    throw new Error(`Beklenen Express handler'ı bulunamadı (tip: ${typeof app}).`);
  }
  resolvedApp = app as unknown as Handler;
} catch (error: any) {
  handlerError = error instanceof Error ? error : new Error(String(error));
  console.error('[c4e] Sunucu uygulaması yüklenemedi:', handlerError.stack || handlerError.message);
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (resolvedApp) {
    resolvedApp(req, res);
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
      detail: handlerError?.message || 'bilinmeyen hata'
    })
  );
}
