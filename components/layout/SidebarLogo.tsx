import Image from "next/image";
import { appConfig } from "@/lib/app-config";

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
export function SidebarLogo({ isCollapsed }: { isCollapsed: boolean }) {
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

