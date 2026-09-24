/**
 * Rasterises public/logo.svg into the PNGs the app needs.
 *
 * ÜRETİLENLER
 *   public/email-logo.png  (480px) — Gmail, Outlook ve Yahoo e-posta içinde SVG'yi
 *                                    reddediyor, bu yüzden şablon PNG'ye ihtiyaç duyuyor.
 *   public/logo-192.png    (192px) — PWA simgesi
 *   public/logo-512.png    (512px) — PWA simgesi
 *
 * NEDEN PWA SİMGELERİ DE BURADA: `public/logo.png` aslında .png uzantılı bir SVG dosyasıydı.
 * Manifest onu `"type": "image/png"` diye tanıttığı için tarayıcı reddediyordu
 * ("Download error or resource isn't a valid image") ve uygulamanın ana ekran simgesi hiç
 * çalışmıyordu. Uzantıyı düzeltmek yetmez; manifest gerçek raster dosya ister.
 *
 * Usage:  node scripts/build-email-logo.mjs [email-boyutu]
 *
 * Uses the Playwright Chromium that already ships with the dev environment; no image
 * library is added to the dependency tree for a once-in-a-while build step.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public', 'logo.svg');

// 480px keeps the 44px display size crisp on 3x displays without bloating the attachment.
const EMAIL_SIZE = Number(process.argv[2]) || 480;

const OUTPUTS = [
  { file: 'email-logo.png', size: EMAIL_SIZE, transparent: true },
  // PWA simgeleri saydam OLMAMALI: Android simgeyi kendi maskesiyle kırpıyor ve saydam
  // zemin orada siyah bir boşluk olarak görünüyor. Kaynak SVG zaten kendi koyu zeminini
  // çiziyor, bu yüzden zemini korumak yeterli.
  { file: 'logo-192.png', size: 192, transparent: false },
  { file: 'logo-512.png', size: 512, transparent: false }
];

function findChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Kaynak bulunamadi: ${SOURCE}`);
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('playwright-core kurulu degil. Kurun: npm i -D playwright-core');
    process.exit(1);
  }

  const executablePath = findChromium();
  if (!executablePath) {
    console.error('Chromium bulunamadi. PLAYWRIGHT_CHROMIUM_PATH ile yolunu verin.');
    process.exit(1);
  }

  const source = fs.readFileSync(SOURCE, 'utf8');
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

  try {
    for (const { file, size, transparent } of OUTPUTS) {
      const svg = source
        .replace(/width="\d+"/, `width="${size}"`)
        .replace(/height="\d+"/, `height="${size}"`);

      const target = path.join(ROOT, 'public', file);
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(
        `<html><body style="margin:0;background:transparent">
           <div style="width:${size}px;height:${size}px">${svg}</div>
         </body></html>`,
        { waitUntil: 'load' }
      );
      await page.waitForTimeout(400);
      await page.screenshot({
        path: target,
        omitBackground: transparent,
        clip: { x: 0, y: 0, width: size, height: size }
      });
      await page.close();

      const written = fs.statSync(target);
      console.log(`Yazildi: ${path.relative(ROOT, target)} (${size}x${size}, ${written.size} bayt)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
