/**
 * Serbest metni PostgreSQL tsquery'sine çeviren saf fonksiyon.
 *
 * Kendi modülünde duruyor çünkü içinde tarayıcıya bağlı hiçbir şey yok: ne localStorage, ne
 * import.meta.env, ne ağ. Böylece Node altında doğrudan çalıştırılıp ürettiği sorgu GERÇEK
 * bir PostgreSQL'e verilerek sınanabiliyor — supabaseClient'ın içinde kalsaydı test, modülün
 * tarayıcı bağımlılıkları yüzünden import aşamasında patlardı.
 */

/** Türkçe diyakritikleri ASCII karşılıklarına indirger. */
const FOLD_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u'
};

/**
 * Aynı katlamayı veritabanı tarafında `public.search_fold()` yapıyor. İkisi AYNI dönüşümü
 * uygulamak zorunda: indeks katlanmış, sorgu katlanmamış olsaydı diyakritikli hiçbir kelime
 * bulunamazdı.
 */
export function foldForSearch(raw: string): string {
  return String(raw || '')
    // Önce noktalı büyük İ'yi normalize et: toLowerCase() onu "i̇" (i + birleşen nokta)
    // hâline getirir ve bu, düz "i" ile eşleşmez.
    .replace(/İ/g, 'I')
    .toLowerCase()
    .replace(/̇/g, '')
    .replace(/[çğıöşüâîû]/g, (ch) => FOLD_MAP[ch] || ch);
}

/** Bir sorguda dikkate alınacak en fazla kelime. */
export const MAX_SEARCH_WORDS = 8;

/**
 * Kullanıcının yazdığını tsquery'ye çevirir.
 *
 * İKİ TASARIM KARARI, İKİSİ DE ÖLÇÜMLE GEREKÇELİ:
 *
 * 1. HER KELİMEYE ÖNEK OPERATÖRÜ (`:*`). Türkçe eklemeli bir dil ve Snowball Türkçe
 *    köklendiricisi tutarsız: ölçüldüğünde belgedeki "Gönderilerimdeki" `gönderi` köküne,
 *    sorgudaki "gönderi" ise `gönder` köküne iniyor — ikisi asla eşleşmiyor, yani gözle
 *    görülür biçimde orada olan kelime bulunamıyordu. Önek eşlemesi hem bunu çözüyor hem de
 *    arama kutusundan beklenen davranış. Kod tarafında da doğru: `useEffect` yazıldığında
 *    `useEffectOnce` da bulunur, ama `useState` bulunmaz.
 *
 * 2. HARF/RAKAM/ALT ÇİZGİ DIŞINDAKİ HER ŞEY ATILIR. Çıktı doğrudan tsquery ayrıştırıcısına
 *    gidiyor; kullanıcının yazdığı bir `&`, `|` veya `!` sorguyu bozardı. Alt çizgi bilinçli
 *    olarak korunuyor: kod tanımlayıcılarının parçası (`my_var`, `__init__`).
 */
export function buildSearchQuery(raw: string): string {
  const words = foldForSearch(raw)
    .split(/[^a-z0-9_]+/)
    .filter((word) => word.length > 0)
    .slice(0, MAX_SEARCH_WORDS);

  return words.map((word) => `${word}:*`).join(' & ');
}
