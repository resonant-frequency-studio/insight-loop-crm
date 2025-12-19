"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/Button";

interface OverflowMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
}

export default function OverflowMenu({ items }: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-sm transition-colors focus:outline-none"
        style={{
          color: 'var(--text-muted)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
          e.currentTarget.style.color = 'var(--foreground)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
        aria-label="More options"
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
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 rounded-sm z-50"
          style={{
            backgroundColor: 'var(--surface-modal)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-menu)',
          }}
        >
          <div className="py-1">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                disabled={item.disabled}
                className="w-full text-left px-4 py-2 text-sm transition-colors focus:outline-none"
                style={{
                  color: item.danger 
                    ? 'rgba(250, 43, 54, 0.95)' 
                    : 'var(--foreground)',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    e.currentTarget.style.backgroundColor = item.danger
                      ? 'rgba(250, 43, 54, 0.1)'
                      : 'var(--surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onFocus={(e) => {
                  if (!item.disabled) {
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring)';
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

