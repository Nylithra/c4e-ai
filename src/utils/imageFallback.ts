/**
 * Global image fallback.
 *
 * Profile pictures, banners and community logos come from user-supplied URLs (GitHub,
 * unavatar, arbitrary links). When one of them 404s — or when a record simply has an empty
 * string in the field — the browser paints its "broken image" icon, which looked like a
 * rendering bug all over the app (feed, profile, settings, job listings).
 *
 * A single capture-phase listener replaces any failed image with a neutral placeholder that
 * matches the dark palette, so a dead link degrades into something that still looks designed.
 */

const AVATAR_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" fill="#18181b"/>
      <circle cx="48" cy="38" r="16" fill="#3f3f46"/>
      <path d="M16 88c4-18 16-26 32-26s28 8 32 26z" fill="#3f3f46"/>
    </svg>`
  );

const BANNER_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#18181b"/>
          <stop offset="100%" stop-color="#27272a"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="300" fill="url(#g)"/>
    </svg>`
  );

function isBannerLike(img: HTMLImageElement): boolean {
  const alt = (img.getAttribute('alt') || '').toLowerCase();
  if (alt.includes('banner')) return true;
  const rect = img.getBoundingClientRect();
  // Wide and short → banner; roughly square → avatar.
  return rect.width > 0 && rect.width / Math.max(1, rect.height) > 2.2;
}

export function installImageFallback(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLImageElement)) return;
      if (target.dataset.fallbackApplied === '1') return;

      target.dataset.fallbackApplied = '1';
      target.src = isBannerLike(target) ? BANNER_PLACEHOLDER : AVATAR_PLACEHOLDER;
      target.classList.add('img-fallback');
    },
    // Capture phase: `error` does not bubble.
    true
  );
}

export { AVATAR_PLACEHOLDER, BANNER_PLACEHOLDER };
