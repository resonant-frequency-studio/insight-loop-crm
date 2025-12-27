import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Hook to manage mobile menu state with auto-close on navigation and body scroll prevention
 */
export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  // Close mobile menu when pathname changes
  // This closes the menu on navigation (e.g., browser back/forward, programmatic navigation)
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      // Close menu on navigation - defer to avoid cascading renders
      const timer = setTimeout(() => {
        setIsOpen(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
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

  const toggle = () => {
    setIsOpen((prev) => !prev);
  };

  const close = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    setIsOpen,
    toggle,
    close,
  };
}

