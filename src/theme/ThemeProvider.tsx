import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Theme, loadTheme, saveTheme } from './theme';

interface ThemeContextValue {
  readonly theme: Theme;
  readonly toggleTheme: () => void;
  readonly setTheme: (next: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => undefined,
  setTheme: () => undefined,
});

interface Props {
  readonly children: React.ReactNode;
}

export function ThemeProvider({ children }: Props) {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
