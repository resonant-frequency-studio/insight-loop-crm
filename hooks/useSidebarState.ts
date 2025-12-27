import { useState, useEffect } from "react";

/**
 * Hook to manage sidebar collapse state with localStorage persistence
 */
export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved === "true";
    }
    return false;
  });

  // Persist sidebar collapse state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarCollapsed", String(isCollapsed));
    }
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  return {
    isCollapsed,
    setIsCollapsed,
    toggleCollapse,
  };
}

