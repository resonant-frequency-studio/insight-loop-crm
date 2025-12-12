"use client";

import Link from "next/link";
import HamburgerMenu from "./HamburgerMenu";
import { appConfig } from "@/lib/app-config";

interface MobileHeaderProps {
  isMenuOpen: boolean;
  onMenuToggle: () => void;
}

export default function MobileHeader({ isMenuOpen, onMenuToggle }: MobileHeaderProps) {
  return (
    <header className="xl:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b border-theme-medium z-50 flex items-center justify-between px-4">
      {/* CRM Name - Link to Dashboard */}
      <Link
        href="/"
        className="text-sm font-semibold text-theme-darkest hover:text-theme-darker transition-colors truncate max-w-[calc(100%-4rem)]"
      >
        {appConfig.crmName}
      </Link>
      {/* Hamburger Menu inside header - positioned on the right */}
      <HamburgerMenu isOpen={isMenuOpen} onClick={onMenuToggle} />
    </header>
  );
}

