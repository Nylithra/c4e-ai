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

### 1.7 Gizli topluluklar (özel gönderi görünürlüğü)

`communities.is_private` işaretli bir topluluğun gönderileri yalnızca üyelerine gösterilir.
Zorlama veritabanı seviyesindedir: `posts` SELECT politikası
`is_hidden_community_post(community_id)` fonksiyonuyla, üyeliği `profiles.joined_communities`
üzerinden kontrol eder — yani anon anahtarla doğrudan PostgREST'e gidilse bile satırlar
dönmez. Arayüz tarafında `utils/communityVisibility.ts` aynı kuralı uygular (akış, keşfet,
yer imleri, profil). Topluluğun kendisi keşfedilebilir kalır; herkes katılabilir.
`is_private` alanını yalnızca topluluk sahibi/yöneticisi değiştirebilir (tetikleyici korur).

### 1.8 Hata düzeltmeleri

- **`index.html` mevcut olmayan `/src/bakim.tsx` dosyasını yüklüyordu** → uygulama hiç
  açılmıyordu (beyaz ekran). `/src/main.tsx` geri getirildi.
- `CommunitySettingsModal` hook'ları erken `return null`'dan sonra çağırıyordu ve farklı bir
  topluluk açıldığında form eski değerlerde kalıyordu.
- Mobilde yakınlaştırmayı engelleyen `user-scalable=no` kaldırıldı (erişilebilirlik).
- Spark teması seçildiğinde profil banner görselinin kaybolması düzeltildi: gradyan banner
  artık yalnızca kullanıcı açıkça istediğinde (veya yüklü banner yoksa) kullanılır.

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

> Topluluk API'si `SUPABASE_SERVICE_ROLE_KEY` olmadan çalışmaz; anahtar yoksa tüm uçlar
> dürüstçe 503 döner. `community_api_keys` tablosu şemayla birlikte gelir.

---

## 2.1 Topluluk HTTP Paylaşım API'si

Kamuya açık dokümantasyon: `/dev/docs`. Güvenlik tasarımı:

- **Anahtarlar düz metin olarak saklanmaz.** Veritabanında yalnızca SHA-256 özeti tutulur;
  düz metin yalnızca oluşturulma yanıtında bir kez döner. Sızan bir yedek tekrar oynatılamaz.
- **Arama özet üzerinden yapılır** (`key_hash` üzerinde benzersiz indeks). Ön ek taraması
  yoktur, dolayısıyla hangi ön eklerin var olduğunu sızdıran bir zamanlama kanalı da yoktur.
- **Tarayıcı anahtar materyaline erişemez.** `community_api_keys` tablosunda RLS açıktır ve
  `anon` / `authenticated` rollerine hiçbir GRANT verilmemiştir; yalnızca servis rolü okur.
  (Yerel PostgreSQL 16 üzerinde doğrulandı: her iki rol de `permission denied` alıyor.)
- **Hedef topluluk anahtardan belirlenir**, adresteki handle'dan değil. Bir topluluğun
  anahtarıyla başka bir topluluğa gönderi atılamaz (403).
- **İptal anında geçerlidir.** İptal edilmiş anahtar, hiç var olmamış gibi 401 döner.
- **Anahtar yönetimi oturum ister,** API anahtarı kabul edilmez: anahtarla anahtar
  yönetilemez. Yalnızca topluluğun kurucusu veya platform yöneticisi yönetebilir.
- **Girdi temizlenir:** kontrol karakterleri ve "Trojan Source" saldırılarında kullanılan
  çift yönlü (bidi) yazım geçersiz kılma karakterleri silinir; uzunluk sınırları uygulanır.
- **Hız sınırı:** yayınlama dakikada 30, okuma dakikada 60, genel API tavanı dakikada 120.
  Topluluk başına en fazla 10 etkin anahtar.

Bu davranışların tamamı gerçek Express rotaları üzerinden uçtan uca test edilmiştir
(35 doğrulama, tamamı geçti).

---

## 2.1 Dağıtım biçimi: Vercel mi, kalıcı sunucu mu?

Proje iki şekilde çalışabilir ve **yetenekleri farklıdır**:

| | Vercel (sunucusuz) | Kalıcı Node süreci (Railway / Render / Fly.io / VPS) |
|---|---|---|
| Frontend | ✅ | ✅ |
| Topluluk API, OAuth, admin uçları | ✅ | ✅ |
| E-posta **gönderme** (SMTP) | ✅ | ✅ |
| E-posta **okuma** (IMAP) | ❌ | ✅ |
| Kalıcı yerel dosya (bağış defteri) | ❌ geçici | ✅ |

**Vercel'de IMAP neden çalışmaz?** Gelen kutusu okumak, açık tutulan bir TCP oturumu
gerektirir. Sunucusuz fonksiyonlar istekler arasında dondurulur ve birkaç saniyelik süre
sınırı vardır; bağlantı ayakta kalamaz. Bu yüzden `getImapConfig()` sunucusuz ortamda
bilinçli olarak `null` döner ve arayüz sebebini açıkça yazar — zaman aşımına kadar bekleyip
belirsiz bir hata vermek yerine.

**Vercel kurulumu.** `vercel.json` içinde `/api/*` istekleri `api/index.ts` fonksiyonuna,
diğer her şey `index.html`'e yönlenir.

