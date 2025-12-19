"use client";

import React from "react";
import { ErrorMessage } from "./ErrorMessage";

export type ButtonVariant =
  | "primary"
  | "danger"
  | "secondary"
  | "outline"
  | "link";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  error?: string | null;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-btn-primary-bg border-2 border-btn-primary-border text-btn-primary-fg hover:bg-btn-primary-bg-hover focus:ring-btn-primary-focus-ring disabled:bg-btn-primary-bg-disabled disabled:text-btn-primary-fg-disabled",
  danger:
    "bg-red-600 text-[#eeeeec] hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400",
  secondary:
    "bg-btn-secondary-bg text-btn-secondary-fg border-2 border-btn-secondary-border hover:bg-btn-secondary-bg-hover focus:ring-btn-secondary-focus-ring disabled:bg-btn-secondary-bg-disabled disabled:text-btn-secondary-fg-disabled",
  outline:
    "bg-transparent border-2 border-theme-dark text-theme-darker hover:bg-theme-light focus:ring-gray-500 disabled:border-gray-300 disabled:text-gray-400",
  link: "bg-transparent text-blue-600 hover:text-blue-700 underline focus:ring-blue-500 disabled:text-blue-400",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-sm",
  sm: "px-3 py-1.5 text-base",
  md: "px-4 py-2.5 text-base",
  lg: "px-6 py-3 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  error = null,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = "left",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyles =
    "cursor-pointer inline-flex items-center justify-center gap-2 font-medium rounded-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];
  
  // Check if className includes w-full to determine if button should be full width
  const hasFullWidthClass = className.includes("w-full");
  const shouldBeFullWidth = fullWidth || hasFullWidthClass;
  const widthStyle = shouldBeFullWidth ? "w-full" : "";
  
  // Add active scale effect for interactive buttons (can be overridden with className)
  const activeScale = className.includes("active:scale") ? "" : "active:scale-95";

  const combinedClassName = `${baseStyles} ${variantStyle} ${sizeStyle} ${widthStyle} ${activeScale} ${className}`.trim();

  const renderIcon = () => {
    if (loading) {
      return (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    }
    return icon;
  };

  return (
    <div className={shouldBeFullWidth ? "w-full" : "inline-block"}>
      <button
        type={props.type || "button"}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={combinedClassName}
        {...props}
      >
        {iconPosition === "left" && renderIcon()}
        {loading && !icon ? (
          <span className="sr-only">Loading...</span>
        ) : (
          children
        )}
        {iconPosition === "right" && renderIcon()}
      </button>
      {error && <ErrorMessage message={error} className="mt-2" />}
    </div>
  );
}

