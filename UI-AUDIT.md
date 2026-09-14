# Code4Ever — Arayüz Denetimi (UI Audit)

Gerçek tarayıcıda (Chromium), gerçekçi verilerle ve dört ekran boyutunda yapılan otomatik +
görsel denetimin sonuçları. Ölçülen boyutlar: **360×740** ve **390×844** (telefon, dokunmatik
emülasyonu açık), **768×1024** (tablet), **1280×900** (masaüstü). Taranan sayfalar: akış,
keşfet, iş ilanları, bildirimler, topluluklar, topluluk akışı, yer imleri, profil, ayarlar,
destek.

---

## 1. Kritik — Mobilde yatay taşma (düzeltildi)

**Bulgu.** 360px genişliğinde sayfanın düzen genişliği **551px**'e çıkıyordu. Telefon
tarayıcısı bunu "sığdırmak" için tüm arayüzü küçültüyor: yazılar okunamayacak kadar
ufalıyor, dokunma hedefleri daralıyor ve sayfa yana kayıyordu. Tablette (768px) de sayfa
39–60px taşıyordu.

**Kök neden.** Kullanıcı içeriğindeki boşluksuz uzun kelimeler ve uzun bağlantılar
kırılmıyordu (`overflow-wrap: normal`). 92 karakterlik tek bir kelime tüm sayfayı
genişletiyordu. Akış, keşfet, profil ve yer imleri aynı hatadan etkileniyordu.

**Düzeltme.** `.user-text` yardımcı sınıfı (`overflow-wrap: anywhere`) eklendi ve tüm
kullanıcı içeriği alanlarına uygulandı: gönderi metni, yorumlar, biyografi, topluluk
açıklaması.

**Doğrulama.** 360 / 390 / 768px'te `scrollWidth == innerWidth` (taşma yok).

---

## 2. Kritik — "Paylaş" butonu telefonda ekran dışında kalıyordu (düzeltildi)

**Bulgu.** Paylaşım kutusunun alt aksiyon çubuğu 390px'de 31px taşıyordu; gönderiyi
paylaşma butonu kısmen görünmez haldeydi.

**Kök neden.** İçteki `flex-1` sütunda `min-width: auto` (flexbox varsayılanı) vardı, bu
yüzden içerik daralamıyordu; aksiyon çubuğu da sarmalanmıyordu.

**Düzeltme.** `min-w-0` eklendi, aksiyon çubuğu `flex-wrap` yapıldı, dar telefonlarda
(≤416px) buton etiketleri gizlenip yalnızca ikonlar gösteriliyor.

---

## 3. Yüksek — Paylaşım kutusu telefonda ekranın %70'ini kaplıyordu (iyileştirildi)

Kategori seçici + topluluk seçici + 3 satır metin alanı + sayaç + iki aksiyon satırı, 844px
yüksekliğindeki bir telefonda akışın ilk gönderisini ekranın altına itiyordu.

**İyileştirme.** Paylaşım kutusu artık telefonda **tek satır** olarak açılıyor; kullanıcı
yazmaya başladığında (veya bir ek eklediğinde) kategori/topluluk seçicileri ve üç satırlık
alan beliriyor. Topluluk akışındayken hedef topluluk, kutu kapalıyken de küçük bir etiketle
görünür kalıyor.

---

## 4. Yüksek — Bozuk ve boş görseller (düzeltildi)

**Bulgu.** Profil fotoğrafı / banner / topluluk logosu URL'si çalışmadığında tarayıcının
"kırık görsel" ikonu görünüyordu (ayarlar, profil, iş ilanları, topluluk başlığı). Ayrıca
alanı boş olan kayıtlar `<img src="">` üretiyordu; bu her renderda konsol uyarısı basıyor ve
tarayıcının sayfanın kendisini yeniden indirmesine yol açıyordu.

**Düzeltme.**
- `utils/imageFallback.ts`: tek bir global `error` dinleyicisi, yüklenemeyen her görseli
  koyu paletle uyumlu bir yer tutucuyla (avatar veya banner) değiştiriyor.
