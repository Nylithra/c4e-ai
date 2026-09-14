# Code4Ever — Güvenlik Notları / Security Notes

Bu belge, projede yapılan güvenlik sertleştirmesini, dağıtım (deployment) adımlarını ve
bilinen sınırlamaları özetler.

---

## 1. Yapılan düzeltmeler

### 1.1 Kritik — Veritabanı erişim kontrolü (Supabase RLS)

**Önce:** Tüm tablolarda `USING (true) WITH CHECK (true)` politikaları vardı ve `anon`
rolüne `GRANT ALL` verilmişti. Tarayıcı paketinde açıkça görünen anon anahtarıyla herkes:

- başka bir üyenin profilini (ve `is_admin` alanını) değiştirebiliyor veya silebiliyor,
- herhangi bir gönderiyi, ilanı veya topluluğu düzenleyip silebiliyor,
- **veritabanındaki tüm özel mesajları okuyabiliyordu.**

**Sonra:** `supabase_schema.sql` tamamen yeniden yazıldı:

- Her tablo için sahip bazlı `SELECT / INSERT / UPDATE / DELETE` politikaları.
- `anon` rolü yalnızca herkese açık tablolarda **salt okunur**; yazma işlemleri oturum ister.
- Mesajlar yalnızca konuşmanın taraflarına görünür (`is_conversation_participant`).
- İş başvuruları (ad, yaş, deneyim gibi kişisel veriler) yalnızca başvuran, ilan sahibi ve
  yöneticiler tarafından okunabilir.
- Beğeni/repost/yer imi/yorum ve topluluğa katılma gibi etkileşimler herkese açık kalır;
  `BEFORE UPDATE` tetikleyicileri bu yazmaları **yalnızca etkileşim sütunlarıyla** sınırlar,
  böylece bir beğeni gönderi içeriğini değiştiremez.
- `protect_profile_privileges` tetikleyicisi `is_admin`, `verified`, `supporter_tier`,
  ban/askı ve kapalı beta onayı alanlarını korur; ayrılmış kullanıcı adları alınamaz.

> `src/utils/supabaseSql.ts` artık bu dosyayı doğrudan içe aktarır: Ayarlar → Veritabanı
> ekranında gösterilen kurulum betiği ile depodaki şema her zaman aynıdır.

### 1.2 Kritik — Yetki yükseltme (client)

`verifyAdminAccess()` daha önce serbest metin `role` alanına, e-postaya ve `rifat`,
`atesrifail` gibi **rezerve olmayan** kullanıcı adlarına bakıyordu. Herhangi biri profilinde
rolüne "admin" yazarak veya bu kullanıcı adlarını alarak yönetici oluyordu.
Artık yalnızca veritabanı kaynaklı `is_admin` bayrağı ve rezerve sistem hesapları geçerlidir.
Aynı hata `CommunitySettingsModal` (topluluk sahipliği) ve `deletePostInSupabase` içinde de
düzeltildi.

### 1.3 Kritik — Bağış / Spark ayrıcalıklarının taklit edilmesi

`/api/bynogame/register-donation`, `/approve-donation` ve `/webhook` uç noktaları kimlik
doğrulaması olmadan çalışıyordu; `secretKey` parametresi okunuyor ama **hiç
doğrulanmıyordu**. Herkes kendine "Spark Destekçi" rozeti ve 250MB yükleme hakkı
tanımlayabiliyordu.

- `register-donation`, `approve-donation`, `donations` → yalnızca yönetici.
- `webhook` → gövdenin HMAC-SHA256 imzası (`X-C4E-Signature`) zorunlu.
- `claim-donation` → oturum zorunlu, saatte 5 istek, kayıt **doğrulanmamış** olarak açılır.
- Ayrıcalıklar artık `profiles.supporter_tier` (yalnızca backend/yönetici yazabilir)
  sütunundan okunur. `isUserSpark()` artık kullanıcının düzenleyebildiği `role`, `badges`
  ve `subscription` alanlarına bakmaz.

### 1.4 Yüksek — SSRF (Server Side Request Forgery)

`/api/integrations/webhook/*` uç noktaları, gövdede gelen herhangi bir URL'ye istek
gönderiyordu; `/api/posts/delete` ise tarayıcıdan gelen Supabase URL + anahtarını kullanıyordu.
Bu, sunucunun iç ağa veya bulut metadata servisine (169.254.169.254) istek atmasına izin verir.

`src/server/security.ts` içindeki `safeFetch`:

- yalnızca `https://`,
- yalnızca izin listesindeki alan adları (Discord / Telegram / Jubbio / GitHub / Groq / Supabase),
- DNS çözümlemesi sonrası özel/loopback/link-local IP reddi,
- yönlendirme takibi kapalı (`redirect: 'manual'`), zaman aşımı ve yanıt boyutu sınırı.

`/api/posts/delete` artık tarayıcıdan Supabase kimlik bilgisi almaz; silme işlemi **çağıranın
kendi oturum belirteciyle** yapılır, yetkiyi RLS verir.

### 1.5 Yüksek — GitHub OAuth akışı

