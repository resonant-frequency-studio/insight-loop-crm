"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Tooltip component for collapsed sidebar links
export function SidebarTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const updateTooltipPosition = () => {
    if (elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8, // 8px = ml-2 (0.5rem)
      });
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      updateTooltipPosition();
      setShowTooltip(true);
    }, 300); // Small delay before showing
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    if (showTooltip) {
      updateTooltipPosition();
      const handleScroll = () => updateTooltipPosition();
      const handleResize = () => updateTooltipPosition();
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [showTooltip]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div 
        ref={elementRef}
        className="relative" 
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {showTooltip && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed z-[9999] px-3 py-1.5 bg-theme-darkest dark:bg-theme-lightest text-foreground text-xs rounded-sm whitespace-nowrap shadow-lg pointer-events-none -translate-y-1/2"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-theme-darkest dark:border-r-theme-lightest" />
        </div>,
        document.body
      )}
    </>
  );
}

