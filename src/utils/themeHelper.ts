import { UserProfile } from '../types';
import { isUserSpark } from './fileUploadHelper';

export interface GradientStop {
  id: string;
  color: string;
  position: number; // 0 to 100%
}

export interface AppThemeConfig {
  id: string;
  name: string;
  text: string;      // HTML hex color e.g. #f8fafc
  main: string;      // HTML hex color e.g. #09090b
  buttons: string;   // HTML hex color e.g. #6366f1
  profile: string;   // HTML hex color e.g. #13111c
  font?: string;     // Web font URL or font-family
  isGradient: boolean;
  gradientType: 'linear' | 'radial';
  gradientAngle: number; // 0 - 360 deg for linear
  radialShape?: 'circle' | 'ellipse';
  stops: GradientStop[];
  gradientCss?: string;
  isSparkExclusive?: boolean;
}

// ============================================================================
// PRESET THEMES (Astra, Koyu, Açık, Aurora, Cyberpunk, Sunset)
// ============================================================================
export const PRESET_THEMES: AppThemeConfig[] = [
  {
    id: 'theme_astra',
    name: 'Astra Tema',
    text: '#f8fafc',
    main: '#09090b',
    buttons: '#6366f1',
    profile: '#13111c',
    isGradient: true,
    gradientType: 'linear',
    gradientAngle: 135,
    stops: [
      { id: 's1', color: '#4c1d95', position: 0 },
      { id: 's2', color: '#1e3a8a', position: 50 },
      { id: 's3', color: '#09090b', position: 100 }
    ],
    gradientCss: 'linear-gradient(135deg, #4c1d95 0%, #1e3a8a 50%, #09090b 100%)',
    isSparkExclusive: true
  },
  {
    id: 'theme_default_dark',
    name: 'Code4Ever Koyu (Varsayılan)',
    text: '#f4f4f5',
    main: '#09090b',
    buttons: '#2563eb',
    profile: '#121215',
    isGradient: false,
    gradientType: 'linear',
    gradientAngle: 180,
    stops: [
      { id: 's1', color: '#09090b', position: 0 },
      { id: 's2', color: '#121215', position: 100 }
    ],
    gradientCss: 'linear-gradient(180deg, #09090b 0%, #121215 100%)',
    isSparkExclusive: false
  },
  {
    id: 'theme_light',
    name: 'Açık Tema (Light)',
    text: '#09090b',
    main: '#f8fafc',
    buttons: '#2563eb',
    profile: '#ffffff',
    isGradient: false,
    gradientType: 'linear',
    gradientAngle: 180,
    stops: [
      { id: 's1', color: '#f8fafc', position: 0 },
      { id: 's2', color: '#e2e8f0', position: 100 }
    ],
    gradientCss: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
    isSparkExclusive: false
  },
  {
    id: 'theme_aurora',
    name: 'Aurora Boreal',
    text: '#f0fdf4',
    main: '#022c22',
    buttons: '#10b981',
    profile: '#064e3b',
    isGradient: true,
    gradientType: 'linear',
    gradientAngle: 140,
    stops: [
      { id: 's1', color: '#064e3b', position: 0 },
      { id: 's2', color: '#0e7490', position: 50 },
      { id: 's3', color: '#022c22', position: 100 }
    ],
    gradientCss: 'linear-gradient(140deg, #064e3b 0%, #0e7490 50%, #022c22 100%)',
    isSparkExclusive: true
  },
  {
    id: 'theme_cyberpunk',
    name: 'Cyberpunk Neon',
    text: '#fdf4ff',
    main: '#0f051d',
    buttons: '#d946ef',
    profile: '#2e1065',
    isGradient: true,
    gradientType: 'linear',
    gradientAngle: 125,
    stops: [
      { id: 's1', color: '#701a75', position: 0 },
      { id: 's2', color: '#3b0764', position: 50 },
      { id: 's3', color: '#0f051d', position: 100 }
    ],
    gradientCss: 'linear-gradient(125deg, #701a75 0%, #3b0764 50%, #0f051d 100%)',
    isSparkExclusive: true
  },
  {
    id: 'theme_sunset',
    name: 'Sunset Flare',
    text: '#fff7ed',
    main: '#0c0a09',
    buttons: '#f97316',
    profile: '#1c1917',
    isGradient: true,
    gradientType: 'linear',
    gradientAngle: 135,
    stops: [
      { id: 's1', color: '#9a3412', position: 0 },
      { id: 's2', color: '#831843', position: 50 },
      { id: 's3', color: '#0c0a09', position: 100 }
    ],
    gradientCss: 'linear-gradient(135deg, #9a3412 0%, #831843 50%, #0c0a09 100%)',
    isSparkExclusive: true
  }
];