- `state` parametresi artık HMAC ile imzalanır ve 10 dakika içinde doğrulanır (CSRF).
- Geri dönüş sayfası `postMessage(..., '*')` yerine **tam origin** hedefi kullanır.
- GitHub yanıtı HTML'e `JSON.stringify` ile gömülüyordu → `</script>` kaçışı ile XSS.
  Artık `jsonForScript()` ile kaçışlanır ve yalnızca gerekli alanlar döner.
- Bozuk `<!Process HTML>` doctype düzeltildi, istenen kapsam `repo` → `public_repo`.

### 1.6 Orta — Kimlik doğrulama, hız sınırı ve genel sertleştirme

- `/api/everychat` (ücretli LLM) artık oturum ister; mesaj sayısı/uzunluğu sınırlı, kullanıcı
  başına 5 dakikada 25 istek. Sağlayıcı hata metni istemciye sızdırılmaz.
- Hız sınırlayıcı: `trust proxy` ayarına saygı duyar, kayıtları temizler (bellek sızıntısı yok),
  uç nokta bazlı limitler.
- `express.json` 256 kB ile sınırlandı; 413/400 için düzgün hata yanıtları.
- Güvenlik başlıkları: sıkılaştırılmış CSP (`unsafe-eval` ve joker `https:` kaldırıldı),
  `frame-ancestors 'none'`, `X-Frame-Options`, `Permissions-Policy`, COOP/CORP.
  Kullanımdan kalkmış `X-XSS-Protection` kaldırıldı.
- Depoya işlenmiş canlı topluluk API anahtarları (`c4e_comm_*_live`) kaldırıldı.
- Bağış defteri atomik olarak (`tmp` + `rename`) ve `0600` izinle yazılır, kayıt sayısı sınırlı.
- `sanitizeUrl()`: kontrol karakteriyle gizlenmiş `java\nscript:` şemaları, `data:image/svg+xml`
  (script taşıyabilir), protokole bağlı `//evil.tld` adresleri ve bilinmeyen şemalar reddedilir.

### 1.7 Hata düzeltmeleri

- **`index.html` mevcut olmayan `/src/bakim.tsx` dosyasını yüklüyordu** → uygulama hiç
  açılmıyordu (beyaz ekran). `/src/main.tsx` geri getirildi.
- `CommunitySettingsModal` hook'ları erken `return null`'dan sonra çağırıyordu ve farklı bir
  topluluk açıldığında form eski değerlerde kalıyordu.
- Mobilde yakınlaştırmayı engelleyen `user-scalable=no` kaldırıldı (erişilebilirlik).

---

## 2. Dağıtım adımları (ÖNEMLİ)

1. **SQL'i çalıştırın:** `supabase_schema.sql` dosyasının tamamını Supabase SQL Editor'de
   çalıştırın. Betik idempotenttir (tekrar tekrar çalıştırılabilir) ve mevcut verileri korur;
   eski "her şeye izin ver" politikalarını siler, eksik sütunları ekler, mevcut Spark
   destekçilerini `supporter_tier = 'spark'` olarak işaretler ve `nylithra` hesabına
   `is_admin` verir.
2. **Ortam değişkenlerini ayarlayın:** `.env.example` dosyasındaki tüm değerleri doldurun.
   En kritikleri: `SUPABASE_SERVICE_ROLE_KEY`, `OAUTH_STATE_SECRET`,
   `BYNOGAME_WEBHOOK_SECRET`, `APP_URL`, `TRUST_PROXY`.
   `SUPABASE_SERVICE_ROLE_KEY` olmadan sunucu oturumların yönetici olup olmadığını
   doğrulayamaz ve Spark ayrıcalıklarını tanımlayamaz.
3. **Anahtarları yenileyin:** Depo geçmişinde bulunan tüm canlı anahtarları (Supabase anon
   anahtarı dahil değilse de, sızmış olabilecek servis anahtarları, bot tokenları, topluluk
   API anahtarları) iptal edip yeniden oluşturun.
4. **Firestore kullanılıyorsa** `firestore.rules` dosyasını dağıtın.

---

## 3. Bilinen sınırlamalar

- **Mesajlaşma gerçek anlamda E2EE değildir.** AES anahtarı, herkese açık istemci paketindeki
  sabit bir değer ve konuşma kimliğinden türetilir; satırı okuyabilen anahtarı da türetebilir.
  Gizliliği bugün sağlayan şey RLS politikasıdır. Ayrıntı ve önerilen ECDH tabanlı çözüm için
  `src/utils/e2eeHelper.ts` başındaki nota bakın. Bu düzeltilene kadar arayüzde/pazarlamada
  "uçtan uca şifreli" ifadesi kullanılmamalıdır.
- **CSP `'unsafe-inline'` içerir** (Vite geliştirme sunucusunun react-refresh betiği için).
  Üretimde nonce tabanlı bir CSP daha güçlü olur.
- **Yönetici kontrolü hâlâ istemcide görsel olarak yapılır.** Asıl yetki RLS'tedir; arayüzdeki
  kontroller yalnızca kullanıcı deneyimi içindir.
- **Moderasyon durumu (`isBanned`) `custom_fields` JSONB alanında tutulur.** Tetikleyici bu
  anahtarları korur, ancak uzun vadede ayrı ve tip güvenli sütunlar tercih edilmelidir.

---

## 4. Güvenlik açığı bildirimi

Bir güvenlik açığı bulursanız lütfen herkese açık bir issue açmadan önce proje
sorumlusuyla iletişime geçin.
