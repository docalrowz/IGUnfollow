import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dictionaries, getDictionary, loadLocale, saveLocale } from './index';

describe('i18n locale resolution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('honours an explicit choice persisted in localStorage', () => {
    localStorage.setItem('iu_locale', 'fr');
    expect(loadLocale()).toBe('fr');
  });

  it('falls back to navigator.language when storage is empty', () => {
    vi.spyOn(globalThis.navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(globalThis.navigator, 'language', 'get').mockReturnValue('fr-FR');
    expect(loadLocale()).toBe('fr');
  });

  it('defaults to English when navigator advertises an unsupported locale', () => {
    vi.spyOn(globalThis.navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(globalThis.navigator, 'language', 'get').mockReturnValue('de-DE');
    expect(loadLocale()).toBe('en');
  });

  it('ignores invalid locale strings written by hand into storage', () => {
    localStorage.setItem('iu_locale', 'klingon');
    vi.spyOn(globalThis.navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(globalThis.navigator, 'language', 'get').mockReturnValue('en-US');
    expect(loadLocale()).toBe('en');
  });

  it('saveLocale round-trips through loadLocale', () => {
    saveLocale('fr');
    expect(loadLocale()).toBe('fr');
  });

  it('returns matching dictionary for every supported locale', () => {
    expect(getDictionary('en').landing.headline).toBe(dictionaries.en.landing.headline);
    expect(getDictionary('fr').landing.headline).toBe(dictionaries.fr.landing.headline);
  });
});

describe('i18n dictionary parity', () => {
  it('every key present in English exists in French (and vice versa)', () => {
    const flatten = (obj: object, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        return typeof value === 'object' && value !== null
          ? flatten(value as object, path)
          : [path];
      });

    const enKeys = flatten(dictionaries.en).sort();
    const frKeys = flatten(dictionaries.fr).sort();
    expect(enKeys).toEqual(frKeys);
  });
});
