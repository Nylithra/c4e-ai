/**
 * Projeler: bir üyenin kendi GitHub deposunu platforma tanıtması, beğenilmesi, takip
 * edilmesi ve her commit'te takipçilere bildirim gitmesi.
 *
 * NEDEN HER ŞEY SUNUCUDA
 *
 * Bu özellik bir yarışma içeriyor ("haftanın projesi", "tüm zamanların en çok beğenileni").
 * Puanı belirleyen her adım — kimin hangi depoyu tanıtabildiği, beğeninin kim adına
 * sayıldığı, commit bildiriminin kime gittiği — istemciye bırakılsaydı liderlik tablosu
 * yalnızca "kim daha çok istek gönderdi" tablosu olurdu. Bu yüzden:
 *
 *   * Depo sahipliği GitHub'a sorularak doğrulanır; üye başkasının deposunu tanıtamaz.
 *   * Beğeni ve takip satırlarını veritabanı tekilleştirir, sayaçları tetikleyici türetir
 *     (bkz. supabase_schema.sql 4.7) — bu modül sayaç YAZMAZ.
 *   * Commit bildirimi yalnızca TAKİPÇİLERE gider ve aynı commit için bir kez gönderilir.
 */

import crypto from 'node:crypto';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, safeFetch, env } from './security';

// -------------------------------------------------------------
// SUPABASE ERİŞİMİ (servis rolü)
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

export function projectsConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

// -------------------------------------------------------------
// GİRDİ TEMİZLEME
// -------------------------------------------------------------

/**
 * GitHub "kullanıcı/depo" biçimi.
 *
 * Kırpmadan doğruluyoruz: uzun bir değeri kısaltıp sonra bakmak, geçersiz girdiyi
 * BAŞKASINA AİT geçerli bir depo adına çevirebilir. (Aynı hata daha önce GitHub kullanıcı
 * adı bağlamada yakalanmıştı.)
 */
const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}\/[A-Za-z0-9._-]{1,100}$/;

