"use client";

import Link from "next/link";
import type { NavigationItem } from "@/types/layout";
import { SidebarTooltip } from "./SidebarTooltip";
import { isActive } from "@/lib/layout-utils";
import { getLinkClasses } from "@/lib/layout-utils";

interface SidebarNavigationProps {
  navigationLinks: NavigationItem[];
  pathname: string | null;
  isSaving: boolean;
  isCollapsed: boolean;
  onLinkClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function SidebarNavigation({
  navigationLinks,
  pathname,
  isSaving,
  isCollapsed,
  onLinkClick,
}: SidebarNavigationProps) {
  return (
    <ul className="space-y-2">
      {navigationLinks.map((link, index) => {
        // Handle divider
        if ('isDivider' in link && link.isDivider) {
          return (
            <li key={`divider-${index}`} className="my-6">
              <div className="border-t border-theme-light" />
            </li>
          );
        }

        // Type assertion: after divider check, this is a navigation link
        const navLink = link as { href: string; label: string; iconPath: React.ReactNode };
        const linkIsActive = isActive(navLink.href, pathname);
        const baseLinkClasses = isCollapsed 
          ? "flex items-center justify-center px-2 py-3 rounded-sm transition-colors duration-200 font-medium"
          : getLinkClasses(linkIsActive, isSaving);
        
        const linkClasses = isCollapsed
          ? `${baseLinkClasses} ${isSaving ? "text-theme-medium cursor-not-allowed pointer-events-none" : linkIsActive ? "bg-card-light text-foreground" : "text-foreground hover:bg-card-light"}`
          : baseLinkClasses;

        // Generate data-tour attribute for tour targeting
        const getTourSelector = (href: string): string | undefined => {
          if (href === "/insights") return "nav-insights";
          if (href === "/schedule") return "nav-schedule";
          if (href === "/contacts") return "nav-contacts";
          if (href === "/action-items") return "nav-action-items";
          return undefined;
        };

        const tourSelector = getTourSelector(navLink.href);

        const linkContent = (
          <Link
            href={navLink.href}
            onClick={onLinkClick}
            prefetch={navLink.href !== "#"}
            className={linkClasses}
            title={isCollapsed ? navLink.label : undefined}
            {...(tourSelector ? { "data-tour": tourSelector } : {})}
          >
            <svg
              className={`${isCollapsed ? "w-5 h-5" : "w-5 h-5 mr-3"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {navLink.iconPath}
            </svg>
            {!isCollapsed && <span>{navLink.label}</span>}
          </Link>
        );

        return (
          <li key={navLink.href}>
            {isCollapsed ? (
              <SidebarTooltip label={navLink.label}>
                {linkContent}
              </SidebarTooltip>
            ) : (
              linkContent
            )}
          </li>
        );
      })}
    </ul>
  );
}

