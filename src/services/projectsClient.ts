/**
 * Proje vitrininin tarayıcı tarafı.
 *
 * Burada hiçbir karar verilmiyor: beğeni sayısı, takipçi sayısı ve sıralama sunucudan
 * geldiği gibi gösteriliyor. İstemcinin sayacı kendi kendine artırması iki sekme arasında
 * farklı sayılar gösterir ve "haftanın projesi" gibi bir yarışmada yanlış sayı, yanlış
 * kazanandan daha kötüdür — kimse neye güveneceğini bilemez.
 */

import { apiFetchJson } from './apiClient';

export interface Project {
  id: string;
  owner_id: string;
  owner_username: string;
  name: string;
  about: string | null;
  repo_full_name: string;
  repo_url: string;
  language: string | null;
  likes_count: number;
  followers_count: number;
  last_commit_sha: string | null;
  last_commit_at: string | null;
  created_at: string;
  liked_by_me?: boolean;
  followed_by_me?: boolean;
  /** Yalnızca "haftanın projesi" kartında dolu gelir. */
  weekly_likes?: number;
}

export type ProjectSort = 'new' | 'top' | 'mine';

export async function fetchProjects(sort: ProjectSort = 'new'): Promise<Project[]> {
  const { ok, data } = await apiFetchJson<{ projects: Project[] }>(`/api/projects?sort=${sort}`);
  return ok && data?.projects ? data.projects : [];
}

export interface Highlights {
  week: Project | null;
  all_time: Project | null;
}

export async function fetchHighlights(): Promise<Highlights> {
  const { ok, data } = await apiFetchJson<Highlights>('/api/projects/highlights');
  return ok && data ? { week: data.week ?? null, all_time: data.all_time ?? null } : { week: null, all_time: null };
}

const CREATE_ERRORS: Record<string, string> = {
  github_required: 'Proje ekleyebilmek için önce Ayarlar > Bağlı Hesaplar bölümünden GitHub hesabını bağla.',
  invalid_repo: 'Depo adı "kullanıcı/depo" biçiminde olmalı.',
  repo_not_found: 'Depo bulunamadı. Herkese açık bir depo olmalı.',
  not_your_repo: 'Yalnızca kendi GitHub hesabındaki depoları ekleyebilirsin.',
  repo_already_added: 'Bu depo için zaten bir proje var.'
};

export async function createProject(input: {
  repo: string;
  name: string;
  about: string;
}): Promise<{ ok: boolean; project?: Project; error?: string }> {
  const { ok, data } = await apiFetchJson<{ project: Project; error?: string; message?: string }>(
    '/api/projects',
    { method: 'POST', json: input }
  );

  if (ok && data?.project) return { ok: true, project: data.project };
  return {
    ok: false,
    error: CREATE_ERRORS[String(data?.error)] || data?.message || 'Proje oluşturulamadı.'
  };
}

/**
 * Beğeni / takip.
 *
 * İstenen durum AÇIKÇA gönderiliyor (aç/kapa değil): iki sekmeden aynı anda basıldığında ya
 * da bir istek yeniden denendiğinde aç/kapa durumu ters çevirir ve kullanıcı beğendiğini
 * sanırken beğenisi geri alınmış olur.
 */
export async function setProjectRelation(
  projectId: string,
  relation: 'like' | 'follow',
  on: boolean
): Promise<{ ok: boolean; likes_count?: number; followers_count?: number }> {
  const { ok, data } = await apiFetchJson<{ likes_count: number; followers_count: number }>(
    `/api/projects/${encodeURIComponent(projectId)}/${relation}`,
    { method: 'POST', json: { on } }
  );
  return ok && data
    ? { ok: true, likes_count: data.likes_count, followers_count: data.followers_count }
    : { ok: false };
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const { ok } = await apiFetchJson(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE'
  });
  return ok;
}

/** Üyenin kendi GitHub depoları — proje oluşturma ekranındaki seçim listesi. */
export interface RepoOption {
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
}

export async function fetchOwnRepos(githubUsername: string): Promise<RepoOption[]> {
  const { ok, data } = await apiFetchJson<any>(
    `/api/github/repos?username=${encodeURIComponent(githubUsername)}&per_page=100`
  );
  if (!ok) return [];

  // Uç, sürümüne göre ya doğrudan dizi ya da { repos: [...] } döndürüyor; ikisini de kabul
  // etmek, tek bir alan adı değişikliğinde listenin sessizce boşalmasını engelliyor.
  const list = Array.isArray(data) ? data : Array.isArray(data?.repos) ? data.repos : [];
  return list.map((r: any) => ({
    full_name: String(r.full_name || ''),
    name: String(r.name || ''),
    description: r.description ? String(r.description) : null,
    language: r.language ? String(r.language) : null,
    stargazers_count: Number(r.stargazers_count || 0)
  })).filter((r: RepoOption) => r.full_name.includes('/'));
}