export function normalizeRepoFullName(raw: unknown): string | null {
  const value = String(raw ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  return REPO_PATTERN.test(value) ? value : null;
}

/** Görünen metinler: boşlukları toparla, uzunluğu şemadaki sınırla aynı tut. */
export function cleanText(raw: unknown, max: number): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function newProjectId(): string {
  return `prj_${crypto.randomBytes(9).toString('hex')}`;
}

/**
 * Sayı ayrıştırma; geçersiz veya eksik değerde varsayılana düşer.
 *
 * Sıfır ve negatif değerler de varsayılana düşüyor: buradan geçen her sayı (liste boyutu,
 * süre bütçesi, proje adedi) sıfır olduğunda özelliği sessizce kapatır.
 */
export function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

// -------------------------------------------------------------
// GITHUB
// -------------------------------------------------------------

/**
 * GitHub'a giden isteklerde kullanılacak başlıklar.
 *
 * GITHUB_TOKEN varsa kullanılıyor: kimliksiz istekler saatte 60 ile sınırlı ve commit
 * tarayıcısı bunu birkaç projede tüketir. Token yoksa özellik yine çalışır, yalnızca daha
 * az proje taranabilir — bu yüzden zorunlu tutulmuyor.
 */
function githubHeaders(): Record<string, string> {
  const token = env('GITHUB_TOKEN');
  return {
    'User-Agent': 'Code4Ever-Platform',
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export interface RepoFacts {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  language: string | null;
  description: string | null;
  ownerLogin: string;
}

/** Depoyu GitHub'dan okur. Yoksa (veya özel ise) null döner. */
export async function readRepo(fullName: string): Promise<RepoFacts | null> {
  const [owner, repo] = fullName.split('/');
  const response = await safeFetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: githubHeaders(), allowedHosts: ['api.github.com'], timeoutMs: 10000, maxResponseBytes: 512 * 1024 }
  );
  if (!response.ok) return null;

  try {
    const data = JSON.parse(response.text || '{}');
    if (!data?.full_name) return null;
    return {
      fullName: String(data.full_name),
      htmlUrl: String(data.html_url || `https://github.com/${data.full_name}`).slice(0, 300),
      defaultBranch: String(data.default_branch || 'main').slice(0, 100),
      language: data.language ? String(data.language).slice(0, 40) : null,
      description: data.description ? String(data.description).slice(0, 600) : null,
      ownerLogin: String(data.owner?.login || '').slice(0, 39)
    };
  } catch {
    return null;
  }
}

export interface CommitFacts {
  sha: string;
  message: string;
  authorName: string;
  committedAt: string | null;
  url: string;
}

/** Dalın en son commit'i. */
export async function readLatestCommit(fullName: string, branch: string): Promise<CommitFacts | null> {
  const [owner, repo] = fullName.split('/');
  const response = await safeFetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(branch)}`,
    { headers: githubHeaders(), allowedHosts: ['api.github.com'], timeoutMs: 10000, maxResponseBytes: 1024 * 1024 }
  );
  if (!response.ok) return null;

  try {
    const data = JSON.parse(response.text || '{}');
    if (!data?.sha) return null;
    return {
      sha: String(data.sha).slice(0, 40),
      // Yalnızca ilk satır: commit gövdeleri sayfalarca olabiliyor ve bildirimde tek satır
      // gösteriliyor.
      message: String(data.commit?.message || '').split('\n')[0].slice(0, 200),
      authorName: String(data.commit?.author?.name || data.author?.login || '').slice(0, 80),
      committedAt: data.commit?.author?.date ? String(data.commit.author.date) : null,
      url: String(data.html_url || '').slice(0, 300)
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// PROJE KAYITLARI
// -------------------------------------------------------------

const PROJECT_FIELDS =
  'id,owner_id,owner_username,name,about,repo_full_name,repo_url,repo_default_branch,language,' +
  'likes_count,followers_count,last_commit_sha,last_commit_at,last_checked_at,created_at';

export async function findProjectById(id: string): Promise<any | null> {
  const { ok, rows } = await rest(
    `projects?id=eq.${encodeURIComponent(id)}&is_deleted=eq.false&select=${PROJECT_FIELDS}&limit=1`
  );
  return ok && rows.length ? rows[0] : null;
}

export async function findProjectByRepo(fullName: string): Promise<any | null> {
  // ilike: GitHub depo adları büyük/küçük harf duyarsız, şemadaki tekillik indeksi de öyle.
  const { ok, rows } = await rest(
    `projects?repo_full_name=ilike.${encodeURIComponent(fullName)}&is_deleted=eq.false&select=${PROJECT_FIELDS}&limit=1`
  );
  return ok && rows.length ? rows[0] : null;
}

export async function insertProject(row: Record<string, unknown>): Promise<any | null> {
  const { ok, rows } = await rest(`projects?select=${PROJECT_FIELDS}`, {
    method: 'POST',
    body: JSON.stringify(row),
    headers: { Prefer: 'return=representation' }
  });
  return ok && rows.length ? rows[0] : null;
}

export async function updateProject(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { ok } = await rest(`projects?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  return ok;
}

export async function softDeleteProject(id: string): Promise<boolean> {
  return updateProject(id, { is_deleted: true });
}

// -------------------------------------------------------------
// BEĞENİ VE TAKİP
// -------------------------------------------------------------

export type Relation = 'like' | 'follow';

const TABLE: Record<Relation, string> = {
  like: 'project_likes',
  follow: 'project_follows'
};

/**
 * Beğeni/takip satırını ekler veya kaldırır ve SONUÇ DURUMU döner.
 *
 * Aç/kapa (toggle) yerine açık `on` parametresi alıyor: aç/kapa, iki sekmeden aynı anda
 * basıldığında ya da bir istek yeniden denendiğinde durumu ters çevirir ve kullanıcı
 * beğendiğini sanırken beğenisi geri alınmış olur. Açık istek tekrar gönderilse de sonuç
 * aynı kalır.
 */
