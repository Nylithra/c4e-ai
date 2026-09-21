/**
 * Doğrulanmış bir Lanux kimliğini Code4Ever hesabıyla eşler ve gerçek bir oturum üretir.
 *
 * OTURUM NASIL ÜRETİLİYOR — VE NEDEN BÖYLE
 *
 * Code4Ever'in oturumları Supabase Auth'a ait: RLS politikaları `auth.uid()` okuyor, yenileme
 * ve çıkış Supabase'in kendi makinesi tarafından yürütülüyor. Dolayısıyla "Lanux ile giriş"in
 * üretmesi gereken şey KENDİ uydurduğumuz bir çerez değil, gerçek bir Supabase oturumu;
 * aksi hâlde veritabanı o kullanıcıyı tanımaz ve her sorgu boş döner.
 *
 * Supabase'in "şu kullanıcı için oturum ver" diye doğrudan bir yönetici ucu yok. Yerleşik yol
 * şudur: yönetici anahtarıyla tek kullanımlık bir bağlantı üretilir (`generate_link`), oradan
 * çıkan `hashed_token` tarayıcıya verilir ve tarayıcı bunu `verifyOtp` ile gerçek bir oturuma
 * çevirir. Jeton tek kullanımlık ve kısa ömürlüdür.
 *
 * Alternatif — Supabase JWT sırrıyla kendi jetonumuzu imzalamak — reddedildi: yenileme
 * çalışmaz, süre yönetimi bize kalır ve sırrı bir yere daha yaymak gerekir.
 */

import crypto from 'node:crypto';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, safeFetch } from './security';
import type { LanuxIdentity } from './lanuxAuth';

