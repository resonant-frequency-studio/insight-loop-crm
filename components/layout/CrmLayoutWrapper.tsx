"use client";

import { useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import MobileHeader from "@/components/MobileHeader";
import { reportException } from "@/lib/error-reporting";
import { useSavingState } from "@/contexts/SavingStateContext";
import { navigationLinks } from "@/lib/navigation-config";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { useSessionManagement } from "@/hooks/useSessionManagement";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { SidebarLogo } from "./SidebarLogo";
import { SidebarNavigation } from "./SidebarNavigation";
import { SidebarCollapseHandle } from "./SidebarCollapseHandle";
import { UserProfilePopover } from "./UserProfilePopover";

export function CrmLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isSaving } = useSavingState();
  const isLoginPage = pathname === "/login";
  const showUserElements = user && !loading;
  const [signingOut, setSigningOut] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Sidebar state management
  const { isCollapsed, setIsCollapsed } = useSidebarState();
  
  // Mobile menu management
  const { isOpen: isMobileMenuOpen, setIsOpen: setIsMobileMenuOpen, close: closeMobileMenu } = useMobileMenu();

  // Session management
  const { hasSessionCookie } = useSessionManagement(isLoginPage, loading, user);

  // Auth redirect
  useAuthRedirect(isLoginPage, loading, user, hasSessionCookie);

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

  // Always show sidebar if not on login page (prevents flash)
  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isSaving) {
      e.preventDefault();
      return;
    }
    closeMobileMenu();
  };

  const isEffectivelyCollapsed = isCollapsed;

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
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar - Fixed on mobile, normal flow on desktop */}
      <nav
        ref={sidebarRef}
        className={`w-full xl:w-64 bg-background border-r border-theme-light shadow-lg flex flex-col h-[calc(100dvh-4rem)] xl:h-screen fixed right-0 xl:relative xl:right-auto top-16 xl:top-auto z-50 shrink-0 ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0"
        } transition-all duration-300 ease-in-out`}
        style={
          isCollapsed
            ? { width: "64px" }
            : undefined
        }
      >
        {/* Collapse Handle - Desktop only */}
        <SidebarCollapseHandle isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

        {/* Logo - Show in both expanded and collapsed states */}
        <div className="hidden xl:flex items-center justify-center mb-8 pt-6">
          <SidebarLogo isCollapsed={isEffectivelyCollapsed} />
        </div>

        {/* Scrollable menu content */}
        <div className={`flex-1 overflow-y-auto ${
          isEffectivelyCollapsed ? "-mx-3 px-3" : "-mx-6 px-6"
        }`}>
          <SidebarNavigation
            navigationLinks={navigationLinks}
            pathname={pathname}
            isSaving={isSaving}
            isCollapsed={isEffectivelyCollapsed}
            onLinkClick={handleLinkClick}
          />
        </div>
        
        {/* User Profile Popover - only show when user is loaded */}
        {showUserElements && (
          <UserProfilePopover 
            user={user} 
            signingOut={signingOut} 
            onSignOut={handleSignOut} 
            isSaving={isSaving}
            isCollapsed={isEffectivelyCollapsed}
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