export async function setRelation(
  relation: Relation,
  projectId: string,
  userId: string,
  on: boolean
): Promise<boolean> {
  const table = TABLE[relation];

  if (!on) {
    const { ok } = await rest(
      `${table}?project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    return ok;
  }

  // Zaten varsa çakışmayı yok say: ikinci kez beğenmek hata değil, aynı sonuç.
  const { ok } = await rest(table, {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, user_id: userId }),
    headers: { Prefer: 'resolution=ignore-duplicates' }
  });
  return ok;
}

/** Üyenin bu projelerle ilişkisi: {projectId: true} biçiminde. */
export async function readRelations(
  relation: Relation,
  userId: string,
  projectIds: string[]
): Promise<Record<string, boolean>> {
  if (!userId || projectIds.length === 0) return {};
  const list = projectIds.map((id) => `"${id}"`).join(',');
  const { ok, rows } = await rest(
    `${TABLE[relation]}?user_id=eq.${encodeURIComponent(userId)}&project_id=in.(${encodeURIComponent(list)})&select=project_id`
  );
  if (!ok) return {};

  const map: Record<string, boolean> = {};
  for (const row of rows) map[String(row.project_id)] = true;
  return map;
}

export async function readFollowerIds(projectId: string): Promise<string[]> {
  const { ok, rows } = await rest(
    `project_follows?project_id=eq.${encodeURIComponent(projectId)}&select=user_id`
  );
  return ok ? rows.map((r) => String(r.user_id)).filter(Boolean) : [];
}

// -------------------------------------------------------------
// LİSTELER VE LİDERLİK TABLOLARI
// -------------------------------------------------------------

export type ProjectSort = 'new' | 'top' | 'mine';

export async function listProjects(options: {
  sort: ProjectSort;
  ownerId?: string;
  limit: number;
}): Promise<any[]> {
  const order = options.sort === 'top' ? 'likes_count.desc,created_at.desc' : 'created_at.desc';
  const ownerFilter = options.sort === 'mine' && options.ownerId
    ? `&owner_id=eq.${encodeURIComponent(options.ownerId)}`
    : '';

  const { ok, rows } = await rest(
    `projects?is_deleted=eq.false${ownerFilter}&select=${PROJECT_FIELDS}&order=${order}&limit=${options.limit}`
  );
  return ok ? rows : [];
}

/**
 * Haftanın projesi: SON 7 GÜNDE en çok beğeni ALAN proje.
 *
 * Toplam beğeniye bakmak yanlış olurdu — o zaman "haftanın projesi" birkaç hafta sonra
 * kalıcı olarak "tüm zamanların projesi" ile aynı şeye dönüşür ve yeni projelerin hiç şansı
 * kalmaz. Bu yüzden beğeni SATIRLARI tarihe göre sayılıyor; şemadaki ayrı tablo tam olarak
 * bunu mümkün kılmak için var (JSONB dizisinde "ne zaman beğenildi" bilgisi yoktur).
 */
export async function projectOfTheWeek(): Promise<{ project: any; weeklyLikes: number } | null> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { ok, rows } = await rest(
    `project_likes?created_at=gte.${encodeURIComponent(since)}&select=project_id&limit=5000`
  );
  if (!ok || rows.length === 0) return null;

  const tally = new Map<string, number>();
  for (const row of rows) {
    const id = String(row.project_id);
    tally.set(id, (tally.get(id) || 0) + 1);
  }

  // Beğenisi silinmiş bir projeye ait olabilir; sıralamayı gezip ilk YAŞAYAN projeyi alıyoruz.
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  for (const [id, weeklyLikes] of ranked) {
    const project = await findProjectById(id);
    if (project) return { project, weeklyLikes };
  }
  return null;
}

export async function allTimeTop(): Promise<any | null> {
  const rows = await listProjects({ sort: 'top', limit: 1 });
  // Hiç beğeni almamış bir projeyi "tüm zamanların en çok beğenileni" diye sunmak, tabloyu
  // anlamsız kılar; henüz kimse beğenmediyse ödül de yoktur.
  return rows.length && Number(rows[0].likes_count) > 0 ? rows[0] : null;
}

// -------------------------------------------------------------
// BİLDİRİM
// -------------------------------------------------------------

/**
 * Takipçilere yeni commit bildirimi bırakır.
 *
 * Proje sahibi listeden çıkarılır: kendi commit'ini kendine haber vermek gürültüdür.
 */
export async function notifyFollowers(
  project: any,
  commit: CommitFacts,
  followerIds: string[]
): Promise<number> {
  const recipients = followerIds.filter((id) => id && id !== project.owner_id);
  if (recipients.length === 0) return 0;

  const now = new Date().toISOString();
  const rows = recipients.map((recipientId) => ({
    id: `ntf_${crypto.randomBytes(9).toString('hex')}`,
    recipient_id: recipientId,
    type: 'project_commit',
    actor: {
      username: project.owner_username,
      display_name: project.owner_username,
      avatar_url: ''
    },
    content: `"${project.name}" projesine yeni commit: ${commit.message}`,
    target_id: project.id,
    is_read: false,
    created_at: now
  }));

  const { ok } = await rest('notifications', { method: 'POST', body: JSON.stringify(rows) });
  return ok ? rows.length : 0;
}

// -------------------------------------------------------------
// COMMIT TARAYICISI
// -------------------------------------------------------------

export interface WatchResult {
  checked: number;
  newCommits: number;
  notified: number;
  failed: number;
  timedOut: boolean;
}

/**
 * En uzun süredir bakılmamış projeleri sırayla kontrol eder.
 *
 * SÜRE BÜTÇESİ: sunucusuz fonksiyonun bir süre sınırı var ve proje sayısı büyüdükçe tam tur
 * oraya sığmaz. Bütçe dolduğunda tur temiz biçimde kesiliyor; sıradaki tur kaldığı yerden
 * devam ediyor çünkü sıralama `last_checked_at` alanına göre ve o alan her kontrolde
 * yazılıyor. Yani hiçbir proje aç kalmaz, yalnızca sırası gelir.
 *
 * SIRA ÖNEMLİ: `last_commit_sha` bildirimler GÖNDERİLDİKTEN SONRA yazılıyor. Tersi olsaydı,
 * damgalama ile bildirim arasında düşen bir çağrı o commit'i sonsuza dek "bildirilmiş"
 * sayardı ve takipçiler o commit'i hiç görmezdi.
 */
export async function runCommitWatch(options: {
  budgetMs?: number;
  maxProjects?: number;
} = {}): Promise<WatchResult> {
  const budgetMs = options.budgetMs === undefined ? 20000 : Math.max(1000, options.budgetMs);
  const maxProjects = options.maxProjects === undefined ? 25 : Math.max(1, options.maxProjects);
  const deadline = Date.now() + budgetMs;

  const result: WatchResult = { checked: 0, newCommits: 0, notified: 0, failed: 0, timedOut: false };

  const { ok, rows } = await rest(
    `projects?is_deleted=eq.false&select=${PROJECT_FIELDS}&order=last_checked_at.asc.nullsfirst&limit=${maxProjects}`
  );
  if (!ok) return result;

  for (const project of rows) {
    if (Date.now() >= deadline) {
      result.timedOut = true;
      break;
    }

    const branch = project.repo_default_branch || 'main';
    const commit = await readLatestCommit(project.repo_full_name, branch);
    result.checked++;

    if (!commit) {
      // Depo silinmiş, özelleştirilmiş ya da GitHub geçici olarak yanıt vermiyor olabilir.
      // Sayaç, arayüzde "bu projeye ulaşılamıyor" demeyi mümkün kılıyor; tur devam ediyor.
      result.failed++;
      await updateProject(project.id, {
        last_checked_at: new Date().toISOString(),
        check_failures: Number(project.check_failures || 0) + 1
      });
      continue;
    }

    const isNew = commit.sha !== project.last_commit_sha;

    // İLK KONTROL BİLDİRİM ÜRETMEZ. Proje eklendiği anda mevcut son commit "yeni" görünür;
    // bildirim gönderilseydi her yeni proje, olmamış bir olay için takipçilerine posta
    // atardı (ve takipçisi henüz yoktur zaten).
    const firstEverCheck = !project.last_commit_sha;

    if (isNew && !firstEverCheck) {
      const followers = await readFollowerIds(project.id);
      result.notified += await notifyFollowers(project, commit, followers);
      result.newCommits++;
    }

    await updateProject(project.id, {
      last_commit_sha: commit.sha,
      last_commit_at: commit.committedAt,
      last_checked_at: new Date().toISOString(),
      check_failures: 0
    });
  }

  return result;
}
