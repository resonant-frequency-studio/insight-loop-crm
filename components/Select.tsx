"use client";

import React, { useState, useRef, useEffect } from "react";

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  children: React.ReactNode;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * Reusable Select component with custom dropdown styling
 * Provides consistent styling across all select elements in the application
 * Uses custom dropdown to match Filter by Tags styling (rounded corners, shadow-lg, border-gray-200)
 */
export default function Select({ children, className = "", value, onChange, ...props }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const hiddenSelectRef = useRef<HTMLSelectElement>(null);
  const options = React.Children.toArray(children) as React.ReactElement<HTMLOptionElement>[];

  // Get the selected option's display text
  const selectedOption = options.find(opt => String(opt.props.value) === String(value));
  const displayValue = (selectedOption?.props.children as React.ReactNode) || (value === "" ? "Select..." : String(value));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleOptionClick = (optionValue: string | number | undefined) => {
    if (onChange && hiddenSelectRef.current) {
      // Update the hidden select value
      hiddenSelectRef.current.value = String(optionValue ?? "");
      // Create a synthetic event
      const syntheticEvent = {
        target: hiddenSelectRef.current,
        currentTarget: hiddenSelectRef.current,
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={selectRef}>
      {/* Hidden native select for form submission and accessibility */}
      <select
        {...props}
        ref={hiddenSelectRef}
        value={value}
        onChange={onChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      >
        {children}
      </select>

      {/* Custom dropdown button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 pr-3 border border-theme-darker rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-foreground text-left flex items-center justify-between ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{displayValue}</span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Custom dropdown options */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div 
            className="absolute z-20 w-full top-full mt-1 bg-selected-background border border-gray-200 rounded-sm shadow-lg max-h-60 overflow-y-auto"
            role="listbox"
          >
            {options.map((option, index) => {
              const optionValue = option.props.value;
              const isSelected = String(optionValue) === String(value);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleOptionClick(optionValue)}
                  className={`w-full text-left px-4 py-2 text-sm text-foreground rounded-sm hover:bg-selected-active transition-colors ${
                    isSelected ? 'bg-selected-active text-selected-foreground font-bold' : ''
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  {option.props.children as React.ReactNode}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

