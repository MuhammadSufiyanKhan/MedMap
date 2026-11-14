export const THEMES = ['system', 'light', 'dark', 'contrast'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
  contrast: 'High contrast',
};

export const TEXT_SIZES = ['normal', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Preferences {
  theme: Theme;
  textSize: TextSize;
  /** The first-run "not medical advice" notice was read and accepted. */
  noticeAccepted: boolean;
  /** The user agreed that label photos go to the extraction provider. */
  extractionConsent: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  textSize: 'normal',
  noticeAccepted: false,
  extractionConsent: false,
};

export const PREFERENCES_STORAGE_KEY = 'medmap.preferences.v1';

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** Reads stored preferences defensively: anything malformed falls back to the default. */
export function parsePreferences(raw: string | null): Preferences {
  if (raw === null) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return DEFAULT_PREFERENCES;
    }
    const record = value as Record<string, unknown>;
    return {
      theme: isOneOf(THEMES, record.theme) ? record.theme : DEFAULT_PREFERENCES.theme,
      textSize: isOneOf(TEXT_SIZES, record.textSize)
        ? record.textSize
        : DEFAULT_PREFERENCES.textSize,
      noticeAccepted: record.noticeAccepted === true,
      extractionConsent: record.extractionConsent === true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** The `data-theme` attribute value for a theme, or null to follow the device. */
export function themeAttribute(theme: Theme): string | null {
  return theme === 'system' ? null : theme;
}
