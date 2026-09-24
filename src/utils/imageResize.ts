/**
 * Yüklemeden önce görseli küçültür.
 *
 * NEDEN GEREKLİ: telefon fotoğrafları 3-8MB ve 4000px genişliğinde geliyor. Ham hâliyle
 * gönderilseydi sunucunun 500KB'lık görsel sınırına takılır, takılmasa bile proje sayfası
 * onlarca megabayt indirtirdi. Küçültme kullanıcıya "dosyan çok büyük" demek yerine sorunu
 * sessizce çözüyor — istenen şey zaten fotoğrafın kendisi, baytları değil.
 *
 * Sunucudaki sınır yine de duruyor ve asıl sınır o: buradaki küçültme kolaylık, güvenlik
 * kontrolü değil. İsteği elle kuran biri bu dosyayı hiç çalıştırmaz.
 */

/** Uzun kenarın üst sınırı. 1600px, tam ekran bir kapak için fazlasıyla yeterli. */
const MAX_EDGE = 1600;

/** Sunucunun kabul ettiği üst sınırın biraz altı; yuvarlama payı bırakıyor. */
const TARGET_CHARS = 460 * 1000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel çözümlenemedi.'));
    img.src = src;
  });
}

/**
 * Görseli küçültüp data URL döner. Küçültülemezse (canvas yok, bozuk dosya) orijinali
 * döner ve boyut kararını sunucuya bırakır.
 */
export async function shrinkImage(file: File): Promise<string> {
  const original = await readAsDataUrl(file);

  // GIF'e dokunulmuyor: canvas'a çizmek animasyonu tek kareye düşürür ve kullanıcının
  // yüklediği şeyi sessizce bozmak, büyük dosyadan daha kötü.
  if (file.type === 'image/gif') return original;

  try {
    const img = await loadImage(original);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, width, height);

    // Saydamlığı olan görseller JPEG'e çevrilince siyah zemin kazanır, bu yüzden PNG
    // kaynaklar WebP'ye gidiyor; WebP saydamlığı koruyor ve JPEG kadar küçük.
    const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';

    let quality = 0.82;
    let out = canvas.toDataURL(type, quality);

    // Hâlâ büyükse kaliteyi kademeli düşür. Tek seferde çok düşürmek, aslında sığacak bir
    // görseli gereksiz yere bozardı.
    while (out.length > TARGET_CHARS && quality > 0.4) {
      quality -= 0.12;
      out = canvas.toDataURL(type, quality);
    }

    // Küçültme işe yaramadıysa (zaten küçük bir dosya, yeniden kodlama onu büyüttü)
    // orijinali koru.
    return out.length < original.length ? out : original;
  } catch {
    return original;
  }
}
