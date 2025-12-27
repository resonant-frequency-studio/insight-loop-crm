"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import MobileHeader from "@/components/MobileHeader";
import { appConfig } from "@/lib/app-config";
import { reportException } from "@/lib/error-reporting";
import { useSavingState } from "@/contexts/SavingStateContext";
import { useOwnerContact } from "@/hooks/useOwnerContact";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { useTheme } from "./ThemeProvider";
import type { User } from "firebase/auth";

// User Profile Popover Component
function UserProfilePopover({ 
  user, 
  signingOut, 
  onSignOut, 
  isSaving,
  isCollapsed
}: { 
  user: User | null; 
  signingOut: boolean; 
  onSignOut: () => void;
  isSaving: boolean;
  isCollapsed?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { ownerContact } = useOwnerContact();
  const { theme, setTheme, resolvedTheme } = useTheme();
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isSaving) {
      e.preventDefault();
      return;
    }
    setIsMenuOpen(false);
  };

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark'> = ['light', 'dark'];
    const currentIndex = themes.indexOf(theme as 'light' | 'dark');
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  // Get profile photo or initials
  const [imageError, setImageError] = useState(false);
  const profilePhoto = ownerContact?.photoUrl;
  const hasValidPhoto = profilePhoto && typeof profilePhoto === 'string' && profilePhoto.trim() !== '' && !imageError;
  const initials = ownerContact ? getInitials(ownerContact) : (user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U");
  const displayName = ownerContact ? getDisplayName(ownerContact) : (user?.displayName || "User");

  return (
    <div className="py-4 border-t border-theme-light flex items-center justify-center">
      <div className="relative w-full" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          disabled={isSaving}
          className={`w-full flex items-center justify-center gap-3 py-3 px-2 rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            isSaving
              ? "cursor-not-allowed opacity-50"
              : isMenuOpen
              ? "bg-card-light"
              : "hover:bg-card-light"
          }`}
          aria-label="User menu"
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
        >
          {hasValidPhoto ? (
            <Image
              key={profilePhoto}
              src={profilePhoto}
              alt={displayName}
              width={40}
              height={40}
              sizes="40px"
              className="w-10 h-10 rounded-full object-cover shrink-0"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 bg-theme-light rounded-full flex items-center justify-center shrink-0">
              <span className="text-foreground font-semibold text-sm">
                {initials}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <span className="text-foreground font-medium text-sm truncate text-center">
              {displayName}
            </span>
          )}
        </button>

        {/* Popover Menu */}
        {isMenuOpen && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              className="absolute left-0 bottom-full mb-2 z-20 w-56 bg-card-highlight-light border border-theme-lighter rounded-sm shadow-lg py-1"
              role="menu"
            >
              {/* Theme Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  cycleTheme();
                }}
                className="w-full text-left px-4 py-2 flex items-center gap-3 text-sm text-foreground hover:bg-selected-active transition-colors"
                role="menuitem"
              >
                {resolvedTheme === 'dark' ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2" />
                      <path d="M12 20v2" />
                      <path d="m4.93 4.93 1.41 1.41" />
                      <path d="m17.66 17.66 1.41 1.41" />
                      <path d="M2 12h2" />
                      <path d="M20 12h2" />
                      <path d="m6.34 17.66-1.41 1.41" />
                      <path d="m19.07 4.93-1.41 1.41" />
                    </svg>
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    <span>Dark Mode</span>
                  </>
                )}
              </button>

              {/* Admin */}
              <Link
                href="/admin"
                onClick={handleLinkClick}
                prefetch={true}
                className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-selected-active transition-colors"
                role="menuitem"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>Admin</span>
              </Link>

              {/* Sign out */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  onSignOut();
                }}
                disabled={signingOut || isSaving}
                className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-error-red-text hover:bg-selected-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                role="menuitem"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>{signingOut ? "Signing out..." : "Sign out"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const navigationLinks = [
  {
    href: "/",
    label: "Dashboard",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
  },
  {
    href: "/contacts",
    label: "Contacts",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    ),
  },
  {
    href: "/contacts/new",
    label: "Add Contact",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    ),
  },
  {
    href: "/contacts/import",
    label: "Import Contacts",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    ),
  },
  {
    href: "/action-items",
    label: "Action Items",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    ),
  },
  {
    href: "/insights",
    label: "Insights",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    ),
  },
  {
    href: "/touchpoints/today",
    label: "Touchpoints - Today",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    ),
  },
  {
    href: "/touchpoints/overdue",
    label: "Touchpoints - Overdue",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
  {
    href: "/touchpoints/upcoming",
    label: "Touchpoints - Upcoming",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    ),
  },
  {
    href: "/sync",
    label: "Sync Status",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    ),
  },
  {
    href: "/faq",
    label: "FAQ",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
];

