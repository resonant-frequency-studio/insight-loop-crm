"use client";

import { useState } from "react";
import Image from "next/image";
import { useOwnerContact } from "@/hooks/useOwnerContact";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import type { User } from "firebase/auth";

interface UserAvatarProps {
  user: User | null;
  size?: number;
  className?: string;
}

export function UserAvatar({ user, size = 40, className = "" }: UserAvatarProps) {
  const { ownerContact } = useOwnerContact();
  const [imageError, setImageError] = useState(false);

  const profilePhoto = ownerContact?.photoUrl;
  const hasValidPhoto = profilePhoto && typeof profilePhoto === 'string' && profilePhoto.trim() !== '' && !imageError;
  const initials = ownerContact ? getInitials(ownerContact) : (user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U");
  const displayName = ownerContact ? getDisplayName(ownerContact) : (user?.displayName || "User");

  const sizeClass = size === 32 ? "w-8 h-8" : size === 40 ? "w-10 h-10" : "w-10 h-10";

  if (hasValidPhoto) {
    return (
      <Image
        key={profilePhoto}
        src={profilePhoto}
        alt={displayName}
        width={size}
        height={size}
        sizes={`${size}px`}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
        onError={() => setImageError(true)}
        onLoad={() => setImageError(false)}
        unoptimized
      />
    );
  }

  return (
    <div className={`${sizeClass} bg-theme-light rounded-full flex items-center justify-center shrink-0 ${className}`}>
      <span className="text-foreground font-semibold text-sm">
        {initials}
      </span>
    </div>
  );
}

