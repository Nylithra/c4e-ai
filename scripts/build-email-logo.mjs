/**
 * Rasterises public/logo.svg into public/email-logo.png.
 *
 * Why this exists: Gmail, Outlook and Yahoo all refuse to render SVG inside an e-mail, so the
 * transactional template cannot reference logo.svg directly. Keeping a generated PNG next to
 * the source SVG means the mark in outgoing mail stays in sync with the app's own logo —
 * re-run this whenever logo.svg changes.
 *
 * Usage:  node scripts/build-email-logo.mjs [size]
 *
 * Uses the Playwright Chromium that already ships with the dev environment; no image
 * library is added to the dependency tree for a once-in-a-while build step.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public', 'logo.svg');
const TARGET = path.join(ROOT, 'public', 'email-logo.png');

// 480px keeps the 44px display size crisp on 3x displays without bloating the attachment.
const SIZE = Number(process.argv[2]) || 480;

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

  const svg = fs
    .readFileSync(SOURCE, 'utf8')
    .replace(/width="\d+"/, `width="${SIZE}"`)
    .replace(/height="\d+"/, `height="${SIZE}"`);

  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
         <div style="width:${SIZE}px;height:${SIZE}px">${svg}</div>
       </body></html>`,
      { waitUntil: 'load' }
    );
    await page.waitForTimeout(400);
    await page.screenshot({
      path: TARGET,
      // Transparent background so the logo sits on the header band without a white box.
      omitBackground: true,
      clip: { x: 0, y: 0, width: SIZE, height: SIZE }
    });
  } finally {
    await browser.close();
  }

  const written = fs.statSync(TARGET);
  console.log(`Yazildi: ${path.relative(ROOT, TARGET)} (${SIZE}x${SIZE}, ${written.size} bayt)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
