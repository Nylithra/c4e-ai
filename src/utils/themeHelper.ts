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

export const DEFAULT_DARK_THEME: AppThemeConfig = PRESET_THEMES.find((p) => p.id === 'theme_default_dark') || PRESET_THEMES[1];
export const DEFAULT_LIGHT_THEME: AppThemeConfig = PRESET_THEMES.find((p) => p.id === 'theme_light') || PRESET_THEMES[2];

export const STORAGE_KEY_APP_THEME = 'c4e_app_theme';
export const STORAGE_KEY_PROFILE_THEME = 'c4e_profile_theme';
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
 * Loads the application theme (Uygulama Teması) for the logged-in user.
 * Applied across Code4Ever for this user.
 */
export function getEffectiveAppTheme(user?: Partial<UserProfile> | null): AppThemeConfig {
  if (user?.custom_fields?.app_theme) {
    const t = user.custom_fields.app_theme;
    return {
      ...DEFAULT_DARK_THEME,
      ...t,
      gradientCss: t.gradientCss || buildGradientCss(
        t.gradientType || 'linear',
        t.stops || DEFAULT_DARK_THEME.stops,
        t.gradientAngle ?? DEFAULT_DARK_THEME.gradientAngle
      )
    };
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY_APP_THEME) || localStorage.getItem(STORAGE_KEY_CURRENT_THEME);
    if (local) {
      const parsed = JSON.parse(local);
      return {
        ...DEFAULT_DARK_THEME,
        ...parsed,
        gradientCss: parsed.gradientCss || buildGradientCss(
          parsed.gradientType || 'linear',
          parsed.stops || DEFAULT_DARK_THEME.stops,
          parsed.gradientAngle ?? DEFAULT_DARK_THEME.gradientAngle
        )
      };
    }
  } catch {
    // fallback
  }

  // Fallback to custom_fields.theme if app_theme has not been set yet
  if (user?.custom_fields?.theme) {
    const t = user.custom_fields.theme;
    return {
      ...DEFAULT_DARK_THEME,
      ...t,
      gradientCss: t.gradientCss || buildGradientCss(
        t.gradientType || 'linear',
        t.stops || DEFAULT_DARK_THEME.stops,
        t.gradientAngle ?? DEFAULT_DARK_THEME.gradientAngle
      )
    };
  }

  return DEFAULT_DARK_THEME;
}

/**
 * Loads the public profile theme (Profil Teması) for any user.
 * Only shown on their profile page and profile modal.
 */
export function getEffectiveProfileTheme(user?: Partial<UserProfile> | null): AppThemeConfig {
  if (user?.custom_fields?.theme) {
    const t = user.custom_fields.theme;
    return {
      ...DEFAULT_DARK_THEME,
      ...t,
      gradientCss: t.gradientCss || buildGradientCss(
        t.gradientType || 'linear',
        t.stops || DEFAULT_DARK_THEME.stops,
        t.gradientAngle ?? DEFAULT_DARK_THEME.gradientAngle
      )
    };
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY_PROFILE_THEME);
    if (local) {
      const parsed = JSON.parse(local);
      return {
        ...DEFAULT_DARK_THEME,
        ...parsed,
        gradientCss: parsed.gradientCss || buildGradientCss(
          parsed.gradientType || 'linear',
          parsed.stops || DEFAULT_DARK_THEME.stops,
          parsed.gradientAngle ?? DEFAULT_DARK_THEME.gradientAngle
        )
      };
    }
  } catch {
    // fallback
  }

  return DEFAULT_DARK_THEME;
}

/**
 * Legacy compatibility helper - returns app theme.
 */
export function getEffectiveTheme(user?: Partial<UserProfile> | null): AppThemeConfig {
  return getEffectiveAppTheme(user);
}

/**
 * Applies the Application Theme (Uygulama Teması) to the document root and body.
 * This determines the app shell appearance.
 */
