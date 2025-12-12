/**
 * Reusable Input component with consistent styling
 * Provides consistent styling across all text input elements in the application
 */
export default function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-2 border border-theme-darker placeholder:text-foreground rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${className}`}
    />
  );
}