- `UserAvatar` artık boş `src` değerini hiç render etmiyor, yerine baş harfleri gösteriyor.
- Kenar çubuğu, ayarlar ve sağ panelde kalan ham `<img>` avatarları `UserAvatar`'a taşındı.

---

## 5. Yüksek — PWA kurulum şeridi içeriği örtüyordu (düzeltildi)

Şerit alt gezinme çubuğunun hemen üzerinde sabit duruyor ve her sayfanın son kartını kalıcı
olarak kapatıyordu (ayarlarda "Dil Seçimi" kartı, akışta son gönderi).

**Düzeltme.** Şerit açıkken `body.has-pwa-banner` sınıfı ekleniyor ve mobilde içerik
sütununa şerit + gezinme çubuğu yüksekliği kadar alt boşluk veriliyor. Şeridi kapatma
butonunun dokunma alanı da 32×32px'e çıkarıldı.

---

## 6. Orta — Dokunma hedefleri çok küçüktü (düzeltildi)

Ölçülen 24px altı hedefler (WCAG 2.5.8 asgari 24×24px önerir):

| Öğe | Önce | Sonra |
|---|---|---|
| Gönderi menüsü ("...") | 23×28 | 28×28 (`shrink-0`) |
| Kod bloğu kopyala | 22×22 | 28×28 |
| Bildirim "okundu" noktası | 18×18 | 32×32 |
| Kategori temizleme (×) | 20×20 | 24×24 |
| Profil bağlantıları (web/GitHub) | yükseklik 16 | 24 |
| Paylaşım kutusu ek butonları | 34×22 | 34×32 |

---

## 7. Orta — Erişilebilirlik (düzeltildi)

- Avatar butonlarının erişilebilir adı yoktu (10 sayfada ekran okuyucu "buton" diyordu) →
  `aria-label` eklendi.
- Paylaşım kutusundaki topluluk `<select>`'inin etiketi yoktu → `aria-label` eklendi.
- Medya / Kod / Depo butonları dar ekranda ikona dönüştüğü için `aria-label` aldı.
- Tüm uygulamada görünür klavye odak halkası (`:focus-visible`) eklendi.

---

## 8. Orta — iOS'ta form alanına dokununca sayfa yakınlaşıyordu (düzeltildi)

iOS Safari, yazı tipi 16px'ten küçük bir alana odaklanınca sayfayı yakınlaştırır ve kullanıcı
kolayca geri çıkamaz. İş ilanı arama alanı 12px, paylaşım metin alanı 14px idi.

**Düzeltme.** Mobilde (≤640px) tüm `input`/`textarea`/`select` alanları 16px'e sabitlendi.

---

## 9. Düşük — Telefonda çok küçük yazılar (düzeltildi)

Sayfa başına 10–16 öğe 10px, bir öğe 9px yazı boyutundaydı. Mobilde 9px → 10px, 10px → 11px
olarak yükseltildi (masaüstünde değişiklik yok).

---

## 10. Ölçüm özeti (düzeltmeler öncesi → sonrası)

Aynı otomatik denetim, aynı sayfalar ve aynı dört ekran boyutu:

| Bulgu | Önce | Sonra |
|---|---:|---:|
| Konsol hatası | 108 | **0** |
| Sayfa yatay taşması | 3 sayfa | **0** |
| 24px altı dokunma hedefi | 52 | **2** |
| Erişilebilir adı olmayan buton | 20 | **0** |
| Etiketsiz form alanı | 4 | **0** |
| iOS'ta yakınlaştırmaya yol açan alan | 4 | **0** |
| Kırılamayan uzun metin | 24 | **12*** |
| 11px altı metin | 80 | **40**\*\* |

\* Kalanların tamamı kendi yatay kaydırıcısı olan kod blokları — beklenen davranış.
\*\* Kalanların tamamı tablet/masaüstünde 10px rozet metinleri; telefonda sayfa başına 1 öğe.

