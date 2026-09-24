/**
 * Tarayıcı tarafındaki Lanux akışı.
 *
 * Burada hiçbir sır yok ve olmamalı: client_secret, PKCE doğrulayıcısı ve yenileme belirteci
 * sunucuda kalır. Bu dosyanın yaptığı tek şey akışı başlatmak, dönüşte bekleyen oturumu
 * teslim almak ve onu Supabase oturumuna çevirmek.
 */

import { apiFetchJson } from './apiClient';
import { getSupabaseClient } from './supabaseClient';

export interface LanuxStatus {
  configured: boolean;
  reason: string | null;
  lanux: { linked: boolean; username?: string | null };
  github: { linked: boolean; username?: string | null };
}

/**
 * Akışı başlatır ve kullanıcıyı Lanux'a gönderir.
 *
 * Neden önce fetch, sonra yönlendirme: 'link' kipinde sunucunun kimin hesabına bağlanacağını
 * bilmesi gerekiyor ve oturum `Authorization` başlığında taşınıyor. Üst düzey bir yönlendirme
 * o başlığı taşımaz, bu yüzden adresi önce fetch ile alıp oraya kendimiz gidiyoruz.
 */
export async function startLanuxFlow(mode: 'login' | 'link' = 'login'): Promise<{ ok: boolean; error?: string }> {
  const { ok, data } = await apiFetchJson<{ url: string; message?: string; error?: string }>(
    `/api/auth/lanux/start${mode === 'link' ? '?mode=link' : ''}`,
    // Giriş akışında henüz oturum yok; başlık göndermeye çalışmak gereksiz.
    { auth: mode === 'link' }
  );

  if (!ok || !data?.url) {
    return { ok: false, error: data?.message || 'Lanux girişi şu anda kullanılamıyor.' };
  }

  window.location.href = data.url;
  return { ok: true };
}

/**
 * Lanux'tan dönüşte bekleyen oturumu alıp gerçek bir Supabase oturumuna çevirir.
 *
 * Uygulama açılışında çağrılır. Bekleyen bir oturum yoksa sessizce hiçbir şey yapmaz —
 * normal açılışların ezici çoğunluğu budur.
 */
export async function claimPendingLanuxSession(): Promise<boolean> {
  // Sunucu dönüşte adrese bir işaret bırakıyor; işaret yoksa ağa hiç çıkmıyoruz.
  const params = new URLSearchParams(window.location.search);
  if (!params.has('lanux')) return false;

  const { ok, data } = await apiFetchJson<{ token_hash?: string }>('/api/auth/lanux/session', {
    method: 'POST',
    auth: false
  });
  if (!ok || !data?.token_hash) return false;

  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' });

  // İşaret tüketildi: adres çubuğunu temizle ki yenilemede tekrar denenmesin.
  const url = new URL(window.location.href);
  url.searchParams.delete('lanux');
  window.history.replaceState({}, '', url.toString());

  return !error;
}

export async function fetchLanuxStatus(): Promise<LanuxStatus | null> {
  const { ok, data } = await apiFetchJson<LanuxStatus>('/api/auth/lanux/status');
  return ok && data ? data : null;
}

export async function unlinkLanux(): Promise<{ ok: boolean; error?: string }> {
  const { ok, data } = await apiFetchJson<{ message?: string }>('/api/auth/lanux/unlink', {
    method: 'POST'
  });
  return ok ? { ok: true } : { ok: false, error: data?.message || 'Bağlantı kaldırılamadı.' };
}

/**
 * GitHub hesabını bağlar — girişteki akışın aynısı.
 *
 * Kullanıcı adı artık hiçbir yerde elle yazılmıyor. Sunucu onu, yetkilendirme tamamlandıktan
 * sonra Supabase auth kaydına düşen GitHub kimliğinden okuyor; yani bağlanan hesabın gerçekten
 * o kişiye ait olduğunu GitHub kanıtlıyor.
 *
 * İki adım var ve sırası önemli:
 *   1. Önce sunucuya sorulur. GitHub ile giriş yapmış birinin kimliği auth kaydında zaten
 *      durur, dolayısıyla hiçbir yönlendirmeye gerek kalmadan bağlanır.
 *   2. Kimlik yoksa yetkilendirme başlatılır ve kullanıcı GitHub'a gider.
 */
