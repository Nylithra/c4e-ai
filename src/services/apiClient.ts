/**
 * Thin wrapper around fetch() for Code4Ever's own `/api/*` endpoints.
 *
 * Several endpoints (webhook relay, EveryChat, post deletion, donation claims) now require a
 * valid Supabase session, so every request made through `apiFetch` carries the caller's
 * access token. The token provider is registered by `supabaseClient.ts` at start-up, which
 * keeps this module free of import cycles.
 */

type TokenProvider = () => Promise<string | null>;

let accessTokenProvider: TokenProvider = async () => null;

export function setAccessTokenProvider(provider: TokenProvider): void {
  accessTokenProvider = provider;
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await accessTokenProvider();
  } catch {
    return null;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** JSON serialised automatically and sent with the correct content type. */
  json?: unknown;
  /** Set to false for endpoints that are intentionally public. */
  auth?: boolean;
  timeoutMs?: number;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { json, auth = true, timeoutMs = 30000, headers, ...rest } = options;

  const finalHeaders = new Headers(headers || {});
  if (json !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = await getAccessToken();
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(path, {
      ...rest,
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
      signal: options.signal ?? controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Convenience helper: performs the request and parses JSON, never throwing on parse errors. */
export async function apiFetchJson<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<{ ok: boolean; status: number; data: T | null; rawText: string }> {
  try {
    const response = await apiFetch(path, options);
    const rawText = await response.text();
    let data: T | null = null;
    try {
      data = rawText ? (JSON.parse(rawText) as T) : null;
    } catch {
      data = null;
    }
    return { ok: response.ok, status: response.status, data, rawText };
  } catch {
    return { ok: false, status: 0, data: null, rawText: '' };
  }
}
