/**
 * Lanux ile giriş — OpenID Connect istemcisi.
 *
 * İki akış var ve ikisi de aynı kodu kullanıyor:
 *   login — üye Lanux hesabıyla Code4Ever'e giriyor
 *   link  — zaten giriş yapmış bir üye hesabına Lanux kimliğini ekliyor
 *
 * NEREDE GÜVEN SINIRI VAR
 *
 * Bu dosyanın tek işi "bu kişi gerçekten bu Lanux hesabının sahibi mi" sorusunu yanıtlamak.
 * Yanıt YALNIZCA doğrulanmış bir `id_token`'dan gelir. Yetkilendirme kodu, `state`, hatta
 * belirteç uç noktasının döndürdüğü JSON bile tek başına kimlik kanıtı değildir; imza JWKS
 * ile doğrulanmadan hiçbir bağlama yapılmaz.
 *
 * KONTROL LİSTESİ (Lanux dokümanındaki sıraya göre) ve NEDENLERİ
 *
 *   PKCE S256      — kod ele geçirilse bile doğrulayıcı olmadan belirteç alınamaz.
 *   state          — CSRF. Saldırganın başlattığı bir akışın kurbanın oturumuna bağlanmasını
 *                    engeller; imzalı olduğu için sunucu tarafında durum tutmaya gerek yok.
 *   nonce          — id_token'ın BU akış için üretildiğini kanıtlar. Yeniden oynatma (replay)
 *                    saldırısına karşı.
 *   issuer + aud   — başka bir Lanux istemcisi için üretilmiş geçerli bir id_token'ın burada
 *                    kabul edilmesini engeller.
 *   sub            — kalıcı anahtar. Kullanıcı adı ve e-posta DEĞİŞEBİLİR; sub değişmez.
 *
 * Yenileme belirteçleri dönerlidir (rotating): her yenilemede yenisi verilir, eskisi anında
 * geçersizleşir ve eski bir belirteci tekrar kullanmak Lanux tarafında ailenin tamamını iptal
 * ettirir. Bu yüzden depolama AES-256-GCM ile şifreli ve yenileme tek bir yerden yapılıyor.
 */

import crypto from 'node:crypto';
import { env, hmacHex, safeEquals, safeFetch } from './security';

// -------------------------------------------------------------
// YAPILANDIRMA
// -------------------------------------------------------------

export interface LanuxConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Varsayılan kapsamlar. `services:write` olmadan bağlantı Lanux'a bildirilemez. */
export const LANUX_SCOPES = 'openid profile email offline_access services:write';

export function getLanuxConfig(): LanuxConfig | null {
  const issuer = env('LANUX_ISSUER').replace(/\/+$/, '');
  const clientId = env('LANUX_CLIENT_ID');
  const clientSecret = env('LANUX_CLIENT_SECRET');
  const redirectUri = env('LANUX_REDIRECT_URI');
  if (!issuer || !clientId || !clientSecret || !redirectUri) return null;
  return { issuer, clientId, clientSecret, redirectUri };
}

/** Yapılandırma eksikse nedenini söyler; arayüz düğmeyi buna göre gizler. */
export function lanuxUnavailableReason(): string | null {
  return getLanuxConfig()
    ? null
    : 'Lanux girişi yapılandırılmamış (LANUX_ISSUER / LANUX_CLIENT_ID / LANUX_CLIENT_SECRET / LANUX_REDIRECT_URI eksik).';
}

/**
 * SSRF koruması için izin verilen konaklar.
 *
 * safeFetch zaten özel/loopback IP'leri reddediyor ama hedef konağı da daraltmak gerekiyor:
 * LANUX_ISSUER bir yapılandırma değeri ve yanlış (ya da kötü niyetle değiştirilmiş) bir değer,
 * client_secret'ı saldırganın sunucusuna göndermek demek olurdu.
 */
