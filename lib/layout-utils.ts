/**
 * Check if a path is active based on the current pathname
 */
export function isActive(path: string, pathname: string | null): boolean {
  if (path === "/") {
    return pathname === "/";
  }
  return pathname?.startsWith(path) ?? false;
}

/**
 * Get CSS classes for navigation links based on active and saving state
 */
export function getLinkClasses(isActive: boolean, isSaving: boolean): string {
  const baseClasses = "flex items-center px-4 py-3 rounded-sm transition-colors duration-200 font-medium";
  if (isSaving) {
    return `${baseClasses} text-theme-medium cursor-not-allowed pointer-events-none`;
  }
  if (isActive) {
    return `${baseClasses} bg-card-light text-foreground`;
  }
  return `${baseClasses} text-foreground hover:bg-card-light`;
}

