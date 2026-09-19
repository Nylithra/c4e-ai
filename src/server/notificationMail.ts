/**
 * E-posta bildirimleri: bekleyen bildirimleri toplayıp üyeye tek bir özet olarak gönderir.
 *
 * NEDEN SUNUCU TARAFLI VE NEDEN İSTEMCİ TETİKLEMİYOR
 *
 * Bildirimleri istemci oluşturuyor (anon anahtarla, RLS altında). "Şimdi şu kişiye e-posta
 * at" demeyi de istemciye bıraksaydık, herhangi biri istediği üyeye istediği içerikte posta
 * yollatabilirdi — platformun kendi alan adından, yani doğrudan bir kimlik avı aracı olurdu.
 * Bu yüzden istemciden gelen HİÇBİR şey gönderime karar vermiyor: sunucu `notifications`
 * tablosunu servis rolüyle kendisi okuyor, kime ne gönderileceğini oradan çıkarıyor.
 *
 * NEDEN ÖZET (DIGEST), TEK TEK DEĞİL
 *
 * Popüler bir gönderi dakikalar içinde onlarca beğeni alır. Her biri için ayrı e-posta,
 * kullanıcının gelen kutusunu doldurur ve toplu abonelikten çıkışa yol açar — yani özelliğin
 * kendisini öldürür. Dağıtım, alıcı başına bekleyen bildirimleri TEK bir e-postada topluyor.
 *
 * YİNELEME KORUMASI
 *
 * `notifications.email_sent_at` tek doğruluk kaynağı. Gönderim biter bitmez damgalanır, bu
 * yüzden iki dağıtım üst üste binse veya sunucu ortada yeniden başlasa bile aynı bildirim
 * ikinci kez e-posta üretmez. Damgayı istemcinin uyduramaması veya silememesi veritabanı
 * tetikleyicisiyle garanti altında (bkz. supabase_schema.sql, 4.6).
 */

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  OAUTH_STATE_SECRET,
  safeEquals,
  hmacHex,
  safeFetch,
  env
} from './security';
import { getSmtpConfig, sendMail, normalizeEmail } from './mail';

// -------------------------------------------------------------
// TERCİHLER
// -------------------------------------------------------------

export type NotificationEmailType =
  | 'comment'
  | 'message'
  | 'follow'
  | 'job_application'
  | 'group_invite'
  | 'community'
  | 'like'
  | 'repost'
  | 'star'
  | 'job_listing';

export interface EmailPrefs {
  /** Ana anahtar. Kapalıysa hiçbir bildirim e-postası gitmez. */
  enabled: boolean;
  types: Record<NotificationEmailType, boolean>;
}

/**
 * Varsayılanlar bilinçli olarak asimetrik.
 *
 * Üyenin doğrudan muhatap olduğu olaylar (yanıt, mesaj, takip, başvuru, davet) AÇIK gelir:
 * bunlar bir yanıt bekler ve kaçırılması maliyetlidir. Beğeni / repost / yıldız gibi yüksek
 * hacimli, düşük bilgi değerli olaylar KAPALI gelir; açık gelselerdi ilk popüler gönderi bir
 * kutu dolusu e-posta üretir ve üye topluca aboneliği bırakırdı.
 */
export const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  enabled: true,
  types: {
    comment: true,
    message: true,
    follow: true,
    job_application: true,
    group_invite: true,
    community: true,
    like: false,
    repost: false,
    star: false,
    job_listing: false
  }
};

const ALL_TYPES = Object.keys(DEFAULT_EMAIL_PREFS.types) as NotificationEmailType[];

/** Depodan gelen tercihi güvenli hâle getirir; bilinmeyen anahtarlar düşer. */
export function sanitizeEmailPrefs(raw: unknown): EmailPrefs {
  let source: any = raw;
  if (typeof raw === 'string') {
    try {
      source = JSON.parse(raw);
    } catch {
      source = null;
    }
  }
  if (!source || typeof source !== 'object') return { ...DEFAULT_EMAIL_PREFS, types: { ...DEFAULT_EMAIL_PREFS.types } };

  const types = {} as Record<NotificationEmailType, boolean>;
  for (const type of ALL_TYPES) {
    const value = source.types?.[type];
    types[type] = typeof value === 'boolean' ? value : DEFAULT_EMAIL_PREFS.types[type];
  }
  return { enabled: source.enabled !== false, types };
}

// -------------------------------------------------------------
// ABONELİKTEN ÇIKMA BAĞLANTISI
// -------------------------------------------------------------