function issuerHost(config: LanuxConfig): string[] {
  try {
    return [new URL(config.issuer).hostname];
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// PKCE / STATE / NONCE
// -------------------------------------------------------------

export interface FlowSecrets {
  state: string;
  nonce: string;
  verifier: string;
  mode: 'login' | 'link';
  /** 'link' akışında bağlanacak C4E kullanıcısı. */
  userId?: string;
  /** Akışın başladığı an; çerez yoksa bile süre kontrolü yapılabilsin diye. */
  issuedAt: number;
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * Akış sırlarını imzalı, kendi kendini doğrulayan tek bir dizeye paketler.
 *
 * NEDEN ÇEREZ YERİNE İMZALI PAKET: uygulama sunucusuz bir fonksiyon olarak da çalışıyor ve
 * istekler arasında bellek paylaşmıyor; sunucu tarafında oturum sözlüğü tutmak orada
 * çalışmaz. HMAC, paketin bizim ürettiğimizi ve değiştirilmediğini kanıtlıyor. Paket yine de
 * httpOnly çerezde taşınıyor — `verifier` tarayıcı JavaScript'ine görünmemeli.
 */
export function sealFlow(secrets: Omit<FlowSecrets, 'issuedAt'>): string {
  const payload = Buffer.from(JSON.stringify({ ...secrets, issuedAt: Date.now() }), 'utf8').toString('base64url');
  return `${payload}.${hmacHex(flowSecret(), payload)}`;
}

/** Süresi dolmuş veya imzası tutmayan paket `null` döner. */
export function openFlow(sealed: unknown, maxAgeMs = 10 * 60 * 1000): FlowSecrets | null {
  const raw = String(sealed || '');
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;

  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!safeEquals(signature, hmacHex(flowSecret(), payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as FlowSecrets;
    if (!parsed?.state || !parsed?.nonce || !parsed?.verifier) return null;
    if (!Number.isFinite(parsed.issuedAt) || Date.now() - parsed.issuedAt > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Akış paketini ve yenileme belirteçlerini koruyan sır.
 *
 * LANUX_STATE_SECRET verilmezse OAUTH_STATE_SECRET'a düşer; o da yoksa süreç başına rastgele
 * bir değer üretilir (yerel geliştirmede akış çalışır, yeniden başlatınca yarım kalan akışlar
 * düşer — üretimde değeri MUTLAKA sabitleyin).
 */
let fallbackSecret = '';
function flowSecret(): string {
  const configured = env('LANUX_STATE_SECRET') || env('OAUTH_STATE_SECRET');
  if (configured) return configured;
  if (!fallbackSecret) fallbackSecret = crypto.randomBytes(32).toString('hex');
  return fallbackSecret;
}

// -------------------------------------------------------------
// YETKİLENDİRME ADRESİ
// -------------------------------------------------------------

export function buildAuthorizeUrl(
  config: LanuxConfig,
  params: { state: string; nonce: string; challenge: string; prompt?: string }
): string {
  const url = new URL(`${config.issuer}/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', LANUX_SCOPES);
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('code_challenge', params.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Yalnızca beklenen değerler geçer: `prompt` istemciden gelebiliyor ve adrese serbest metin
  // eklenmesine izin vermek parametre enjeksiyonuna kapı açardı.
  if (params.prompt && ['login', 'consent', 'none'].includes(params.prompt)) {
    url.searchParams.set('prompt', params.prompt);
  }
  return url.toString();
}

// -------------------------------------------------------------
// BELİRTEÇ DEĞİŞİMİ
// -------------------------------------------------------------

export interface LanuxTokens {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

function basicAuth(config: LanuxConfig): string {
  return (
    'Basic ' +
    Buffer.from(
      `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`
    ).toString('base64')
  );
}

async function tokenRequest(
  config: LanuxConfig,
  body: Record<string, string>
): Promise<{ ok: boolean; tokens?: LanuxTokens; error?: string }> {
  const response = await safeFetch(`${config.issuer}/api/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuth(config)
    },
    body: new URLSearchParams(body).toString(),
    allowedHosts: issuerHost(config),
    timeoutMs: 15000,
    maxResponseBytes: 256 * 1024
  });

  let parsed: any = null;
  try {
    parsed = JSON.parse(response.text || '{}');
  } catch {
    parsed = null;
  }

  if (!response.ok || !parsed?.id_token) {
    // RFC 6749 biçimindeki hata mesajı teşhis için taşınır; belirteçler ASLA taşınmaz.
    const code = String(parsed?.error || `http_${response.status}`);
    const detail = String(parsed?.error_description || '').slice(0, 200);
    return { ok: false, error: detail ? `${code}: ${detail}` : code };
  }

  return { ok: true, tokens: parsed as LanuxTokens };
}

export async function exchangeCode(
  config: LanuxConfig,
  code: string,
  verifier: string
): Promise<{ ok: boolean; tokens?: LanuxTokens; error?: string }> {
  return tokenRequest(config, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier
  });
}

export async function refreshTokens(
  config: LanuxConfig,
  refreshToken: string
): Promise<{ ok: boolean; tokens?: LanuxTokens; error?: string }> {
  return tokenRequest(config, { grant_type: 'refresh_token', refresh_token: refreshToken });
}

// -------------------------------------------------------------
// id_token DOĞRULAMA — KİMLİĞİN TEK KAYNAĞI
// -------------------------------------------------------------

export interface LanuxIdentity {
  sub: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  picture: string;
}

/**
 * JWKS, `jose` tarafından önbelleğe alınır; her istekte yeniden indirilmez. Anahtar seti
 * yayımcıya göre saklanıyor, çünkü yapılandırma değişirse eski anahtarlarla doğrulamaya devam
 * etmek sessiz bir güvenlik açığı olurdu.
 */
const jwksCache = new Map<string, ReturnType<typeof createCachedJwks>>();

function createCachedJwks(issuer: string) {
  // Dinamik import: `jose` yalnızca Lanux yapılandırılmışsa yüklensin.
  return import('jose').then(({ createRemoteJWKSet }) =>
    createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  );
}

export async function verifyIdToken(
  config: LanuxConfig,
  idToken: string,
  expectedNonce: string
): Promise<{ ok: boolean; identity?: LanuxIdentity; error?: string }> {
  try {
    if (!jwksCache.has(config.issuer)) jwksCache.set(config.issuer, createCachedJwks(config.issuer));
    const jwks = await jwksCache.get(config.issuer)!;
    const { jwtVerify } = await import('jose');

    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: config.issuer,
      audience: config.clientId
    });

    // nonce, bu id_token'ın BU akış için üretildiğini kanıtlar. Sabit süreli karşılaştırma,
    // çünkü değer gizli sayılır.
    if (!payload.nonce || !safeEquals(String(payload.nonce), expectedNonce)) {
      return { ok: false, error: 'nonce doğrulaması başarısız' };
    }

    const sub = String(payload.sub || '');
    if (!sub) return { ok: false, error: 'id_token içinde sub yok' };

    return {
      ok: true,
      identity: {
        sub,
        username: String(payload.preferred_username || '').slice(0, 80),
        email: payload.email ? String(payload.email).toLowerCase().slice(0, 254) : null,
        // Lanux `email_verified` göndermiyorsa DOĞRULANMAMIŞ sayılır. Varsayılanı `true`
        // yapmak, e-posta üzerinden otomatik hesap eşlemeyi hesap ele geçirmeye çevirirdi.
        emailVerified: payload.email_verified === true,
        name: String(payload.name || payload.preferred_username || '').slice(0, 120),
        picture: String(payload.picture || '').slice(0, 500)
      }
    };
  } catch (error: any) {
    return { ok: false, error: `id_token doğrulanamadı: ${String(error?.message || error).slice(0, 200)}` };
  }
}

// -------------------------------------------------------------
// YENİLEME BELİRTECİ ŞİFRELEME (AES-256-GCM)
// -------------------------------------------------------------

/**
 * Yenileme belirteci veritabanında düz metin durmamalı: onu ele geçiren, kullanıcının Lanux
 * hesabına süresiz erişir. GCM seçildi çünkü hem şifreliyor hem BÜTÜNLÜK doğruluyor — CBC
 * gibi yalnızca şifreleyen bir kip, saldırganın şifreli metni kurcalamasına izin verirdi.
 */
function encryptionKey(): Buffer {
  // Anahtar, akış sırrından türetiliyor; ayrı bir değişken istemeye gerek yok ve ikisinin
  // birbirinden bağımsız dönmesi gereken bir senaryo yok.
  return crypto.createHash('sha256').update(`lanux-refresh:${flowSecret()}`).digest();
}

export function encryptRefreshToken(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptRefreshToken(stored: unknown): string | null {
  const raw = String(stored || '');
  const parts = raw.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(parts[1], 'base64url')
    );
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'base64url')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch {
    // Bozuk veya kurcalanmış kayıt: sessizce yok sayılır, kullanıcı yeniden bağlanır.
    return null;
  }
}

// -------------------------------------------------------------
// LANUX'A BAĞLANTIYI BİLDİRME
// -------------------------------------------------------------

/**
 * Lanux Account → "Hizmetlerim" ekranında Code4Ever'in bağlı görünmesini sağlar.
 *
 * Başarısızlığı akışı DÜŞÜRMEZ: bağlama işlemi bizim tarafımızda çoktan tamamlandı ve
 * kullanıcının girişini, yalnızca bir rozet güncellenemediği için iptal etmek yanlış olur.
 */
export async function notifyServiceLink(
  config: LanuxConfig,
  accessToken: string,
  action: 'link' | 'unlink',
  externalUserId: string
): Promise<boolean> {
  try {
    const response = await safeFetch(`${config.issuer}/api/v1/me/services`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        service_key: 'code4ever',
        action,
        external_user_id: externalUserId,
        plan: 'free'
      }),
      allowedHosts: issuerHost(config),
      timeoutMs: 10000,
      maxResponseBytes: 64 * 1024
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Yenileme belirtecini Lanux tarafında iptal eder (bağlantı kaldırılırken). */
export async function revokeRefreshToken(config: LanuxConfig, refreshToken: string): Promise<boolean> {
  try {
    const response = await safeFetch(`${config.issuer}/api/oauth/revoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuth(config)
      },
      body: new URLSearchParams({ token: refreshToken }).toString(),
      allowedHosts: issuerHost(config),
      timeoutMs: 10000,
      maxResponseBytes: 64 * 1024
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** RP-initiated logout adresi. `post_logout_redirect_uri` konsolda kayıtlı olmalıdır. */
export function buildLogoutUrl(config: LanuxConfig, idToken: string, returnTo: string): string {
  const url = new URL(`${config.issuer}/api/oauth/logout`);
  url.searchParams.set('id_token_hint', idToken);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('post_logout_redirect_uri', returnTo);
  return url.toString();
}