---

## 11. İkinci tur — kullanıcı bildirimleri üzerine yapılanlar

### 11.1 Paylaşım kutusunda metnin üzerine binen sayaç (düzeltildi)

**Bulgu.** "Ne düşünüyorsun? Proje, soru veya kod parçacığı paylaş..." yer tutucusu 390px'de
iki satıra sarıyordu; ikinci satırın ("…parçacığı paylaş…") tam üzerinde mutlak konumlu
"1000 Spark" rozeti ve karakter sayacı duruyordu. Harfler rozetin arkasında kalınca yazı
bozuk görünüyordu.

**Düzeltme.**
- "1000 Spark" rozeti tamamen kaldırıldı.
- Karakter sayacı metnin üzerinden alınıp alt aksiyon çubuğuna, "Paylaş" butonunun yanına
  taşındı — görünür kalıyor ama hiçbir şeyin üstüne binmiyor.
- Kutu kapalıyken (tek satır) kısa yer tutucu kullanılıyor: "Ne düşünüyorsun?". Uzun metin
  yalnızca kutu açıldığında gösteriliyor.

### 11.2 Alt gezinme çubuğu yeniden tasarlandı

**Önce.** Tam genişlikte, üstte ince çizgili bir çubuk; 4 sekme + ortada taşan bir "+"
düğmesi. Sekmeler ikon + etiket olduğu için her biri dar kalıyordu ve "+" hem burada hem
üst başlıkta vardı.

**Sonra.** Ekranın altında yüzen, yuvarlatılmış tek bir hap:

| | Sekme | İkon |
|---|---|---|
| 1 | Akış | ev |
| 2 | İş İlanları | çanta |
| 3 | Mesajlar | zarf |
| 4 | Hesabım | profil fotoğrafı + yeşil çevrimiçi noktası |

- Her sekme **44×44px'in üzerinde** (360px'de 78×44, 390px'de 85×44).
- Aktif sekme ikonun arkasındaki açık renkli hapla belirtiliyor.
- Okunmamış sayaçları ikonun üzerinde rozet olarak duruyor, ikinci satır açmıyor.
- iOS ana ekran çubuğu için `env(safe-area-inset-bottom)` kadar boşluk bırakılıyor.

### 11.3 Mobil üst başlık sadeleşti (önceki turdaki iki açık gözlem kapandı)

- Avatar kaldırıldı — artık alt çubuktaki "Hesabım".
- "İndir" butonu kaldırıldı — PWA kurulumu zaten hem çekmecede hem kurulum şeridinde var.
  Böylece **aynı anda iki "kur" çağrısı** sorunu ortadan kalktı.
- Alt çubuktaki "+" kaldırıldığı için **iki ayrı "+" butonu** sorunu da kapandı; başlıktaki
  tek düğme artık "+ Paylaş" olarak etiketli.
- Yerine keşfet butonu geldi; bildirim rozeti nokta yerine sayı gösteriyor.

### 11.4 Bildirimler ekranı sıfırdan yazıldı