`api/` dizini **bilinçli olarak CommonJS**'tir (`api/package.json` → `"type": "commonjs"`),
oysa depo kökü Vite için `"type": "module"` kullanır. Node ve Vercel, bir dosyanın modül
sistemini **en yakın** package.json'dan seçer. Bu dosya olmadan fonksiyon ESM olarak
derleniyor; Express'in CommonJS bağımlılık ağacı bu ESM çıktısına paketlendiğinde çalışma
zamanı `Dynamic require of "path" is not supported` hatasıyla ölüyor ve bu dışarıya
`500 FUNCTION_INVOCATION_FAILED` olarak yansıyor. CommonJS her iki paketleme stratejisinde de
çalışır; ESM yalnızca birinde.

Aynı nedenle `api/tsconfig.json` ayrıdır: kök tsconfig `noEmit`, `allowImportingTsExtensions`
ve `moduleResolution: "bundler"` ile Vite'a göre ayarlıdır ve sunucusuz fonksiyonun TypeScript
derlemesini bozabilir. `api/index.ts` yalnızca `server.ts`'in dışa aktardığı
Express uygulamasını Vercel'e handler olarak verir; `server.ts` sunucusuz ortamı algılayınca
kendi `app.listen()` çağrısını atlar (`isServerless`).

> `vercel.json` daha önce **her** isteği `index.html`'e yönlendiriyordu; bu yüzden `/api/*`
> dahil hiçbir arka uç ucu Vercel'de çalışmıyordu. Yalnızca posta değil, Topluluk API'si,
> OAuth geri dönüşü ve bağış webhook'u da etkileniyordu.

Kalıcı bir süreçte hiçbir kod değişikliği gerekmez: `npm run build && npm start`.

---

## 2.2 E-posta konsolu (IMAP / SMTP)

Admin panelindeki **E-postalar** sekmesi; gelen kutusunu IMAP ile okur, kullanıcı adından
adres çözerek SMTP ile e-posta gönderir. Yapılandırma `.env` içindeki `MAIL_*` değişkenleridir.

- **Tüm uçlar `requireAdmin` arkasındadır.** Normal üye 403 alır; oturumsuz çağrı da 403 alır
  (401 ile ayrılmaz, böylece ucun varlığı sızdırılmaz).
- **Bağlantı hedefi istekten alınmaz.** Sunucu, port ve kimlik bilgileri yalnızca ortam
  değişkenlerinden okunur. Aksi halde bu uç bir SSRF ve kimlik bilgisi sızdırma aracı olurdu.
- **Başlık enjeksiyonu engellenir.** Konu, görünen ad ve alıcı alanlarındaki CR/LF karakterleri
  temizlenir. Doğrulandı: konuya `\r\nBcc: ...` yazmak ek başlık üretmiyor, zarfta yalnızca
  tek alıcı kalıyor.
- **Gelen posta güvenilmez kabul edilir.** Sunucu tarafında `<script>`, `<iframe>`, olay
  öznitelikleri (`onerror` vb.), `javascript:` bağları ve uzak görseller temizlenir; istemci
  bunu ayrıca **`sandbox` özniteliği boş bir iframe** içinde gösterir (script çalıştırma ve
  same-origin erişimi kapalı). İki bağımsız katman.
- **Uzak görseller varsayılan olarak engellidir**; yüklemek açık bir tıklama ister, çünkü
  uzak görsel yöneticinin IP adresini gönderene açar ve adresin canlı olduğunu doğrular.
- **Parola hiçbir yanıtta, hiçbir logda geçmez.** Durum ucu yalnızca sunucu/port/güvenli mi
  bilgisini döndürür.
- Hız sınırları: gönderme dakikada 20, bağlantı testi 6, gelen kutusu 30 (yönetici başına).

Logo, e-posta istemcileri SVG göstermediği için `public/logo.svg` dosyasından üretilmiş
`public/email-logo.png` olarak CID ile gömülür (`node scripts/build-email-logo.mjs`).

Bu davranışların tamamı gerçek bir SMTP ve IMAP sunucusuna karşı, gerçek Express rotaları
üzerinden uçtan uca test edildi (68 doğrulama, tamamı geçti).

---

## 2.3 Kapatılan gizlilik açığı: e-posta adresleri herkese açıktı

`profiles` tablosunda `GRANT SELECT` tablo genelindeydi ve `profiles_select_public` politikası
`USING (true)` olduğundan, **herkese açık anon anahtarını** eline geçiren biri şunu çalıştırıp
platformdaki tüm e-posta adreslerini toplayabiliyordu:

```
GET /rest/v1/profiles?select=username,email
```

RLS satır bazlıdır, sütun bazlı değildir; bu yüzden politika bunu engelleyemez. Çözüm sütun
seviyesinde yetkilendirmedir: `email` dışındaki sütunlar `anon` ve `authenticated` rollerine
açık, `email` hiçbirine açık değil. Sütun listesi canlı tablodan türetilir, böylece sonradan
eklenen bir sütun otomatik okunabilir kalır ve yalnızca `email` kapalı olur.

Yazma yetkisi tablo seviyesinde kalır (üye kendi adresini kaydedebilmeli); hangi satırı
yazabileceğini RLS zaten sınırlıyor. İstemci, oturum sahibinin kendi adresini Supabase auth
oturumundan (`user.email`) aldığı için hiçbir arayüz bu sütuna ihtiyaç duymuyor.

Yerel PostgreSQL 16 üzerinde doğrulandı: `anon` ve `authenticated` için hem `SELECT email`
hem `SELECT *` "permission denied" veriyor, diğer sütunlar okunabiliyor, servis rolü
okuyabiliyor.

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
