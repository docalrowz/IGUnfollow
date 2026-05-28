import { createContext, useContext } from 'react';
import { Locale, Translation, dictionaries, getDictionary } from '../i18n';

export interface TranslationContextValue {
  readonly locale: Locale;
  readonly t: Translation;
  readonly setLocale: (next: Locale) => void;
}

export const TranslationContext = createContext<TranslationContextValue>({
  locale: 'en',
  t: dictionaries.en,
  setLocale: () => undefined,
});

export function useTranslation(): TranslationContextValue {
  return useContext(TranslationContext);
}

export { getDictionary };