export const STORAGE_KEY_CURRENT_THEME = 'c4e_active_theme_config';

/**
 * Generates CSS gradient string from stops and type/angle.
 */
export function buildGradientCss(
  type: 'linear' | 'radial',
  stops: GradientStop[],
  angle: number = 135,
  radialShape: 'circle' | 'ellipse' = 'circle'
): string {
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);
  const stopStr = sortedStops.map((s) => `${s.color} ${s.position}%`).join(', ');

  if (type === 'linear') {
    return `linear-gradient(${angle}deg, ${stopStr})`;
  } else {
    return `radial-gradient(${radialShape} at center, ${stopStr})`;
  }
}

/**
 * Loads user theme from profile or local storage.
 */
export function getEffectiveTheme(user?: Partial<UserProfile> | null): AppThemeConfig {
  const defaultTheme = PRESET_THEMES[0]; // Astra default or dark

  if (user?.custom_fields?.theme) {
    return {
      ...defaultTheme,
      ...user.custom_fields.theme,
      gradientCss: user.custom_fields.theme.gradientCss || buildGradientCss(
        user.custom_fields.theme.gradientType || 'linear',
        user.custom_fields.theme.stops || defaultTheme.stops,
        user.custom_fields.theme.gradientAngle ?? defaultTheme.gradientAngle
      )
    };
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY_CURRENT_THEME);
    if (local) {
      const parsed = JSON.parse(local);
      return {
        ...defaultTheme,
        ...parsed,
        gradientCss: parsed.gradientCss || buildGradientCss(
          parsed.gradientType || 'linear',
          parsed.stops || defaultTheme.stops,
          parsed.gradientAngle ?? defaultTheme.gradientAngle
        )
      };
    }
  } catch {
    // fallback
  }

  return defaultTheme;
}

/**
 * Applies theme CSS variables to the document root and body.
 */
export function applyThemeToDom(theme: AppThemeConfig): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Set CSS Variables
  root.style.setProperty('--c4e-theme-text', theme.text || '#f8fafc');
  root.style.setProperty('--c4e-theme-main', theme.main || '#09090b');
  root.style.setProperty('--c4e-theme-buttons', theme.buttons || '#6366f1');
  root.style.setProperty('--c4e-theme-profile', theme.profile || '#13111c');

  const gradientCss = theme.gradientCss || buildGradientCss(
    theme.gradientType || 'linear',
    theme.stops || [],
    theme.gradientAngle ?? 135
  );
  root.style.setProperty('--c4e-theme-gradient', gradientCss);

  // Apply background
  if (theme.isGradient && gradientCss) {
    document.body.style.backgroundImage = gradientCss;
    document.body.style.backgroundColor = theme.main || '#09090b';
  } else {
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = theme.main || '#09090b';
  }
  document.body.style.color = theme.text || '#f8fafc';

  // Apply dynamic font if provided
  if (theme.font && theme.font.trim()) {
    const fontVal = theme.font.trim();
    if (fontVal.startsWith('http://') || fontVal.startsWith('https://')) {
      // Dynamic Google Font Link
      let linkEl = document.getElementById('c4e-custom-font-link') as HTMLLinkElement | null;
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.id = 'c4e-custom-font-link';
        linkEl.rel = 'stylesheet';
        document.head.appendChild(linkEl);
      }
      linkEl.href = fontVal;

      // Extract font-family name from URL if possible
      const match = fontVal.match(/family=([^:&]+)/);
      if (match && match[1]) {
        const familyName = decodeURIComponent(match[1].replace(/\+/g, ' '));
        document.body.style.fontFamily = `"${familyName}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      }
    } else {
      document.body.style.fontFamily = theme.font;
    }
  } else {
    // Reset to default site font
    document.body.style.fontFamily = '';
  }

  // Persist locally
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_THEME, JSON.stringify(theme));
  } catch {
    // ignore
  }
}

// ============================================================================
// .C4E FILE PARSING & EXPORTING
// ============================================================================

/**
 * Exports theme configuration to .c4e file text.
 * Format:
 * name: <theme_name>
 * text: #...
 * main: #...
 * buttons: #...
 * profile: #...
 * font: <fontlinki>
 * gradient: <css>
 */
export function serializeC4ETheme(theme: AppThemeConfig): string {
  const lines: string[] = [
    `# Code4Ever Theme File (.c4e)`,
    `name: ${theme.name || 'Özel Tema'}`,
    `text: ${theme.text || '#f8fafc'}`,
    `main: ${theme.main || '#09090b'}`,
    `buttons: ${theme.buttons || '#6366f1'}`,
    `profile: ${theme.profile || '#13111c'}`,
    `font: ${theme.font || ''}`,
    `type: ${theme.gradientType || 'linear'}`,
    `angle: ${theme.gradientAngle ?? 135}`,
    `gradient: ${theme.gradientCss || buildGradientCss(theme.gradientType || 'linear', theme.stops || [], theme.gradientAngle ?? 135)}`
  ];

  if (theme.stops && theme.stops.length > 0) {
    const stopsStr = theme.stops.map((s) => `${s.color}@${s.position}`).join(';');
    lines.push(`stops: ${stopsStr}`);
  }

  return lines.join('\n');
}

