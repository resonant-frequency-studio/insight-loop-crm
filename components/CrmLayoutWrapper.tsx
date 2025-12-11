"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/Button";
import { appConfig } from "@/lib/app-config";
import { reportException } from "@/lib/error-reporting";
import { useSavingState } from "@/contexts/SavingStateContext";
import ThemeToggle from "./ThemeToggle";

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
  const [isTouchpointsOpen, setIsTouchpointsOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(path);
  };

  // Auto-expand Touchpoints submenu if on a touchpoint page
  useEffect(() => {
    if (pathname?.startsWith("/touchpoints/")) {
      setIsTouchpointsOpen(true);
    }
  }, [pathname]);

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
    const baseClasses = "flex items-center px-4 py-3 rounded-md transition-colors duration-200 font-medium";
    if (isSaving) {
      return `${baseClasses} text-[#8d8a85] cursor-not-allowed pointer-events-none`;
    }
    if (isActive) {
      return `${baseClasses} bg-[#ebe7e4] xl:bg-[#333330] text-[#191919] xl:text-[#fafaf9]`;
    }
    return `${baseClasses} text-[#292927] xl:text-[#ebe7e4] hover:bg-[#ebe7e4] xl:hover:bg-[#333330] hover:text-[#191919] xl:hover:text-[#fafaf9]`;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-[#fafaf9] focus:rounded-md focus:font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

      {/* Sidebar - Fixed on desktop, overlay on mobile */}
      <nav
        className={`w-full xl:w-64 bg-[#EEEEEC] xl:bg-[#191918] p-6 border-r border-theme-light flex flex-col h-[calc(100dvh-4rem)] xl:h-screen fixed right-0 xl:left-0 top-16 xl:top-0 z-50 transition-transform duration-500 ease-in-out ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0"
        }`}
      >
        {/* Title - Only show on desktop */}
        <h2 className="hidden xl:block text-xl font-semibold mb-8 text-[#fafaf9]">{appConfig.crmName}</h2>

        {/* Scrollable menu content */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <ul className="space-y-2">
          <li>
            <Link
              href="/"
              onClick={handleLinkClick}
              className={getLinkClasses(isActive("/"), isSaving)}
            >
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              href="/contacts"
              onClick={handleLinkClick}
              className={getLinkClasses(isActive("/contacts") && !pathname?.startsWith("/contacts/import"), isSaving)}
            >
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Contacts
            </Link>
          </li>
          <li>
            <Link
              href="/contacts/import"
              onClick={handleLinkClick}
              className={getLinkClasses(isActive("/contacts/import"), isSaving)}
            >
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Import Contacts
            </Link>
          </li>
          <li>
            <Link
              href="/action-items"
              onClick={handleLinkClick}
              className={getLinkClasses(isActive("/action-items"), isSaving)}
            >
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              Action Items
            </Link>
          </li>
          {/* Touchpoints Submenu */}
          <li>
            <button
              onClick={() => setIsTouchpointsOpen(!isTouchpointsOpen)}
              disabled={isSaving}
              className={`${getLinkClasses(
                pathname?.startsWith("/touchpoints/") || false,
                isSaving
              )} ${!isSaving ? "cursor-pointer" : ""} w-full`}
            >
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Touchpoints
              <svg
                className={`w-4 h-4 ml-auto transition-transform duration-200 ${
                  isTouchpointsOpen ? "rotate-90" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            {isTouchpointsOpen && (
              <ul className="ml-8 mt-2 space-y-1">
                <li>
                  <Link
                    href="/touchpoints/today"
                    onClick={handleLinkClick}
                    className={getLinkClasses(isActive("/touchpoints/today"), isSaving)}
                  >
                    <svg
                      className="w-4 h-4 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Today
                  </Link>
                </li>
                <li>
                  <Link
                    href="/touchpoints/overdue"
                    onClick={handleLinkClick}
                    className={getLinkClasses(isActive("/touchpoints/overdue"), isSaving)}
                  >
                    <svg
                      className="w-4 h-4 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Overdue
                  </Link>
                </li>
                <li>
                  <Link
                    href="/touchpoints/upcoming"
                    onClick={handleLinkClick}
                    className={getLinkClasses(isActive("/touchpoints/upcoming"), isSaving)}
                  >
                    <svg
                      className="w-4 h-4 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Upcoming
                  </Link>
                </li>
              </ul>
            )}
          </li>
          <li>
            <Link
              href="/charts"
              onClick={handleLinkClick}
              className={getLinkClasses(isActive("/charts"), isSaving)}
            >
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Charts
            </Link>
          </li>
          <li>
            <Link
              href="/sync"
              onClick={handleLinkClick}
              className={getLinkClasses(isActive("/sync"), isSaving)}
            >
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Sync Status
            </Link>
          </li>
          <li>
            <Link
              href="/faq"
              onClick={handleLinkClick}
              className={getLinkClasses(isActive("/faq"), isSaving)}
            >
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              FAQ
            </Link>
          </li>
          </ul>
        </div>
        <ThemeToggle />
        {/* User Profile and Sign Out - only show when user is loaded */}
        {showUserElements && (
          <div className="mt-auto space-y-3">
            {/* User Info Card */}
            <div className="px-4 py-3 bg-[#fafaf9] xl:bg-[#333330] rounded-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-300 xl:bg-[#191918] rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[#191919] xl:text-[#fafaf9] font-semibold text-sm">
                    {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#191919] xl:text-[#fafaf9] font-medium text-sm truncate">
                    {user?.displayName || "User"}
                  </p>
                  <p className="text-[#8d8a85] text-xs truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleSignOut}
              disabled={signingOut}
              loading={signingOut}
              variant="secondary"
              size="sm"
              fullWidth
              className="bg-gray-200 xl:bg-[#333330] hover:bg-gray-300 xl:hover:bg-gray-600 text-[#191919] xl:text-[#fafaf9]"
              icon={
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
              }
            >
              Sign Out
            </Button>
          </div>
        )}
      </nav>

      {/* Main content - Scrollable */}
      <main id="main-content" className="flex-1 xl:ml-64 pt-20 xl:pt-10 px-6 xl:px-10 pb-6 xl:pb-10 bg-background text-foreground overflow-y-auto h-screen">
        {children}
      </main>
    </div>
  );
}