/**
 * Oturum açmadan çalışması gereken, imzalı bir jeton.
 *
 * Abonelikten çıkma bağlantısı e-postanın içinde gider ve tıklayan kişi çoğu zaman oturum
 * açmamıştır — zaten bütün mesele "giriş yapmadan bu postaları durdurabilmek". Jeton bu
 * yüzden kullanıcı kimliğini HMAC ile imzalar: sahtesi üretilemez, başka bir üyeyi
 * abonelikten çıkarmak için değiştirilemez, ve süresi dolmaz (eski bir e-postadaki bağlantı
 * yıllar sonra da çalışmalı — aksi hâlde kullanıcıyı postaları durduramaz hâlde bırakırız).
 */
export function unsubscribeToken(userId: string): string {
  const id = String(userId || '');
  return `${Buffer.from(id, 'utf8').toString('base64url')}.${hmacHex(OAUTH_STATE_SECRET, `unsub:${id}`)}`;
}

export function verifyUnsubscribeToken(token: unknown): string | null {
  const raw = String(token || '');
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;

  const encoded = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  let userId: string;
  try {
    userId = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!userId) return null;

  return safeEquals(signature, hmacHex(OAUTH_STATE_SECRET, `unsub:${userId}`)) ? userId : null;
}

// -------------------------------------------------------------
// SUPABASE ERİŞİMİ
// -------------------------------------------------------------

export function dispatcherConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && getSmtpConfig());
}

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
    maxResponseBytes: 4 * 1024 * 1024
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
// METİNLER
// -------------------------------------------------------------

/** Bildirim türünün Türkçe karşılığı; bilinmeyen tür genel bir ifadeye düşer. */
const TYPE_LABELS: Record<string, string> = {
  comment: 'gönderine yanıt verdi',
  message: 'sana mesaj gönderdi',
  follow: 'seni takip etmeye başladı',
  job_application: 'ilanına başvurdu',
  group_invite: 'seni bir gruba davet etti',
  community: 'topluluğunla ilgili bir işlem yaptı',
  like: 'gönderini beğendi',
  repost: 'gönderini yeniden paylaştı',
  star: 'gönderine yıldız verdi',
  job_listing: 'yeni bir ilan paylaştı'
};

function actorName(row: any): string {
  return String(row?.actor?.display_name || row?.actor?.username || 'Bir üye').slice(0, 60);
}

