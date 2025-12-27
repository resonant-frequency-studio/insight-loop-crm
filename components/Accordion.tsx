"use client";

import { useState, ReactNode } from "react";

interface AccordionProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function Accordion({
  title,
  description,
  children,
  defaultOpen = false,
  className = "",
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity cursor-pointer"
        aria-expanded={isOpen}
      >
        <div>
          <h2 className="text-lg font-medium text-theme-darkest opacity-70">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-theme-dark opacity-70 italic">
              {description}
            </p>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-theme-darkest transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
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
      {isOpen && <div className="mt-4">{children}</div>}
    </div>
  );
}

