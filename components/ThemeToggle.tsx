'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    // Only toggle between light and dark
    const themes: Array<'light' | 'dark'> = ['light', 'dark'];
    const currentIndex = themes.indexOf(theme as 'light' | 'dark');
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getIcon = () => {
    // Use resolvedTheme to determine icon (handles 'system' case if it exists)
    if (resolvedTheme === 'dark') {
      return (
        <svg
          className="w-4 h-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    }

    return (
      <svg
        className="w-4 h-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );
  };

  const getLabel = () => {
    // Show the opposite theme - what clicking will switch to
    if (resolvedTheme === 'dark') {
      return 'Light Mode';
    }
    return 'Dark Mode';
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-sm font-medium rounded-md bg-[#fafaf9] xl:bg-[#333330] hover:bg-gray-300 xl:hover:bg-gray-600 text-theme-darkest xl:text-white transition-colors duration-200 cursor-pointer mb-3"
      aria-label={`Switch to ${getLabel()}`}
      title={`Switch to ${getLabel()}`}
    >
      <span className="flex items-center justify-center shrink-0">{getIcon()}</span>
      <span className="font-medium">{getLabel()}</span>
    </button>
  );
}
