"use client";

import { Suspense, ReactNode } from "react";

interface ThemedSuspenseProps {
  children: ReactNode;
  fallback?: ReactNode;
  variant?: "default" | "simple" | "card" | "list";
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
 */
export default function ThemedSuspense({
  children,
  fallback,
  variant = "default",
}: ThemedSuspenseProps) {
  // If custom fallback provided, use it
  if (fallback !== undefined) {
    return <Suspense fallback={fallback}>{children}</Suspense>;
  }

  // Default themed fallback based on variant
  let defaultFallback: ReactNode;

  switch (variant) {
    case "simple":
      // Simple bar skeleton for small content
      defaultFallback = (
        <div className="h-8 w-16 bg-theme-light rounded animate-pulse" />
      );
      break;

    case "card":
      // Single card skeleton
      defaultFallback = (
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
      break;

    case "list":
      // List skeleton without card wrapper
      defaultFallback = (
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
      break;

    case "default":
    default:
      // Card-based list skeleton (default)
      defaultFallback = (
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
      break;
  }

  return <Suspense fallback={defaultFallback}>{children}</Suspense>;
}
