"use client";

interface SkeletonProps {
  className?: string;
  variant?: "default" | "card" | "circle" | "text";
  width?: string;
  height?: string;
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full";
}

/**
 * Skeleton - A reusable themed loading skeleton component
 * 
 * Uses theme-aware colors (bg-theme-light) that work in both light and dark modes.
 * Replaces all hardcoded gray backgrounds (bg-gray-200) with themed alternatives.
 * 
 * @param className - Additional CSS classes (will be merged with base classes)
 * @param variant - Predefined skeleton variants:
 *   - "default": Standard rectangular skeleton with bg-theme-light
 *   - "card": Card-like skeleton with bg-card-highlight-light and padding
 *   - "circle": Circular skeleton (for avatars, icons) - always rounded-full
 *   - "text": Text line skeleton (h-4 by default)
 * @param width - Width class (e.g., "w-64", "w-full", "w-1/2")
 * @param height - Height class (e.g., "h-8", "h-full", "h-96")
 * @param rounded - Border radius variant (ignored if variant is "circle")
 */
export default function Skeleton({
  className = "",
  variant = "default",
  width,
  height,
  rounded = "md",
}: SkeletonProps) {
  // Base classes - always use theme-aware colors
  const baseClasses = "animate-pulse";

  // Variant-specific background colors
  let bgClass = "";
  switch (variant) {
    case "card":
      bgClass = "bg-card-highlight-light";
      break;
    case "circle":
      bgClass = "bg-theme-light";
      break;
    case "text":
      bgClass = "bg-theme-light";
      break;
    default:
      bgClass = "bg-theme-light";
      break;
  }

  // Rounded classes
  const roundedClass = variant === "circle" 
    ? "rounded-full" 
    : rounded === "none" 
      ? "" 
      : `rounded-${rounded}`;

  // Height default for text variant
  const heightClass = height || (variant === "text" ? "h-4" : "");

  // Combine all classes
  const combinedClasses = [
    baseClasses,
    bgClass,
    width,
    heightClass,
    roundedClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={combinedClasses} />;
}