**Kaldırılanlar.** "Sesli (WhatsApp Tarzı)" etiketi, sahte test bildirimi ("Ahmet sana bir
mesaj gönderdi: 'Harika proje! 🚀'"), ekranın üçte birini kaplayan tanıtım şeridi ve
`notificationSound.ts` içindeki WhatsApp göndermeleri.

**Yeni yapı.**
- **Tarihe göre gruplama**: Bugün / Bu hafta / Daha önce.
- **Dört filtre**: Tümü, Okunmamış, Etkileşim, İlanlar — her biri sayısıyla.
- Her satırda **gönderenin avatarı** ve avatarın köşesinde **türe göre renkli rozet**
  (beğeni kırmızı, yorum yeşil, yeniden paylaşım mavi, takip mor, ilan turkuaz).
- Okunmamışlar için satır başında ince bir nokta; satırın tamamı `<button>` olduğu için
  klavyeyle gezilebiliyor ve ekran okuyucuya tek bir eylem olarak sunuluyor.
- Tarayıcı bildirim izni artık tek satırlık, kapatılabilir ve yalnızca izin sorulmamışsa
  görünen sessiz bir öneri.
- "Tümünü okundu" ve "Temizle" butonları boşken devre dışı (önce tıklanıp hiçbir şey
  yapmıyorlardı).
- Filtreye göre değişen boş durum metni.

---

## 12. Yetki denetimi — "başkalarının topluluk ayarlarını değiştirebiliyorum"

Kısa cevap: **güvenlik açığı değil, yönetici yetkisi.** `nylithra` hesabı platform
yöneticisi olarak tanımlı (`SYSTEM_ADMIN_USERNAMES` + `supabase_schema.sql` içindeki
`is_admin = true` ataması), bu yüzden ayar düğmesi tüm topluluklarda görünüyor.

Gerçek bir veritabanı üzerinde (PostgreSQL 16) doğrulandı:

| Senaryo | Sonuç |
|---|---|
| Yabancı üye topluluğun adını/açıklamasını/gizliliğini değiştirir | ❌ değişmedi |
| Yabancı üye topluluğa katılır (`members_count`) | ✅ izinli |
| Yabancı üye topluluğu siler | ❌ `DELETE 0` |
| Kurucu değiştirir | ✅ izinli |
| Platform yöneticisi değiştirir | ✅ izinli |
| Üye kendine `is_admin`/`verified`/`spark` verir | ❌ hepsi sıfırlandı |
| Üye kullanıcı adını `c4e_admin` yapar | ❌ hata |
| Gizli topluluk gönderisi üye olmayana görünür | ❌ görünmüyor |

**Bu denetimde bulunan gerçek açık (kapatıldı).** İstemci `admin`, `administrator`,
`c4e_admin`, `nylithra` adlarına yönetici arayüzünü açıyordu; veritabanı ise bu adlara
kayıt olmayı yalnızca *ad değiştirirken* engelliyor, **ilk kayıtta engellemiyordu**. Yani
uygulama dışından `c4e_admin` adıyla kayıt olan biri yönetici arayüzünü görebilirdi
(veritabanı yazmalarını yine de geri alırdı). `protect_profile_insert` tetikleyicisine
rezerve ad kontrolü eklendi; oturumsuz çağrılar (SQL editörü, servis anahtarı, göç
betikleri) muaf tutulduğu için kurucu hesabını elle oluşturmak hâlâ mümkün.

---

## 13. Hâlâ açık olan gözlemler (bilinçli olarak bırakıldı)

- **Kod bloğu yatayda kaydırılıyor** (doğru davranış) ama telefonda kaydırılabildiğine dair
  görsel bir ipucu yok.
- **768px'de düzen sıkışık**: kenar çubuğu masaüstü genişliğine geçtiği için akış sütunu
  dar kalıyor. Taşma giderildi, ancak kenar çubuğunun bu aralıkta ikon moduna geçmesi daha
  ferah olurdu.
- **Mesajlar (DM) ekranı** beta kilidi nedeniyle otomatik denetime dahil edilmedi.
- **Keşfet ve Topluluklar** alt çubukta değil; çekmecede ve üst başlıktaki keşfet
  butonunda. Dört sekmeli çubuk okunaklılık için bilinçli bir tercih.

---

## Denetim nasıl tekrarlanır

`scratchpad/audit.mjs` betiği dört ekran boyutunda tüm sayfaları gezip şunları ölçer: yatay
taşma, görüntü alanı dışına taşan öğeler, 24px altı dokunma hedefleri, erişilebilir adı
olmayan butonlar, etiketsiz form alanları, 16px altı form yazı tipleri, 11px altı metinler,
`alt` içermeyen görseller, yinelenen DOM id'leri, sabit alt çubuğun örttüğü içerik ve
kırılamayan uzun metinler; ayrıca her sayfanın ekran görüntüsünü alır.
