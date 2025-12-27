"use client";

import Link from "next/link";
import Image from "next/image";
import HamburgerMenu from "./HamburgerMenu";
import { appConfig } from "@/lib/app-config";

interface MobileHeaderProps {
  isMenuOpen: boolean;
  onMenuToggle: () => void;
}

// Placeholder logo component (same as in CrmLayoutWrapper)
function PlaceholderLogo() {
  return (
    <div className="w-8 h-8 bg-theme-light rounded-md flex items-center justify-center">
      <svg
        className="w-5 h-5 text-theme-dark"
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

// Logo component for mobile header
function MobileLogo() {
  const logoUrl = appConfig.logoUrl;

  if (logoUrl) {
    return (
      <div className="w-8 h-8 relative shrink-0">
        <Image
          src={logoUrl}
          alt={appConfig.crmName}
          width={32}
          height={32}
          className="object-contain w-full h-full"
          unoptimized
        />
      </div>
    );
  }

  return <PlaceholderLogo />;
}

export default function MobileHeader({ isMenuOpen, onMenuToggle }: MobileHeaderProps) {
  return (
    <header className="xl:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b border-theme-medium z-50 flex items-center justify-between px-4">
      {/* Logo - Link to Dashboard */}
      <Link
        href="/"
        className="flex items-center hover:opacity-80 transition-opacity"
        aria-label={appConfig.crmName}
      >
        <MobileLogo />
      </Link>
      {/* Hamburger Menu inside header - positioned on the right */}
      <HamburgerMenu isOpen={isMenuOpen} onClick={onMenuToggle} />
    </header>
  );
}