function describe(row: any): string {
  const label = TYPE_LABELS[String(row?.type)] || 'seninle ilgili bir işlem yaptı';
  const content = String(row?.content || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  return content ? `${actorName(row)} ${label}: “${content}”` : `${actorName(row)} ${label}.`;
}

/**
 * Aynı şeye gelen bildirimleri tek satırda toplar.
 *
 * Gruplamadan bir gönderiye gelen beş beğeni, e-postada birbirinin aynı beş satır olur —
 * okunmaz ve özetin amacını boşa çıkarır. Anahtar (tür + hedef): aynı gönderiye gelen
 * beğeniler birleşir, farklı gönderilere gelenler ayrı kalır.
 */
function summarize(rows: any[]): string[] {
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const key = `${row?.type}|${row?.target_id ?? ''}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const lines: string[] = [];
  for (const items of groups.values()) {
    if (items.length === 1) {
      lines.push(describe(items[0]));
      continue;
    }

    // Aynı kişinin tekrar eden eylemi tek kişi olarak sayılır ("Ayşe ve 1 kişi daha" yerine).
    const names: string[] = [];
    for (const item of items) {
      const name = actorName(item);
      if (!names.includes(name)) names.push(name);
    }

    const label = TYPE_LABELS[String(items[0]?.type)] || 'seninle ilgili bir işlem yaptı';
    const who =
      names.length === 1
        ? `${names[0]} (${items.length} kez)`
        : names.length === 2
        ? `${names[0]} ve ${names[1]}`
        : `${names[0]} ve ${names.length - 1} kişi daha`;

    const content = String(items[0]?.content || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    lines.push(content ? `${who} ${label}: “${content}”` : `${who} ${label}.`);
  }

  return lines;
}

// -------------------------------------------------------------
// DAĞITIM
// -------------------------------------------------------------

export interface DispatchResult {
  /** Bekleyen (e-postası gönderilmemiş) bildirim sayısı. */
  pending: number;
  /** E-posta gönderilen alıcı sayısı. */
  recipients: number;
  /** Gönderilen e-posta sayısı. */
  sent: number;
  /** Gönderilmeden atlanan bildirim sayısı ve nedenleri. */
  skipped: Record<string, number>;
  durationMs: number;
  dryRun: boolean;
}

interface DispatchOptions {
  /** Tek seferde işlenecek en fazla bildirim. */
  limit?: number;
  /** Alıcı başına tek özette listelenecek en fazla satır. */
  perRecipient?: number;
  /** Gerçekten göndermeden neyin gideceğini raporlar. */
  dryRun?: boolean;
  /** Bu yaştan eski bildirimler artık e-postalanmaz, yalnızca damgalanır. */
  maxAgeHours?: number;
  appUrl?: string;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export async function dispatchNotificationEmails(options: DispatchOptions = {}): Promise<DispatchResult> {
  const startedAt = Date.now();
  const limit = Math.min(toPositiveInt(options.limit, 200), 500);
  const perRecipient = Math.min(toPositiveInt(options.perRecipient, 12), 50);
  const maxAgeHours = Math.min(toPositiveInt(options.maxAgeHours ?? toPositiveInt(env('MAIL_NOTIFY_MAX_AGE_HOURS'), 48), 48), 720);
  const dryRun = options.dryRun === true;
  const appUrl = String(options.appUrl || env('APP_URL', 'https://app.lanux.online')).replace(/\/+$/, '');

  const skipped: Record<string, number> = {};
  const skip = (reason: string, n = 1) => {
    skipped[reason] = (skipped[reason] || 0) + n;
  };

  // Yalnızca bekleyenler. Okunmuşları dışarıda bırakmak bilinçli: üye bildirimi uygulamada
  // zaten görmüşse, aynı şeyi bir de e-postayla haber vermenin bilgi değeri yok.
  const { ok, rows } = await rest(
    'notifications' +
      '?email_sent_at=is.null' +
      '&is_read=eq.false' +
      '&select=id,recipient_id,type,actor,content,target_id,created_at' +
      '&order=created_at.asc' +
      `&limit=${limit}`
  );
  if (!ok) {
    return { pending: 0, recipients: 0, sent: 0, skipped: { supabase_okunamadi: 1 }, durationMs: Date.now() - startedAt, dryRun };
  }

  const pending = rows.length;
  if (pending === 0) {
    return { pending: 0, recipients: 0, sent: 0, skipped, durationMs: Date.now() - startedAt, dryRun };
  }

  // Çok eski bildirimler için e-posta artık anlamsız; damgalanıp kuyruktan düşerler.
  const cutoff = Date.now() - maxAgeHours * 3600 * 1000;
  const stale: string[] = [];
  const fresh: any[] = [];
  for (const row of rows) {
    const at = Date.parse(row.created_at || '');
    if (Number.isFinite(at) && at < cutoff) stale.push(row.id);
    else fresh.push(row);
  }
  if (stale.length) {
    skip('cok_eski', stale.length);
    if (!dryRun) await markSent(stale);
  }

  // Alıcıya göre grupla.
  const byRecipient = new Map<string, any[]>();
  for (const row of fresh) {
    const id = String(row.recipient_id || '');
    if (!id) {
      skip('alici_yok');
      continue;
    }
    const list = byRecipient.get(id) || [];
    list.push(row);
    byRecipient.set(id, list);
  }

  let sent = 0;
  let recipients = 0;

  for (const [recipientId, items] of byRecipient) {
    const profile = await loadRecipient(recipientId);

    // Adresi olmayan veya profili bulunamayan alıcı: kuyruğu tıkamaması için damgalanır.
    if (!profile || !profile.email) {
      skip(profile ? 'adres_yok' : 'profil_yok', items.length);
      if (!dryRun) await markSent(items.map((i) => i.id));
      continue;
    }

    const prefs = sanitizeEmailPrefs(profile.email_prefs);
    if (!prefs.enabled) {
      skip('abonelik_kapali', items.length);
      if (!dryRun) await markSent(items.map((i) => i.id));
      continue;
    }

    const wanted = items.filter((i) => prefs.types[String(i.type) as NotificationEmailType] === true);
    const unwanted = items.filter((i) => !wanted.includes(i));
    if (unwanted.length) {
      skip('tur_kapali', unwanted.length);
      if (!dryRun) await markSent(unwanted.map((i) => i.id));
    }
    if (wanted.length === 0) continue;

    recipients++;
    if (dryRun) continue;

    const token = unsubscribeToken(recipientId);

    // Önce topla, sonra kırp: kırpma gruplamadan önce yapılsaydı, aynı gönderiye gelen
    // bildirimler farklı e-postalara bölünür ve hiçbiri toplanamazdı.
    const allLines = summarize(wanted);
    const paragraphs = allLines.slice(0, perRecipient);
    const extra = allLines.length - paragraphs.length;
    if (extra > 0) paragraphs.push(`…ve ${extra} bildirim daha.`);

    const result = await sendMail({
      to: profile.email,
      recipientName: profile.display_name || profile.username,
      subject:
        wanted.length === 1
          ? `Code4Ever: ${describe(wanted[0]).slice(0, 90)}`
          : `Code4Ever: ${wanted.length} yeni bildirim`,
      heading: wanted.length === 1 ? 'Yeni bir bildirimin var' : `${wanted.length} yeni bildirimin var`,
      // sendMail gövdeyi düz metin alır ve boş satırları paragrafa çevirir.
      body: paragraphs.join('\n\n'),
      callToAction: { label: 'Bildirimleri Aç', url: `${appUrl}/notifications` },
      footnote:
        'Bu e-postayı Code4Ever hesabındaki bildirim tercihlerin açık olduğu için alıyorsun. ' +
        `Hangi bildirimlerin e-postayla geleceğini buradan seçebilirsin: ${appUrl}/settings`,
      // Ayrı alan: dipnot uzunluk sınırına takılıyor ve jetonu ortadan kesiyordu, yani
      // abonelikten çıkma bağlantısı kalıcı olarak bozuk gidiyordu.
      unsubscribeUrl: `${appUrl}/api/email/unsubscribe?token=${token}`
    });

    if (result.ok) {
      sent++;
      await markSent(wanted.map((i) => i.id));
    } else {
      // Damgalanmaz: geçici bir SMTP arızasında bildirim kuyrukta kalır ve bir sonraki
      // dağıtımda yeniden denenir. Kalıcı bir arıza da "cok_eski" eşiğinde düşer.
      skip('gonderim_hatasi', wanted.length);
    }
  }

  return { pending, recipients, sent, skipped, durationMs: Date.now() - startedAt, dryRun };
}

/** Bildirimleri gönderildi olarak damgalar. */
async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const list = ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
  await rest(`notifications?id=in.(${encodeURIComponent(list)})`, {
    method: 'PATCH',
    body: JSON.stringify({ email_sent_at: new Date().toISOString() }),
    headers: { Prefer: 'return=minimal' }
  });
}

interface RecipientProfile {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  email_prefs: unknown;
}

/** Alıcının adresini ve tercihlerini okur (servis rolü: `email` tarayıcıya kapalı). */
async function loadRecipient(recipientId: string): Promise<RecipientProfile | null> {
  const encoded = encodeURIComponent(recipientId);
  // Bildirimlerdeki recipient_id kimi yerde kullanıcı adı, kimi yerde kimlik olabiliyor;
  // ikisini de dener, aksi hâlde geçerli alıcılar sessizce atlanırdı.
  for (const filter of [`id=eq.${encoded}`, `username=eq.${encoded}`]) {
    const { ok, rows } = await rest(`profiles?${filter}&select=id,username,display_name,email,email_prefs&limit=1`);
    if (ok && rows.length > 0) {
      const row = rows[0];
      return {
        id: String(row.id),
        username: String(row.username || ''),
        display_name: String(row.display_name || ''),
        email: normalizeEmail(row.email),
        email_prefs: row.email_prefs
      };
    }
  }
  return null;
}

// -------------------------------------------------------------
// TERCİH OKUMA / YAZMA
// -------------------------------------------------------------

export async function readEmailPrefs(userId: string): Promise<EmailPrefs | null> {
  const { ok, rows } = await rest(`profiles?id=eq.${encodeURIComponent(userId)}&select=email_prefs&limit=1`);
  if (!ok || rows.length === 0) return null;
  return sanitizeEmailPrefs(rows[0].email_prefs);
}

export async function writeEmailPrefs(userId: string, prefs: EmailPrefs): Promise<boolean> {
  const { ok } = await rest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ email_prefs: prefs }),
    headers: { Prefer: 'return=minimal' }
  });
  return ok;
}

/**
 * Dağıtım ucunu koruyan sır. Zamanlayıcı (cron) oturum açamaz, bu yüzden yönetici oturumuna
 * ek olarak bir paylaşılan sır kabul edilir. Tanımlı değilse yalnızca yönetici çağırabilir —
 * ucu sırsız da açık bırakmak, herkesin gönderimi tetikleyebilmesi demek olurdu.
 */
export function cronSecretMatches(presented: unknown): boolean {
  const secret = env('MAIL_NOTIFY_CRON_SECRET');
  if (!secret) return false;
  return safeEquals(String(presented || ''), secret);
}

/** Testlerin bildirim metnini doğrulayabilmesi için. */
export const __internals = { describe };
