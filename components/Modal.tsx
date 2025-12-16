"use client";

import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  showBackdrop?: boolean;
  closeOnBackdropClick?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  showBackdrop = true,
  closeOnBackdropClick = true,
  maxWidth = "md",
  className = "",
}: ModalProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the modal
  const getFocusableElements = (): HTMLElement[] => {
    if (!modalRef.current) return [];
    
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    
    return Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors));
  };

  // Focus trap: keep focus within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Focus management: move focus to modal on open, return on close
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      
      // Move focus to modal after a brief delay to ensure it's rendered
      // Skip inputs that have data-no-autofocus attribute
      setTimeout(() => {
        const focusableElements = getFocusableElements().filter(
          (el) => !el.hasAttribute('data-no-autofocus')
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 0);
    } else {
      // Return focus to the previously focused element
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center"
      onClick={handleBackdropClick}
      role="presentation"
    >
      {showBackdrop && (
        <div className="absolute inset-0 bg-black/20" aria-hidden="true" />
      )}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative bg-background rounded-xl shadow-xl p-6 ${maxWidthClasses[maxWidth]} w-full mx-4 z-10 border border-theme-light focus:outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h3 id={titleId} className="text-lg font-semibold text-foreground mb-4">{title}</h3>
        )}
        {children}
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body);
}

