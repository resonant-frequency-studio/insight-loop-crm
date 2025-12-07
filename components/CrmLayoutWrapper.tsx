"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import HamburgerMenu from "@/components/HamburgerMenu";
import Loading from "@/components/Loading";
import { Button } from "@/components/Button";

export function CrmLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";
  const showUserElements = user && !loading;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const previousPathname = useRef(pathname);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(path);
  };

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
        console.error("Session check failed:", error);
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
      console.error("Sign out error:", error);
      // Still redirect even if cleanup fails
      router.push("/login");
    }
  };

  // Redirect to login if not authenticated and not on login page
  useEffect(() => {
    if (!isLoginPage && !loading && !user) {
      router.push("/login");
    }
  }, [isLoginPage, loading, user, router]);

  // Show loading state while checking auth
  if (!isLoginPage && loading) {
    return <Loading />;
  }

  // Show loading while redirecting
  if (!isLoginPage && !loading && !user) {
    return <Loading />;
  }

  // Always show sidebar if not on login page (prevents flash)
  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Menu Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Hamburger Menu Button */}
      <HamburgerMenu isOpen={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      {/* Sidebar - Fixed on desktop, overlay on mobile */}
      <nav
        className={`w-full lg:w-64 bg-[#212B36] p-6 border-r border-gray-700 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <h2 className="text-xl font-semibold mb-8 text-white">Resilient Leadership CRM</h2>

        <ul className="space-y-2 flex-1">
          <li>
            <Link
              href="/"
              onClick={handleLinkClick}
              className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                isActive("/")
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
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
              className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                isActive("/contacts") && !pathname?.startsWith("/contacts/import")
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
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
              className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                isActive("/contacts/import")
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
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
              className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                isActive("/action-items")
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
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
          <li>
            <Link
              href="/sync"
              onClick={handleLinkClick}
              className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                isActive("/sync")
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
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
              className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                isActive("/faq")
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
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

        {/* User Profile and Sign Out - only show when user is loaded */}
        {showUserElements && (
          <div className="mt-auto space-y-3">
            {/* User Info Card */}
            <div className="px-4 py-3 bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white font-semibold text-sm">
                    {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {user?.displayName || "User"}
                  </p>
                  <p className="text-gray-400 text-xs truncate">
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
              className="bg-gray-700 hover:bg-gray-600 text-white"
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
      <main className="flex-1 lg:ml-64 p-6 lg:p-10 bg-white text-gray-800 overflow-y-auto h-screen">
        {children}
      </main>
    </div>
  );
}

