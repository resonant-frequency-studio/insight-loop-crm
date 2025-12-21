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
    <label className={`flex items-center gap-3 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${labelClassName}`}>
      <input
        type="checkbox"
        {...props}
        className={`w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${className}`}
      />
      {label && (
        <span className="text-sm text-theme-darker select-none">{label}</span>
      )}
    </label>
  );
}

