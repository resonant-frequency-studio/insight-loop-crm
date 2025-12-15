import React from "react";

/**
 * Reusable Input component with consistent styling
 * Provides consistent styling across all text input elements in the application
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        {...props}
        className={`w-full px-4 py-2 border border-theme-darker placeholder:text-foreground rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${className}`}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;