/**
 * Parses .c4e text content into AppThemeConfig.
 */
export function parseC4ETheme(content: string, fallbackName = 'Yüklenen Tema'): AppThemeConfig {
  const result: Partial<AppThemeConfig> = {
    id: `c4e_custom_${Date.now()}`,
    name: fallbackName,
    text: '#f8fafc',
    main: '#09090b',
    buttons: '#6366f1',
    profile: '#13111c',
    font: '',
    isGradient: true,
    gradientType: 'linear',
    gradientAngle: 135,
    stops: [
      { id: 's1', color: '#4c1d95', position: 0 },
      { id: 's2', color: '#1e3a8a', position: 50 },
      { id: 's3', color: '#09090b', position: 100 }
    ]
  };

  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (!value) continue;

    switch (key) {
      case 'name':
        result.name = value;
        break;
      case 'text':
        result.text = value.startsWith('#') ? value : `#${value}`;
        break;
      case 'main':
        result.main = value.startsWith('#') ? value : `#${value}`;
        break;
      case 'buttons':
        result.buttons = value.startsWith('#') ? value : `#${value}`;
        break;
      case 'profile':
        result.profile = value.startsWith('#') ? value : `#${value}`;
        break;
      case 'font':
        result.font = value;
        break;
      case 'type':
        result.gradientType = value.toLowerCase() === 'radial' ? 'radial' : 'linear';
        break;
      case 'angle':
        result.gradientAngle = Number(value) || 135;
        break;
      case 'gradient':
        result.gradientCss = value;
        result.isGradient = true;
        break;
      case 'stops': {
        const parts = value.split(';');
        const stops: GradientStop[] = parts
          .map((p, idx) => {
            const [c, pos] = p.trim().split('@');
            if (!c) return null;
            return {
              id: `stop_${idx}`,
              color: c.startsWith('#') ? c : `#${c}`,
              position: Number(pos) || (idx * (100 / Math.max(parts.length - 1, 1)))
            };
          })
          .filter(Boolean) as GradientStop[];
        if (stops.length >= 2) {
          result.stops = stops;
        }
        break;
      }
    }
  }

  if (!result.gradientCss && result.stops && result.stops.length >= 2) {
    result.gradientCss = buildGradientCss(
      result.gradientType || 'linear',
      result.stops,
      result.gradientAngle ?? 135
    );
  }

  return result as AppThemeConfig;
}

/**
 * Triggers a browser download for a .c4e file.
 */
export function downloadC4EThemeFile(theme: AppThemeConfig): void {
  const content = serializeC4ETheme(theme);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (theme.name || 'tema')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.c4e`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