export async function linkGithub(): Promise<{ ok: boolean; error?: string; redirecting?: boolean }> {
  const { ok, data } = await apiFetchJson<{ error?: string; message?: string }>('/api/auth/github/link', {
    method: 'POST'
  });

  if (ok) return { ok: true };

  if (data?.error === 'github_already_linked') {
    return { ok: false, error: data.message || 'Bu GitHub hesabı başka bir hesaba bağlı.' };
  }

  if (data?.error !== 'needs_authorization') {
    return { ok: false, error: data?.message || 'GitHub hesabı bağlanamadı.' };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'GitHub bağlantısı şu anda kullanılamıyor.' };

  // Girişle aynı sağlayıcı ve aynı tam sayfa yönlendirmesi; dönüşteki işareti
  // AccountLinksSettings okuyup bağlamayı tamamlıyor.
  const redirectTo = new URL(window.location.href);
  redirectTo.searchParams.set('github', 'linking');

  const { error } = await client.auth.linkIdentity({
    provider: 'github',
    options: { redirectTo: redirectTo.toString(), scopes: 'read:user' }
  });

  if (error) {
    /*
     * "Identity is already linked": hesapta GitHub kimliği ZATEN var demek — yani üye
     * GitHub ile kayıt olmuş. Bu durumda sunucunun kullanıcı adını kimlikten okuyup
     * bitirmiş olması gerekirdi; okuyamadıysa sebebi genelde yapılandırmadır
     * (SUPABASE_SERVICE_ROLE_KEY eksikse yönetici API'sine hiç ulaşılamaz).
     *
     * Bir kez daha deniyoruz: geçici bir aksaklıksa bu onu çözer. Hâlâ olmuyorsa
     * kullanıcıya İNGİLİZCE ham hata yerine ne olduğunu söylüyoruz — "hata veriyor"
     * diye geri bildirilen şey tam olarak o ham hataydı.
     */
    if (/already linked/i.test(error.message)) {
      const healed = await reconcileGithubLink({ force: true });
      if (healed) return { ok: true };
      return {
        ok: false,
        error:
          'GitHub hesabın bu hesapta zaten bağlı görünüyor ama kaydedilemedi. ' +
          'Sunucu yapılandırması eksik olabilir; yöneticiye bildir.'
      };
    }

    // Supabase projesinde "Manual linking" kapalıysa buraya düşülür; sebebi gizlemek
    // kullanıcıyı da yöneticiyi de boşuna uğraştırır.
    return {
      ok: false,
      error: /manual linking/i.test(error.message)
        ? 'GitHub bağlama kapalı görünüyor (Supabase > Authentication > Manual linking).'
        : error.message
    };
  }

  return { ok: true, redirecting: true };
}

/**
 * GitHub ile kayıt olmuş üyelerin bağlantısını sessizce onarır.
 *
 * SORUN: GitHub ile kayıt olan birinin auth kaydında GitHub kimliği ZATEN vardır, ama
 * `profiles.github_username` sütununu hiçbir şey doldurmuyordu — o sütun sonradan eklendi.
 * Sonuç, üyeye zaten yaptığı bağlamayı yeniden yapmasını söylemekti: "GitHub hesabını bağla",
 * oysa hesabı o zaten GitHub'dı.
 *
 * ÇÖZÜM: bağlama ucu kullanıcı adını auth kaydındaki kimlikten okuyor, yani yetkilendirmeye
 * hiç gitmeden çalışabiliyor. Burada tam olarak o çağrılıyor. Kimlik yoksa uç
 * `needs_authorization` döner ve hiçbir şey olmaz — üye Ayarlar'dan kendisi bağlar.
 *
 * Oturum başına EN FAZLA BİR KEZ denenir: kimliği olmayan üyede her açılışta boşuna istek
 * göndermek, düzeltmeye çalıştığımız sorundan daha pahalı olurdu.
 */
const RECONCILE_FLAG = 'c4e_github_reconciled';

export async function reconcileGithubLink(options: { force?: boolean } = {}): Promise<string | null> {
  // `force`: üye proje oluşturmaya çalışıyor, yani onarımın önemli olduğu tek an. Oturum
  // bayrağı yüzünden bu denemeyi atlamak, kullanıcıyı çözülebilir bir engelin önünde
  // bırakırdı.
  if (!options.force) {
    try {
      if (sessionStorage.getItem(RECONCILE_FLAG)) return null;
      sessionStorage.setItem(RECONCILE_FLAG, '1');
    } catch {
      // Gizli sekmede sessionStorage erişimi hata verebilir; bayrak tutulamazsa da akış
      // çalışmalı, yalnızca tekrar denenir.
    }
  }

  const { ok, data } = await apiFetchJson<{ username?: string }>('/api/auth/github/link', {
    method: 'POST'
  });
  return ok && data?.username ? data.username : null;
}

export async function unlinkGithub(): Promise<{ ok: boolean; error?: string }> {
  const { ok, data } = await apiFetchJson<{ message?: string }>('/api/auth/github/unlink', {
    method: 'POST'
  });
  return ok ? { ok: true } : { ok: false, error: data?.message || 'Bağlantı kaldırılamadı.' };
}
