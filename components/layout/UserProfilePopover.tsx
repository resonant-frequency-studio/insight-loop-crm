"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { User } from "firebase/auth";
import { useOwnerContact } from "@/hooks/useOwnerContact";
import { useTheme } from "@/components/ThemeProvider";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { useGuidance } from "@/app/providers/GuidanceProvider";

interface UserProfilePopoverProps {
  user: User | null;
  signingOut: boolean;
  onSignOut: () => void;
  isSaving: boolean;
  isCollapsed?: boolean;
}

export function UserProfilePopover({
  user,
  signingOut,
  onSignOut,
  isSaving,
  isCollapsed,
}: UserProfilePopoverProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { ownerContact } = useOwnerContact();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { startTour } = useGuidance();
  const [imageError, setImageError] = useState(false);

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
  const profilePhoto = ownerContact?.photoUrl;
  const hasValidPhoto = profilePhoto && typeof profilePhoto === 'string' && profilePhoto.trim() !== '' && !imageError;
  const initials = ownerContact ? getInitials(ownerContact) : (user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U");
  const displayName = ownerContact ? getDisplayName(ownerContact) : (user?.displayName || "User");

  return (
    <div className="py-4 border-t border-theme-light flex items-center justify-start xl:justify-center">
      {/* Mobile version - photo, name, and sign out button on same row */}
      <div className="xl:hidden w-full flex items-center justify-between px-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
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
          <span className="text-foreground font-medium text-sm truncate">
            {displayName}
          </span>
        </div>
        {/* Sign out button for mobile */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSignOut();
          }}
          disabled={signingOut || isSaving}
          className="flex items-center gap-2 px-3 py-2 text-sm text-error-red-text hover:bg-card-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-sm shrink-0"
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
          <span className="hidden sm:inline">{signingOut ? "Signing out..." : "Sign out"}</span>
        </button>
      </div>

      {/* Desktop version with popover menu */}
      <div className="relative w-full hidden xl:block" ref={menuRef}>
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

              {/* Start Tour */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  startTour("fromHere");
                }}
                disabled={isSaving}
                className="w-full text-left px-4 py-2 flex items-center gap-3 text-sm text-foreground hover:bg-selected-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                <span>Start tour</span>
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

