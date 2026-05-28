export type Theme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'iu_theme';
const SUPPORTED: readonly Theme[] = ['dark', 'light'];

function isTheme(value: string): value is Theme {
  return (SUPPORTED as readonly string[]).includes(value);
}

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored !== null && isTheme(stored)) {
      return stored;
    }
  } catch {
    // localStorage may throw in privacy modes.
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // best effort
  }
}
