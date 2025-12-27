"use client";

import { useState } from "react";
import { Contact } from "@/types/firestore";
import { getInitials } from "@/util/contact-utils";
import Image from "next/image";

interface AvatarProps {
  contact?: Contact;
  // Alternative props when contact object is not available
  photoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmail?: string;
  initials?: string; // Pre-computed initials (optional)
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-2xl",
};

const sizePixels = {
  sm: "32px",
  md: "40px",
  lg: "48px",
  xl: "64px",
};

export default function Avatar({ 
  contact,
  photoUrl: photoUrlProp,
  firstName: firstNameProp,
  lastName: lastNameProp,
  primaryEmail: primaryEmailProp,
  initials: initialsProp,
  size = "md", 
  className = "" 
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const sizeClass = sizeClasses[size];
  
  // Use contact object if provided, otherwise use individual props
  const photoUrl = contact?.photoUrl || photoUrlProp;
  const firstName = contact?.firstName || firstNameProp;
  const lastName = contact?.lastName || lastNameProp;
  const primaryEmail = contact?.primaryEmail || primaryEmailProp;
  
  // Get initials - use pre-computed if provided, otherwise compute from contact or props
  let initials: string;
  if (initialsProp) {
    initials = initialsProp;
  } else if (contact) {
    initials = getInitials(contact);
  } else {
    // Compute from props
    if (firstName && lastName) {
      initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      initials = firstName[0].toUpperCase();
    } else if (primaryEmail) {
      initials = primaryEmail[0].toUpperCase();
    } else {
      initials = "?";
    }
  }
  
  const hasPhoto = photoUrl && photoUrl.trim() !== "" && !imageError;
  const displayName = `${firstName || ""} ${lastName || ""}`.trim() || primaryEmail || "";

  if (hasPhoto) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden shrink-0 relative ${className}`}>
        <Image
          src={photoUrl!}
          alt={displayName}
          fill
          sizes={sizePixels[size]}
          className="object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-semibold shadow-sm bg-linear-to-br from-blue-500 to-purple-600 ${className}`}>
      {initials}
    </div>
  );
}