export function applyAppThemeToDom(theme: AppThemeConfig): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Set App Theme CSS Variables
  root.style.setProperty('--c4e-app-text', theme.text || '#f8fafc');
  root.style.setProperty('--c4e-app-main', theme.main || '#09090b');
  root.style.setProperty('--c4e-app-buttons', theme.buttons || '#2563eb');
  root.style.setProperty('--c4e-app-profile', theme.profile || '#121215');

  root.style.setProperty('--c4e-theme-text', theme.text || '#f8fafc');
  root.style.setProperty('--c4e-theme-main', theme.main || '#09090b');
  root.style.setProperty('--c4e-theme-buttons', theme.buttons || '#2563eb');
  root.style.setProperty('--c4e-theme-profile', theme.profile || '#121215');

  const gradientCss = theme.gradientCss || buildGradientCss(
    theme.gradientType || 'linear',
    theme.stops || [],
    theme.gradientAngle ?? 135
  );
  root.style.setProperty('--c4e-app-gradient', gradientCss);
  root.style.setProperty('--c4e-theme-gradient', gradientCss);

  const isGradient = Boolean(theme.isGradient && gradientCss);
  const bgVal = isGradient ? gradientCss : (theme.main || '#09090b');
  root.style.setProperty('--c4e-app-bg', bgVal);

  // Sync Tailwind root variables for clean Light / Dark mode consistency
  const isLight = theme.id === 'theme_light' || theme.main === '#f8fafc' || theme.main?.toLowerCase() === '#ffffff';
  if (isLight) {
    root.setAttribute('data-theme-mode', 'light');
    root.classList.add('light');
    root.classList.remove('dark');
    root.style.setProperty('--background', '#f8fafc');
    root.style.setProperty('--foreground', '#09090b');
    root.style.setProperty('--card', '#ffffff');
    root.style.setProperty('--card-foreground', '#09090b');
    root.style.setProperty('--border', 'rgba(0, 0, 0, 0.12)');
    root.style.setProperty('--primary', theme.buttons || '#2563eb');
    root.style.setProperty('--primary-foreground', '#ffffff');
    root.style.setProperty('--muted-foreground', 'oklch(0.45 0.01 260)');
  } else {
    root.setAttribute('data-theme-mode', 'dark');
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.setProperty('--background', theme.main || '#09090b');
    root.style.setProperty('--foreground', theme.text || '#f8fafc');
    root.style.setProperty('--card', theme.profile || '#121215');
    root.style.setProperty('--card-foreground', theme.text || '#f8fafc');
    root.style.setProperty('--border', 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--primary', theme.buttons || '#2563eb');
    root.style.setProperty('--primary-foreground', '#ffffff');
    root.style.setProperty('--muted-foreground', 'oklch(0.62 0.008 260)');
  }

  // Apply body background & gradient flag
  if (isGradient) {
    root.setAttribute('data-theme-gradient', 'true');
    document.body.style.background = gradientCss;
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundColor = theme.main || '#09090b';
  } else {
    root.setAttribute('data-theme-gradient', 'false');
    document.body.style.background = theme.main || '#09090b';
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = theme.main || '#09090b';
  }
  document.body.style.color = theme.text || '#f8fafc';

  // Apply dynamic font if provided
  if (theme.font && theme.font.trim()) {
    const fontVal = theme.font.trim();
    if (fontVal.startsWith('http://') || fontVal.startsWith('https://')) {
      let linkEl = document.getElementById('c4e-custom-font-link') as HTMLLinkElement | null;
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.id = 'c4e-custom-font-link';
        linkEl.rel = 'stylesheet';
        document.head.appendChild(linkEl);
      }
      linkEl.href = fontVal;

      const match = fontVal.match(/family=([^:&]+)/);
      if (match && match[1]) {
        const familyName = decodeURIComponent(match[1].replace(/\+/g, ' '));
        document.body.style.fontFamily = `"${familyName}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      }
    } else {
      document.body.style.fontFamily = theme.font;
    }
  } else {
    document.body.style.fontFamily = '';
  }

  // Persist locally
  try {
    localStorage.setItem(STORAGE_KEY_APP_THEME, JSON.stringify(theme));
  } catch {
    // ignore
  }

  // Broadcast global theme change event
  try {
    window.dispatchEvent(new CustomEvent('c4e-theme-changed', { detail: theme }));
  } catch {
    // ignore
  }
}

/**
 * Legacy compatibility helper - applies app theme to DOM.
 */
export function applyThemeToDom(theme: AppThemeConfig): void {
  applyAppThemeToDom(theme);
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