export function accountsConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function call(
  path: string,
  init: { method?: string; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: any }> {
  const response = await safeFetch(`${SUPABASE_URL}${path}`, {
    method: init.method || 'GET',
    headers: adminHeaders(),
    body: init.body,
    timeoutMs: 15000,
    maxResponseBytes: 1024 * 1024
  });

  let json: any = null;
  try {
    json = JSON.parse(response.text || 'null');
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
}

const rest = (pathAndQuery: string, init?: { method?: string; body?: string }) =>
  call(`/rest/v1/${pathAndQuery}`, init);

// -------------------------------------------------------------
// PROFİL ARAMA
// -------------------------------------------------------------

export interface C4EProfile {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  lanux_user_id: string | null;
  github_username: string | null;
}

const PROFILE_FIELDS = 'id,username,display_name,email,lanux_user_id,github_username';

async function findProfile(filter: string): Promise<C4EProfile | null> {
  const { ok, json } = await rest(`profiles?${filter}&select=${PROFILE_FIELDS}&limit=1`);
  if (!ok || !Array.isArray(json) || json.length === 0) return null;
  return json[0] as C4EProfile;
}

export const findByLanuxSub = (sub: string) =>
  findProfile(`lanux_user_id=eq.${encodeURIComponent(sub)}`);

export const findByEmail = (email: string) =>
  findProfile(`email=eq.${encodeURIComponent(email)}`);

export const findById = (id: string) => findProfile(`id=eq.${encodeURIComponent(id)}`);

// -------------------------------------------------------------
// KULLANICI ADI
// -------------------------------------------------------------

/** Rezerve adlar şemadaki tetikleyiciyle aynı olmalı; buradan sessizce geçirmek işe yaramaz. */
const RESERVED = new Set([
  'admin', 'administrator', 'nylithra', 'c4e_admin', 'code4ever', 'system', 'root',
  'support', 'staff', 'moderator', 'security', 'official', 'api', 'bot'
]);

function sanitizeUsername(raw: string): string {
  const base = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
  return base.length >= 3 ? base : '';
}

/**
 * Lanux kullanıcı adından çakışmayan bir C4E kullanıcı adı üretir.
 *
 * Kullanıcı adı C4E'de tekil ve profil adreslerinde kullanılıyor; Lanux'takiyle çakışması
 * beklenen bir durum, hata değil. Çakışırsa sonuna sayı eklenir.
 */
export async function allocateUsername(preferred: string): Promise<string> {
  const base = sanitizeUsername(preferred) || `lanux${crypto.randomBytes(3).toString('hex')}`;

  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`.slice(0, 28);
    if (RESERVED.has(candidate)) continue;
    const taken = await findProfile(`username=eq.${encodeURIComponent(candidate)}`);
    if (!taken) return candidate;
  }

  // Deneme hakları biterse çakışma ihtimali pratikte sıfır olan bir ada düşülür.
  return `lanux${crypto.randomBytes(5).toString('hex')}`;
}

// -------------------------------------------------------------
// SUPABASE AUTH KULLANICISI
// -------------------------------------------------------------

/** Verilen e-postaya sahip auth kullanıcısını bulur (profil tablosu değil, auth tarafı). */
async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const { ok, json } = await call(`/auth/v1/admin/users?filter=${encodeURIComponent(email)}`);
  if (!ok) return null;
  const users = Array.isArray(json?.users) ? json.users : Array.isArray(json) ? json : [];
  const match = users.find((u: any) => String(u?.email || '').toLowerCase() === email.toLowerCase());
  return match ? { id: String(match.id) } : null;
}

async function createAuthUser(
  identity: LanuxIdentity,
  email: string,
  /**
   * Var olan bir profile auth kullanıcısı eklenirken ZORUNLU.
   *
   * RLS politikaları `profiles.id = auth.uid()` karşılaştırması yapıyor. Kimliği farklı bir
   * auth kullanıcısı oluşturmak, üyenin oturum açıp kendi profilini görememesi demek olurdu —
   * sessiz ve teşhisi zor bir bozulma.
   */
  forcedId?: string
): Promise<{ id: string } | null> {
  const { ok, json } = await call('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      ...(forcedId ? { id: forcedId } : {}),
      email,
      // Kimliği Lanux doğruladı; kullanıcıyı bir de Supabase'in doğrulama postasıyla
      // uğraştırmak gereksiz bir engel olurdu.
      email_confirm: true,
      user_metadata: {
        full_name: identity.name,
        avatar_url: identity.picture,
        provider: 'lanux',
        lanux_sub: identity.sub
      }
    })
  });
  return ok && json?.id ? { id: String(json.id) } : null;
}

/**
 * Profil var ama karşılığında auth kullanıcısı yoksa onu tamamlar.
 *
 * Üretimde her profilin bir auth kullanıcısı olmalı — kayıt böyle çalışıyor. Ama testte
 * ortaya çıktığı gibi, ikisi ayrışırsa sonuç şuydu: kimlik doğrulanıyor, bağlantı yazılıyor,
 * sonra oturum üretilemiyor ve üye anlamsız bir hatayla baş başa kalıyordu — üstelik hesabı
 * artık bağlı. Kimlik zaten kanıtlanmış olduğu için eksik kaydı tamamlamak doğru kurtarma.
 */
async function ensureAuthUser(
  email: string,
  profileId: string,
  identity: LanuxIdentity
): Promise<boolean> {
  const existing = await findAuthUserByEmail(email);
  if (existing) return true;
  const created = await createAuthUser(identity, email, profileId);
  return Boolean(created);
}

/**
 * Tarayıcının gerçek bir oturuma çevirebileceği tek kullanımlık jeton üretir.
 *
 * `hashed_token`, `verifyOtp` ile takas edilir. Kullanıcıya e-posta GÖNDERİLMEZ: bağlantıyı
 * üretip jetonu doğrudan alıyoruz, posta kutusuna hiç uğramıyor.
 */
export async function createSessionToken(
  email: string,
  profileId: string,
  identity: LanuxIdentity
): Promise<string | null> {
  // Eksik auth kaydı yüzünden "bağlandı ama giremiyor" durumuna düşmemek için önce tamamla.
  if (!(await ensureAuthUser(email, profileId, identity))) return null;

  const { ok, json } = await call('/auth/v1/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({ type: 'magiclink', email })
  });
  if (!ok) return null;

  // GoTrue sürümüne göre alan ya kökte ya `properties` altında geliyor.
  const token = json?.hashed_token || json?.properties?.hashed_token;
  return token ? String(token) : null;
}

// -------------------------------------------------------------
// BAĞLAMA
// -------------------------------------------------------------

/** Kimlik alanlarını yazar. Yalnızca servis rolüyle çalışır (şemadaki tetikleyici gereği). */
export async function writeLanuxLink(
  profileId: string,
  identity: LanuxIdentity,
  encryptedRefreshToken: string | null
): Promise<boolean> {
  const patch: Record<string, unknown> = {
    lanux_user_id: identity.sub,
    lanux_username: identity.username || null,
    lanux_linked_at: new Date().toISOString()
  };
  // Yenileme belirteci yoksa MEVCUT olanı silme: `offline_access` verilmeyen bir akış,
  // önceden kurulmuş çalışan bir bağlantıyı bozmamalı.
  if (encryptedRefreshToken) patch.lanux_refresh_token = encryptedRefreshToken;

  const { ok } = await rest(`profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  return ok;
}

export async function clearLanuxLink(profileId: string): Promise<boolean> {
  const { ok } = await rest(`profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      lanux_user_id: null,
      lanux_username: null,
      lanux_linked_at: null,
      lanux_refresh_token: null
    })
  });
  return ok;
}

/**
 * Üyenin Supabase auth kaydındaki GitHub kimliğini okur.
 *
 * BU FONKSİYON, GİTHUB BAĞLAMANIN TEK DOĞRULUK KAYNAĞI. Tarayıcıdan gelen hiçbir iddia
 * kabul edilmiyor: kullanıcı adı, OAuth akışını Supabase'in kendisi tamamladıktan sonra
 * auth kaydına yazdığı kimlikten okunuyor. Eskiden bu alan elle yazılıyordu ve yalnızca
 * "böyle bir GitHub kullanıcısı var mı" diye sorulduğu için, üye başkasının kullanıcı adını
 * kendi profiline bağlayıp onun depolarını kendi profilinde gösterebiliyordu.
 */
export async function readGithubIdentity(
  userId: string
): Promise<{ username: string; avatarUrl: string | null } | null> {
  const { ok, json } = await call(`/auth/v1/admin/users/${encodeURIComponent(userId)}`);
  if (!ok) return null;

  const identities = Array.isArray(json?.identities) ? json.identities : [];
  const github = identities.find((i: any) => String(i?.provider || '') === 'github');
  if (!github) return null;

  const data = github.identity_data || {};
  // Supabase sağlayıcıya göre farklı adlar kullanıyor; GitHub'da `user_name` asıl giriş adı.
  const username = String(data.user_name || data.preferred_username || data.user_login || '');

  // KIRPMADAN doğrula. Önce 39 karaktere kırpıp sonra bakmak, geçersiz bir değeri geçerli
  // GÖRÜNEN başka birinin adına çevirir: "cok-cok-...-cok" 80 karakterken reddedilmeli,
  // kırpıldığında ise kusursuz bir GitHub kullanıcı adı olur ve kimseye ait olmayan (ya da
  // bambaşka birine ait) bir hesap profile yazılır. GitHub'ın kendi sınırı zaten 39 karakter.
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(username)) return null;

  return { username, avatarUrl: data.avatar_url ? String(data.avatar_url).slice(0, 500) : null };
}

/**
 * Bu GitHub kullanıcı adı başka bir profile bağlı mı?
 *
 * GitHub kullanıcı adları büyük/küçük harf duyarsız, bu yüzden karşılaştırma da öyle olmalı;
 * aksi hâlde "Owner" ve "owner" iki ayrı kayıt gibi görünür ve iki üye aynı depoları
 * kendi profilinde gösterir.
 */
export const findByGithubUsername = (username: string) =>
  findProfile(`github_username=ilike.${encodeURIComponent(username)}`);

export async function clearGithubLink(profileId: string): Promise<boolean> {
  const { ok } = await rest(`profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ github_username: null, github_linked_at: null })
  });
  return ok;
}