// Placeholder logo component
function PlaceholderLogo({ size = "default" }: { size?: "default" | "small" }) {
  const logoSize = size === "small" ? "w-8 h-8" : "w-10 h-10";
  return (
    <div className={`${logoSize} bg-theme-light rounded-md flex items-center justify-center`}>
      <svg
        className={`${size === "small" ? "w-5 h-5" : "w-6 h-6"} text-theme-dark`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {/* Building/Company icon */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    </div>
  );
}

// Logo component for sidebar
function SidebarLogo({ isCollapsed }: { isCollapsed: boolean }) {
  const logoUrl = appConfig.logoUrl;

  if (logoUrl) {
    const size = isCollapsed ? 32 : 40;
    return (
      <div className={`${isCollapsed ? "w-8 h-8" : "w-10 h-10"} relative shrink-0`}>
        <Image
          src={logoUrl}
          alt={appConfig.crmName}
          width={size}
          height={size}
          className="object-contain w-full h-full"
          unoptimized
        />
      </div>
    );
  }

  return <PlaceholderLogo size={isCollapsed ? "small" : "default"} />;
}

// Tooltip component for collapsed sidebar links
function SidebarTooltip({ label, children }: { label: string; children: React.ReactElement }) {
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

export function CrmLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isSaving } = useSavingState();
  const isLoginPage = pathname === "/login";
  const showUserElements = user && !loading;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const previousPathname = useRef(pathname);
  const [hasSessionCookie, setHasSessionCookie] = useState<boolean | null>(null);
  // Initialize sidebar collapse state from localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved === "true";
    }
    return false;
  });
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isDraggingRef = useRef(false);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(path);
  };

  // Persist sidebar collapse state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarCollapsed", String(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed]);

  // Close admin menu when clicking outside (handled by backdrop in the popover)

  // Close mobile menu when pathname changes
  // This closes the menu on navigation (e.g., browser back/forward, programmatic navigation)
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      // Close menu on navigation - defer to avoid cascading renders
      const timer = setTimeout(() => {
        setIsMobileMenuOpen(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // Check session validity periodically (not immediately to avoid race conditions after login)
  useEffect(() => {
    if (isLoginPage || loading || !user) return;

    let intervalId: NodeJS.Timeout | null = null;
    let failureCount = 0;
    const MAX_FAILURES = 2; // Allow 2 failures before redirecting (to account for timing issues)

    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/check", {
          credentials: "include", // Ensure cookies are sent
        });
        if (!res.ok) {
          failureCount++;
          // Only redirect after multiple failures (to avoid false positives after login)
          if (failureCount >= MAX_FAILURES) {
            router.push("/login?expired=true");
          }
        } else {
          // Reset failure count on success
          failureCount = 0;
        }
      } catch (error) {
        reportException(error, {
          context: "Session check failed",
          tags: { component: "CrmLayoutWrapper" },
        });
        // Don't increment failure count on network errors
      }
    };

    // Delay initial check to avoid race condition with cookie being set after login
    // Longer delay to ensure cookie is fully available
    const initialDelay = setTimeout(() => {
      checkSession();
      // Check session every 5 minutes
      intervalId = setInterval(checkSession, 5 * 60 * 1000);
    }, 2000); // Wait 2 seconds after mount before first check

    return () => {
      clearTimeout(initialDelay);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isLoginPage, loading, user, router]);

  // Handle sign out with session cleanup
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // Clear Firebase auth
      await signOut(auth);
      // Clear session cookie
      await fetch("/api/auth/session", { method: "DELETE" });
      // Redirect to login
      router.push("/login");
    } catch (error) {
      reportException(error, {
        context: "Sign out error",
        tags: { component: "CrmLayoutWrapper" },
      });
      // Still redirect even if cleanup fails
      router.push("/login");
    }
  };

  // Check session cookie when there's no Firebase user (for E2E tests that use session cookies only)
  useEffect(() => {
    if (!user && !loading) {
      fetch("/api/auth/check", {
        credentials: "include",
      })
        .then((response) => {
          setHasSessionCookie(response.ok);
        })
        .catch(() => {
          setHasSessionCookie(false);
        });
    } else {
      setHasSessionCookie(user ? true : null);
    }
  }, [user, loading]);

  // Redirect to login if not authenticated and not on login page
  // Allow page to render if session cookie is valid (for E2E tests)
  useEffect(() => {
    if (isLoginPage) return;
    
    // Wait for auth state and session cookie check to complete
    if (loading || (hasSessionCookie === null && !user)) {
      return; // Still checking
    }
    
    // Redirect if not authenticated (no Firebase user and no valid session cookie)
    if (!user && hasSessionCookie !== true) {
      router.push("/login");
    }
  }, [isLoginPage, loading, user, router, hasSessionCookie]);

  // Always show sidebar if not on login page (prevents flash)
  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isSaving) {
      e.preventDefault();
      return;
    }
    setIsMobileMenuOpen(false);
  };
  
  // Helper to get link classes with disabled state styling
  const getLinkClasses = (isActive: boolean, isSaving: boolean) => {
    const baseClasses = "flex items-center px-4 py-3 rounded-sm transition-colors duration-200 font-medium";
    if (isSaving) {
      return `${baseClasses} text-theme-medium cursor-not-allowed pointer-events-none`;
    }
    if (isActive) {
      return `${baseClasses} bg-card-light text-foreground`;
    }
    return `${baseClasses} text-foreground hover:bg-card-light`;
  };

  return (
    <div className="flex h-screen overflow-hidden xl:flex-row">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-foreground focus:rounded-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>
      {/* Mobile Header Bar - Only visible on mobile (up to 1280px) */}
      <MobileHeader isMenuOpen={isMobileMenuOpen} onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      {/* Mobile Menu Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 xl:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Fixed on mobile, normal flow on desktop */}
      <nav
        ref={sidebarRef}
        className={`w-full xl:w-64 bg-background border-r border-theme-light shadow-lg flex flex-col h-[calc(100dvh-4rem)] xl:h-screen fixed right-0 xl:relative xl:right-auto top-16 xl:top-auto z-50 shrink-0 ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0"
        } ${
          dragWidth === null ? "transition-all duration-300 ease-in-out" : ""
        }`}
        style={
          dragWidth !== null
            ? {
                width: `${dragWidth}px`,
                paddingLeft: dragWidth <= 80 ? "0.75rem" : "1.5rem",
                paddingRight: dragWidth <= 80 ? "0.75rem" : "1.5rem",
                paddingTop: dragWidth <= 80 ? "0.75rem" : "1.5rem",
                paddingBottom: dragWidth <= 80 ? "0.75rem" : "1.5rem",
              }
            : isSidebarCollapsed
            ? { width: "64px" }
            : undefined
        }
      >
        {/* Collapse Handle - Desktop only */}
        <div
          role="button"
          tabIndex={0}
          onPointerDown={(e) => {
            // Only handle if this click actually started on the collapse handle or its children
            const target = e.target as Node;
            const currentTarget = e.currentTarget as HTMLElement;
            if (target !== currentTarget && !currentTarget.contains(target)) {
              return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            const startX = e.clientX;
            const startCollapsed = isSidebarCollapsed;
            const dragThreshold = 10; // Minimum pixels to move before considering it a drag
            const pointerId = e.pointerId;
            const handleElement = e.currentTarget as HTMLElement;
            
            let hasMoved = false;
            let finalDeltaX = 0;
            let isActive = true;

            // Prevent text selection during drag
            const originalUserSelect = document.body.style.userSelect;
            const originalCursor = document.body.style.cursor;
            const originalPointerEvents = document.body.style.pointerEvents;
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
            document.body.style.pointerEvents = 'auto';

            const handlePointerMove = (moveEvent: PointerEvent) => {
              // Only handle if this is the same pointer interaction and still active
              if (moveEvent.pointerId !== pointerId || !isActive) return;
              
              moveEvent.preventDefault();
              const deltaX = moveEvent.clientX - startX;
              finalDeltaX = deltaX;
              
              if (Math.abs(deltaX) > dragThreshold) {
                hasMoved = true;
                isDraggingRef.current = true;
              }
            };

            const handlePointerUp = (upEvent: PointerEvent) => {
              // Only handle if this is the same pointer interaction and still active
              if (upEvent.pointerId !== pointerId || !isActive) return;
              
              isActive = false;
              upEvent.preventDefault();
              
              // Restore styles
              document.body.style.userSelect = originalUserSelect;
              document.body.style.cursor = originalCursor;
              document.body.style.pointerEvents = originalPointerEvents;
              
              const wasDragging = hasMoved;
              isDraggingRef.current = false;
              
              if (wasDragging) {
                // Snap based on drag direction
                // Dragging left (negative deltaX) → collapse
                // Dragging right (positive deltaX) → expand
                if (finalDeltaX < 0) {
                  setIsSidebarCollapsed(true);
                } else {
                  setIsSidebarCollapsed(false);
                }
              } else {
                // If no drag occurred, toggle on click
                setIsSidebarCollapsed(!startCollapsed);
              }
              
              setDragWidth(null);
              window.removeEventListener("pointermove", handlePointerMove, { capture: true });
              window.removeEventListener("pointerup", handlePointerUp, { capture: true });
              
              // Release pointer capture
              if (handleElement.hasPointerCapture && handleElement.hasPointerCapture(pointerId)) {
                handleElement.releasePointerCapture(pointerId);
              }
            };

            // Set pointer capture FIRST to ensure we only get events for this interaction
            // This prevents other elements from receiving pointer events during the drag
            try {
              handleElement.setPointerCapture(pointerId);
            } catch {
              // If pointer capture fails, don't set up drag handlers
              // Restore styles and return early
              document.body.style.userSelect = originalUserSelect;
              document.body.style.cursor = originalCursor;
              document.body.style.pointerEvents = originalPointerEvents;
              return;
            }
            
            // Use capture phase to ensure we catch events, but only for this specific pointer
            // The pointerId check ensures we only handle events from this interaction
            window.addEventListener("pointermove", handlePointerMove, { capture: true });
            window.addEventListener("pointerup", handlePointerUp, { capture: true });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }
          }}
          className="hidden xl:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-20 bg-background border-r border-theme-light rounded-tr-md rounded-br-md items-center justify-center hover:bg-card-light transition-colors z-10 cursor-grab active:cursor-grabbing select-none pointer-events-auto"
          style={{
            borderLeft: 'none',
            borderTop: 'none',
            borderBottom: 'none',
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            boxShadow: 'none',
          }}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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

        {/* Logo - Show in both expanded and collapsed states */}
        <div className="hidden xl:flex items-center justify-center mb-8 pt-6">
          <SidebarLogo isCollapsed={dragWidth !== null ? dragWidth <= 80 : isSidebarCollapsed} />
        </div>

        {/* Scrollable menu content */}
        <div className={`flex-1 overflow-y-auto ${
          (() => {
            const isEffectivelyCollapsed = dragWidth !== null ? dragWidth <= 80 : isSidebarCollapsed;
            return isEffectivelyCollapsed ? "-mx-3 px-3" : "-mx-6 px-6";
          })()
        }`}>
          <ul className="space-y-2">
          {navigationLinks.map((link) => {
            const linkIsActive = isActive(link.href);
            const isEffectivelyCollapsed = dragWidth !== null ? dragWidth <= 80 : isSidebarCollapsed;
            const baseLinkClasses = isEffectivelyCollapsed 
              ? "flex items-center justify-center px-2 py-3 rounded-sm transition-colors duration-200 font-medium"
              : getLinkClasses(linkIsActive, isSaving);
            
            const linkClasses = isEffectivelyCollapsed
              ? `${baseLinkClasses} ${isSaving ? "text-theme-medium cursor-not-allowed pointer-events-none" : linkIsActive ? "bg-card-light text-foreground" : "text-foreground hover:bg-card-light"}`
              : baseLinkClasses;

            const linkContent = (
              <Link
                href={link.href}
                onClick={handleLinkClick}
                prefetch={link.href !== "#"}
                className={linkClasses}
                title={isEffectivelyCollapsed ? link.label : undefined}
              >
                <svg
                  className={`${isEffectivelyCollapsed ? "w-5 h-5" : "w-5 h-5 mr-3"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {link.iconPath}
                </svg>
                {!isEffectivelyCollapsed && <span>{link.label}</span>}
              </Link>
            );

            return (
              <li key={link.href}>
                {isEffectivelyCollapsed ? (
                  <SidebarTooltip label={link.label}>
                    {linkContent}
                  </SidebarTooltip>
                ) : (
                  linkContent
                )}
              </li>
            );
          })}
          </ul>
        </div>
        
        {/* User Profile Popover - only show when user is loaded */}
        {showUserElements && (
          <UserProfilePopover 
            user={user} 
            signingOut={signingOut} 
            onSignOut={handleSignOut} 
            isSaving={isSaving}
            isCollapsed={dragWidth !== null ? dragWidth <= 80 : isSidebarCollapsed}
          />
        )}
      </nav>

      {/* Main content - Scrollable */}
      <main 
        id="main-content" 
        className="flex-1 pt-20 xl:pt-10 px-6 xl:px-10 pb-6 xl:pb-10 bg-background text-foreground overflow-y-auto h-screen min-w-0"
      >
        {children}
      </main>
    </div>
  );
}

