import React from "react";

/**
 * Reusable Textarea component with consistent styling
 * Provides consistent styling across all textarea elements in the application
 */
export default function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-4 py-3 border text-foreground placeholder:text-foreground border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none ${className}`}
    />
  );
}

