"use client";

import { Suspense, ReactNode } from "react";

interface ThemedSuspenseProps {
  children?: ReactNode; // Optional when isLoading is true
  fallback?: ReactNode;
  variant?: "default" | "simple" | "card" | "list" | "dashboard" | "page" | "sync";
  isLoading?: boolean; // New prop for conditional rendering (not Suspense-based)
}

/**
 * Gets the themed fallback skeleton based on variant
 */
export function getThemedFallback(variant: ThemedSuspenseProps["variant"] = "default"): ReactNode {
  switch (variant) {
    case "simple":
      // Simple bar skeleton for small content
      return (
        <div className="h-8 w-16 bg-theme-light rounded animate-pulse" />
      );

    case "card":
      // Single card skeleton
      return (
        <div className="bg-card-highlight-light rounded-xl shadow p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-theme-light rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-theme-light rounded w-2/3" />
              <div className="h-4 bg-theme-light rounded w-1/2" />
            </div>
          </div>
        </div>
      );

    case "list":
      // List skeleton without card wrapper
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-card-highlight-light rounded-sm animate-pulse">
              <div className="w-12 h-12 bg-theme-light rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-theme-light rounded w-2/3" />
                <div className="h-4 bg-theme-light rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );

    case "dashboard":
      // Dashboard loading skeleton
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-6">
              <div className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
                <div className="h-6 bg-theme-light rounded w-40 mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-theme-light rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-theme-light rounded w-2/3" />
                        <div className="h-4 bg-theme-light rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
                  <div className="h-6 bg-theme-light rounded w-32 mb-4" />
                  <div className="h-32 bg-theme-light rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "page":
      // Full page loading skeleton
      return (
        <div className="space-y-8">
          <div className="flex justify-end">
            <div className="h-10 w-24 bg-theme-light rounded animate-pulse" />
          </div>
          <div className="space-y-8">
            <div className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
              <div className="h-6 bg-theme-light rounded w-32 mb-4" />
              <div className="h-32 bg-theme-light rounded" />
            </div>
            <div className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
              <div className="h-6 bg-theme-light rounded w-32 mb-4" />
              <div className="h-64 bg-theme-light rounded" />
            </div>
          </div>
        </div>
      );

    case "sync":
      // Sync page loading skeleton
      return (
        <div className="space-y-8">
          <div className="flex justify-end">
            <div className="h-10 w-24 bg-theme-light rounded animate-pulse" />
          </div>
          <div className="space-y-8">
            <div className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
              <div className="h-6 bg-theme-light rounded w-32 mb-4" />
              <div className="h-32 bg-theme-light rounded" />
            </div>
            <div className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
              <div className="h-6 bg-theme-light rounded w-32 mb-4" />
              <div className="h-64 bg-theme-light rounded" />
            </div>
          </div>
        </div>
      );

    case "default":
    default:
      // Card-based list skeleton (default)
      return (
        <div className="space-y-3">
          <div className="h-6 bg-card-highlight-light rounded w-32 mb-2 animate-pulse" />
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card-highlight-light rounded-xl shadow p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-theme-light rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-theme-light rounded w-2/3" />
                    <div className="h-4 bg-theme-light rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
  }
}

/**
 * ThemedSuspense - A reusable Suspense component with themed fallback skeletons
 * 
 * @param children - The content to suspend
 * @param fallback - Optional custom fallback (overrides variant)
 * @param variant - Predefined fallback variant:
 *   - "default": Card-based list skeleton (5 items)
 *   - "simple": Simple bar skeleton
 *   - "card": Single card skeleton
 *   - "list": List skeleton without card wrapper
 *   - "dashboard": Dashboard layout skeleton
 *   - "page": Full page skeleton
 *   - "sync": Sync page skeleton
 * @param isLoading - If true, shows fallback immediately (for conditional rendering, not Suspense)
 */
export default function ThemedSuspense({
  children,
  fallback,
  variant = "default",
  isLoading = false,
}: ThemedSuspenseProps) {
  // If isLoading is true, show fallback immediately (for conditional rendering)
  if (isLoading) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    return <>{getThemedFallback(variant)}</>;
  }

  // For Suspense mode, children is required
  if (!children) {
    return null;
  }

  // If custom fallback provided, use it
  if (fallback !== undefined) {
    return <Suspense fallback={fallback}>{children}</Suspense>;
  }

  // Use themed fallback based on variant
  const defaultFallback = getThemedFallback(variant);
  return <Suspense fallback={defaultFallback}>{children}</Suspense>;
}
