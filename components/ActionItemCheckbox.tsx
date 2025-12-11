"use client";

interface ActionItemCheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string; // Optional label text (defaults to "Mark Complete" or "Complete")
}

export default function ActionItemCheckbox({
  checked,
  onChange,
  disabled = false,
  label,
}: ActionItemCheckboxProps) {
  const defaultLabel = checked ? "Complete" : "Mark Complete";
  const displayLabel = label ?? defaultLabel;

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        title={displayLabel}
        aria-label={displayLabel}
      />
      <span className="text-sm text-theme-darker select-none">{displayLabel}</span>
    </label>
  );
}

