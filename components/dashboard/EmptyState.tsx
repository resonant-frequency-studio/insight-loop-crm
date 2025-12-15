"use client";

import Link from "next/link";
import Card from "@/components/Card";
import { Button } from "@/components/Button";

interface EmptyStateProps {
  message?: string;
  description?: string;
  showActions?: boolean;
  wrapInCard?: boolean;
  size?: "sm" | "lg";
  className?: string;
}

export default function EmptyState({
  message = "No contacts yet",
  description = "Get started by importing your contacts or adding your first contact",
  showActions = true,
  wrapInCard = false,
  size = "sm",
  className = "",
}: EmptyStateProps) {
  const iconSize = size === "lg" ? "w-16 h-16" : "w-12 h-12";
  const headingSize = size === "lg" ? "text-lg font-semibold" : "text-sm font-medium";
  const padding = size === "lg" ? "xl" : "md";
  const iconMargin = size === "lg" ? "mb-4" : "mb-3";
  const textMargin = size === "lg" ? "mb-2" : "mb-1";
  const descriptionMargin = size === "lg" ? "mb-6" : "mb-4";
  const buttonGap = size === "lg" ? "gap-3" : "gap-2";

  const content = (
    <>
      <svg
        className={`${iconSize} mx-auto ${iconMargin} text-gray-300`}
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
      <p className={`${headingSize} text-theme-darkest ${textMargin}`}>{message}</p>
      {description && (
        <p className={`text-xs text-gray-500 ${descriptionMargin}`}>{description}</p>
      )}
      {showActions && (
        <div className={`flex flex-col sm:flex-row ${buttonGap} justify-center`}>
          <Link href="/contacts/import">
            <Button size="sm">
              {size === "lg" && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
              Import Contacts
            </Button>
          </Link>
          <Link href="/contacts/new">
            <Button variant="outline" size="sm">
              {size === "lg" && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              )}
              Add Contact
            </Button>
          </Link>
        </div>
      )}
    </>
  );

  if (wrapInCard) {
    return (
      <Card padding={padding} className={`text-center ${className}`}>
        {content}
      </Card>
    );
  }

  return (
    <div className={`text-center ${size === "lg" ? "py-0" : "py-6"} ${className}`}>
      {content}
    </div>
  );
}

