import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Locale, getDictionary, loadLocale, saveLocale } from './index';
import { TranslationContext } from '../hooks/useTranslation';

interface Props {
  readonly children: React.ReactNode;
}

export function TranslationProvider({ children }: Props) {
  const [locale, setLocaleState] = useState<Locale>(() => loadLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
    saveLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const value = useMemo(
    () => ({ locale, t: getDictionary(locale), setLocale }),
    [locale, setLocale],
  );

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}
