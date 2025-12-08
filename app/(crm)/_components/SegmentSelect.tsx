"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";

interface SegmentSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  existingSegments: string[];
  placeholder?: string;
  className?: string;
}

export default function SegmentSelect({
  value,
  onChange,
  existingSegments,
  placeholder = "Enter or select segment...",
  className = "",
}: SegmentSelectProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isUserTypingRef = useRef(false);
  const previousValueRef = useRef<string | null>(value);
  const inputValueRef = useRef(inputValue);

  // Keep ref in sync with state
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  // Function to sync input value from prop changes (called from effect)
  // This follows React's recommendation to call a function instead of setState directly
  const syncInputFromProp = useCallback((newValue: string | null) => {
    const valueToSet = newValue || "";
    // Use ref to check current value without causing re-renders
    if (inputValueRef.current !== valueToSet) {
      setInputValue(valueToSet);
    }
  }, []);

  // Update input value when prop value changes (only if changed externally, not from user input)
  // This is necessary to sync controlled input state with prop changes while allowing user typing
  // We defer the state update by calling the sync function asynchronously to avoid cascading renders
  useEffect(() => {
    if (previousValueRef.current !== value && !isUserTypingRef.current) {
      previousValueRef.current = value;
      // Defer the function call to avoid synchronous setState in effect
      queueMicrotask(() => {
        syncInputFromProp(value);
      });
    }
    // Reset typing flag after a short delay
    if (isUserTypingRef.current) {
      const timer = setTimeout(() => {
        isUserTypingRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [value, syncInputFromProp]);

  // Filter segments based on input
  const filteredSegments = useMemo(() => {
    if (!inputValue.trim()) {
      return existingSegments;
    }
    const searchLower = inputValue.toLowerCase();
    return existingSegments.filter((segment) =>
      segment.toLowerCase().includes(searchLower)
    );
  }, [inputValue, existingSegments]);

  // Check if current input matches an existing segment
  const isExistingSegment = useMemo(() => {
    return existingSegments.includes(inputValue.trim());
  }, [inputValue, existingSegments]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    isUserTypingRef.current = true;
    setInputValue(newValue);
    setHighlightedIndex(-1);
    setIsOpen(true);
    // Update parent immediately so user can type freely
    onChange(newValue.trim() || null);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    // Delay closing to allow clicking on dropdown items
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
        
        // If input doesn't match existing segment, keep it (allow new segments)
        // If input is empty, clear it
        if (!inputValue.trim()) {
          onChange(null);
        }
      }
    }, 200);
  };

  const handleSelectSegment = (segment: string) => {
    setInputValue(segment);
    onChange(segment);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setInputValue("");
    onChange(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredSegments.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelectSegment(filteredSegments[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 pr-10 text-gray-900 placeholder:text-gray-400"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        {!inputValue && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
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
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={dropdownRef}
            className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredSegments.length > 0 ? (
              <>
                {filteredSegments.map((segment, index) => (
                  <button
                    key={segment}
                    type="button"
                    onClick={() => handleSelectSegment(segment)}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm ${
                      index === highlightedIndex ? "bg-gray-100" : ""
                    } ${
                      segment === value ? "font-medium text-blue-600" : "text-gray-700"
                    }`}
                  >
                    {segment}
                  </button>
                ))}
                {!isExistingSegment && inputValue.trim() && (
                  <div className="border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => handleSelectSegment(inputValue.trim())}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm text-blue-600 font-medium"
                    >
                      + Create &quot;{inputValue.trim()}&quot;
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {inputValue.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleSelectSegment(inputValue.trim())}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm text-blue-600 font-medium"
                  >
                    + Create new segment: &quot;{inputValue.trim()}&quot;
                  </button>
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500">
                    No segments available
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

