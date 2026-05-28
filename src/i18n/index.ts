import { dictionaries, Locale, Translation } from './dictionaries';

const LOCALE_STORAGE_KEY = 'iu_locale';
const SUPPORTED: readonly Locale[] = ['en', 'fr'];

function isLocale(value: string): value is Locale {
  return (SUPPORTED as readonly string[]).includes(value);
}

function detectFromNavigator(): Locale {
  if (typeof navigator === 'undefined') {
    return 'en';
  }
  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ];
  for (const raw of candidates) {
    if (raw === undefined || raw === null) {
      continue;
    }
    const short = raw.toLowerCase().slice(0, 2);
    if (isLocale(short)) {
      return short;
    }
  }
  return 'en';
}

export function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored !== null && isLocale(stored)) {
      return stored;
    }
  } catch {
    // localStorage may throw in privacy modes.
  }
  return detectFromNavigator();
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Best-effort; the in-memory state still drives the UI.
  }
}

export function getDictionary(locale: Locale): Translation {
  return dictionaries[locale];
}

export { dictionaries };
export type { Locale, Translation };
