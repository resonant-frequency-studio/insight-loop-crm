"use client";

import { useState, ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  preview?: string;
  icon?: ReactNode;
}

export default function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  preview,
  icon,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div 
      className="rounded-sm"
      style={{
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--surface-panel)',
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 transition-colors focus:outline-none"
        style={{
          backgroundColor: 'var(--surface-bar)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-bar)';
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <div 
              className="w-5 h-5"
              style={{ color: 'var(--text-muted)' }}
            >
              {icon}
            </div>
          )}
          <span 
            className="font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            {title}
          </span>
          {!isExpanded && preview && (
            <span 
              className="text-sm font-normal ml-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {preview}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: 'var(--text-muted)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isExpanded && (
        <div 
          className="p-3 pt-0"
          style={{
            borderTop: '1px solid var(--divider)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

