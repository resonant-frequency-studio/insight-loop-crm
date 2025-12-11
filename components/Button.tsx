"use client";

import React from "react";
import { ErrorMessage } from "./ErrorMessage";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "outline"
  | "ghost"
  | "link"
  | "gradient-blue"
  | "gradient-gray"
  | "gradient-green"
  | "gradient-emerald";

export type ButtonSize = "sm" | "md" | "lg";

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
    "bg-blue-600 text-[#eeeeec] hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-400",
  secondary:
    "bg-theme-dark text-background hover:bg-theme-darker focus:ring-gray-500 disabled:bg-gray-400",
  danger:
    "bg-red-600 text-[#eeeeec] hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400",
  success:
    "bg-emerald-600 text-[#eeeeec] hover:bg-emerald-700 focus:ring-emerald-500 disabled:bg-emerald-400",
  outline:
    "bg-transparent border-2 border-theme-dark text-theme-darker hover:bg-gray-50 focus:ring-gray-500 disabled:border-gray-300 disabled:text-gray-400",
  ghost:
    "bg-transparent text-theme-darker hover:bg-gray-100 focus:ring-gray-500 disabled:text-gray-400",
  link: "bg-transparent text-blue-600 hover:text-blue-700 underline focus:ring-blue-500 disabled:text-blue-400",
  "gradient-blue":
    "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-[#eeeeec] shadow-md hover:shadow-lg disabled:from-gray-400 disabled:to-gray-500",
  "gradient-gray":
    "bg-gradient-to-r from-gray-500 to-theme-dark hover:from-theme-dark hover:to-theme-darker text-background shadow-md hover:shadow-lg disabled:from-gray-400 disabled:to-gray-500",
  "gradient-green":
    "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-[#eeeeec] shadow-md hover:shadow-lg disabled:from-gray-400 disabled:to-gray-500",
  "gradient-emerald":
    "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-[#eeeeec] shadow-md hover:shadow-lg disabled:from-gray-400 disabled:to-gray-500",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
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
    "cursor-pointer inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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