export async function writeGithubLink(profileId: string, githubUsername: string): Promise<boolean> {
  const { ok } = await rest(`profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      github_username: githubUsername,
      github_linked_at: new Date().toISOString()
    })
  });
  return ok;
}

/** Şifreli yenileme belirtecini okur (yalnızca sunucu; sütun tarayıcıya kapalı). */
export async function readEncryptedRefreshToken(profileId: string): Promise<string | null> {
  const { ok, json } = await rest(
    `profiles?id=eq.${encodeURIComponent(profileId)}&select=lanux_refresh_token&limit=1`
  );
  if (!ok || !Array.isArray(json) || json.length === 0) return null;
  return json[0]?.lanux_refresh_token || null;
}

// -------------------------------------------------------------
// GİRİŞ AKIŞI
// -------------------------------------------------------------

export interface ResolveResult {
  ok: boolean;
  profile?: C4EProfile;
  /** Yeni hesap mı açıldı — arayüz hoş geldin akışı gösterebilsin diye. */
  created?: boolean;
  error?: string;
}

/**
 * Doğrulanmış kimlikten C4E hesabını bulur veya oluşturur.
 *
 * OTOMATİK EŞLEME YALNIZCA DOĞRULANMIŞ E-POSTAYLA YAPILIR. Bu kuralın gevşetilmesi doğrudan
 * hesap ele geçirmedir: doğrulanmamış bir e-posta alanı, saldırganın kurbanın adresini kendi
 * Lanux hesabına yazıp o adresle kayıtlı C4E hesabına düşmesini sağlardı.
 */
export async function resolveLoginAccount(identity: LanuxIdentity): Promise<ResolveResult> {
  const existing = await findByLanuxSub(identity.sub);
  if (existing) return { ok: true, profile: existing };

  if (identity.emailVerified && identity.email) {
    const byEmail = await findByEmail(identity.email);
    if (byEmail) {
      // Bu e-postaya sahip hesap başka bir Lanux kimliğine bağlıysa sessizce üzerine yazmak
      // yanlış olur; kullanıcı ne olduğunu anlamalı.
      if (byEmail.lanux_user_id && byEmail.lanux_user_id !== identity.sub) {
        return { ok: false, error: 'Bu e-posta adresine sahip Code4Ever hesabı başka bir Lanux hesabına bağlı.' };
      }
      return { ok: true, profile: byEmail };
    }
  }

  if (!identity.email) {
    return { ok: false, error: 'Lanux hesabında e-posta adresi yok; Code4Ever hesabı oluşturulamıyor.' };
  }

  // Yeni hesap. Auth kullanıcısı önce gelir: profil kimliği ona eşit olmak zorunda, çünkü
  // RLS politikaları `profiles.id = auth.uid()` karşılaştırması yapıyor.
  const authUser = (await findAuthUserByEmail(identity.email)) || (await createAuthUser(identity, identity.email));
  if (!authUser) return { ok: false, error: 'Kimlik sağlayıcı hesabı oluşturulamadı.' };

  const username = await allocateUsername(identity.username || identity.email.split('@')[0]);
  const { ok } = await rest('profiles', {
    method: 'POST',
    body: JSON.stringify([
      {
        id: authUser.id,
        username,
        display_name: identity.name || username,
        email: identity.email,
        avatar_url: identity.picture || null,
        role: 'Geliştirici'
      }
    ])
  });
  if (!ok) return { ok: false, error: 'Code4Ever profili oluşturulamadı.' };

  const created = await findById(authUser.id);
  return created ? { ok: true, profile: created, created: true } : { ok: false, error: 'Profil okunamadı.' };
}

/**
 * Mevcut bir C4E hesabına Lanux kimliği ekler.
 *
 * Tekillik kontrolü burada da yapılıyor ama son sözü veritabanındaki benzersiz indeks söylüyor:
 * iki eşzamanlı bağlama isteği bu kontrolü atlatabilir, indeksi atlatamaz.
 */
export async function resolveLinkAccount(
  currentUserId: string,
  identity: LanuxIdentity
): Promise<ResolveResult> {
  const current = await findById(currentUserId);
  if (!current) return { ok: false, error: 'Önce Code4Ever hesabınıza giriş yapın.' };

  const taken = await findByLanuxSub(identity.sub);
  if (taken && taken.id !== current.id) {
    return { ok: false, error: 'Bu Lanux hesabı başka bir Code4Ever hesabına bağlı.' };
  }

  return { ok: true, profile: current };
}
