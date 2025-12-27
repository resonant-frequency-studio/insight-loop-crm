interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelClassName?: string;
}

/**
 * Reusable Checkbox component with consistent styling
 * Provides consistent styling across all checkbox elements in the application
 */
export default function Checkbox({
  label,
  labelClassName = "",
  className = "",
  ...props
}: CheckboxProps) {
  const isDisabled = props.disabled;
  return (
    <label className={`flex items-start gap-2 sm:gap-3 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${labelClassName}`}>
      <input
        type="checkbox"
        {...props}
        className={`w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5 sm:mt-0 shrink-0 ${className}`}
      />
      {label && (
        <span className="text-xs sm:text-sm text-theme-darker select-none flex-1 min-w-0">{label}</span>
      )}
    </label>
  );
}

