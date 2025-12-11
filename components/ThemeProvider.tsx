'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Get system preference
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'light';
  }, []);

  // Initialize theme from localStorage or detect system preference
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      // If no saved theme or saved theme is 'system', detect system preference and set to 'light' or 'dark' directly
      if (!savedTheme || savedTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
        // Save the detected theme to localStorage
        localStorage.setItem('theme', systemTheme);
        return systemTheme;
      }
      return savedTheme;
    }
    return 'light';
  });

  const [mounted, setMounted] = useState(false);

  // Compute resolved theme from current theme state
  // Since we no longer use 'system', resolvedTheme is just the theme
  const resolvedTheme = useMemo((): 'light' | 'dark' => {
    // If somehow theme is 'system', fallback to system detection
    // (This should not happen since we migrate 'system' in initial state)
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme;
  }, [theme, getSystemTheme]);

  // Apply theme to DOM (no state updates)
  const applyThemeToDOM = useCallback((appliedTheme: 'light' | 'dark') => {
    const root = document.documentElement;

    if (appliedTheme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }, []);

  // Set theme and persist to localStorage
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  // Apply theme to DOM when resolved theme changes
  useEffect(() => {
    if (mounted) {
      applyThemeToDOM(resolvedTheme);
    }
  }, [resolvedTheme, mounted, applyThemeToDOM]);

  // Initialize on mount and listen for system theme changes
  useEffect(() => {
    // Apply initial theme
    // applyThemeToDOM(resolvedTheme); // Handled by the other useEffect when mounted becomes true
    setTimeout(() => setMounted(true), 0);

    // No longer need to listen for system theme changes since we don't use 'system'
    // Users explicitly choose 'light' or 'dark'
  }, [theme, resolvedTheme, applyThemeToDOM]);

  // Prevent flash of unstyled content
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
