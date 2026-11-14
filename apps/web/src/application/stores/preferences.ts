import { create } from 'zustand';
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  PREFERENCES_STORAGE_KEY,
  themeAttribute,
} from '../../domain/preferences';
import type { Preferences } from '../../domain/preferences';

interface PreferencesState extends Preferences {
  update: (changes: Partial<Preferences>) => void;
}

function load(): Preferences {
  try {
    return parsePreferences(window.localStorage.getItem(PREFERENCES_STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function save(preferences: Preferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable (private mode). Preferences then last for this visit only.
  }
}

/** Applies theme and text size to the document element. */
export function applyPreferences(preferences: Preferences): void {
  const root = document.documentElement;
  const theme = themeAttribute(preferences.theme);
  if (theme === null) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  if (preferences.textSize === 'large') {
    root.setAttribute('data-text', 'large');
  } else {
    root.removeAttribute('data-text');
  }
}

/** Display preferences and consents. UI-only state, kept in localStorage. */
export const usePreferences = create<PreferencesState>((set, get) => ({
  ...load(),
  update: (changes) => {
    set(changes);
    const { theme, textSize, noticeAccepted, extractionConsent } = get();
    const next = { theme, textSize, noticeAccepted, extractionConsent };
    save(next);
    applyPreferences(next);
  },
}));
