"use client";

import { useSidebarDrag } from "@/hooks/useSidebarDrag";

interface SidebarCollapseHandleProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

export function SidebarCollapseHandle({ isCollapsed, setIsCollapsed }: SidebarCollapseHandleProps) {
  const { handlePointerDown, handleKeyDown } = useSidebarDrag(isCollapsed, setIsCollapsed);

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className="hidden xl:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-20 bg-background border-r border-theme-light rounded-tr-md rounded-br-md items-center justify-center hover:bg-card-light transition-colors z-10 cursor-grab active:cursor-grabbing select-none pointer-events-auto"
      style={{
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        boxShadow: 'none',
      }}
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <div className="flex gap-0.5">
        {/* Left column (3 dots behind) */}
        <div className="flex flex-col gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={`left-${i}`}
              className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500"
            />
          ))}
        </div>
        {/* Right column (3 dots in front) */}
        <div className="flex flex-col gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={`right-${i}`}
              className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

