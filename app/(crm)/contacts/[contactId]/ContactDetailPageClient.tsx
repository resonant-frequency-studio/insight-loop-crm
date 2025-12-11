"use client";

import { Suspense } from "react";
import ContactEditor from "../../_components/ContactEditor";
import ContactsLink from "../../_components/ContactsLink";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { ActionItem } from "@/types/firestore";
import { useContact } from "@/hooks/useContact";
import { useActionItems } from "@/hooks/useActionItems";

interface ContactDetailPageClientProps {
  contactDocumentId: string;
  userId: string;
  initialActionItems?: ActionItem[];
  uniqueSegments?: string[];
}

function ContactDetailContent({
  contactDocumentId,
  userId,
  initialActionItems,
  uniqueSegments,
}: {
  contactDocumentId: string;
  userId: string;
  initialActionItems?: ActionItem[];
  uniqueSegments?: string[];
}) {
  const { data: contact } = useContact(userId, contactDocumentId);
  const { data: actionItems = initialActionItems || [] } = useActionItems(
    userId,
    contactDocumentId,
    initialActionItems
  );

  if (!contact) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-96 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <>
      {/* Header Section - Static structure, dynamic data */}
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-2xl shadow-lg shrink-0">
            {getInitials(contact)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-theme-darkest mb-1 truncate">
              {getDisplayName(contact)}
            </h1>
            <p className="text-gray-500 flex items-center gap-2 min-w-0">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className="truncate">{contact.primaryEmail}</span>
            </p>
          </div>
        </div>
        <div className="hidden xl:block">
          <ContactsLink variant="default" />
        </div>
      </div>

      {/* Contact Editor */}
      <ContactEditor
        contactDocumentId={contactDocumentId}
        userId={userId}
        initialActionItems={actionItems}
        uniqueSegments={uniqueSegments}
      />
    </>
  );
}

export default function ContactDetailPageClient({
  contactDocumentId,
  userId,
  initialActionItems,
  uniqueSegments,
}: ContactDetailPageClientProps) {
  return (
    <div className="space-y-6">
      {/* Back Button - Mobile: top, Desktop: in header - Static, renders immediately */}
      <div className="xl:hidden">
        <ContactsLink variant="default" />
      </div>

      {/* Contact Data - Only dynamic data is suspended */}
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
                <div className="h-5 bg-gray-200 rounded w-64 animate-pulse" />
              </div>
            </div>
            <div className="h-96 bg-gray-200 rounded animate-pulse" />
          </div>
        }
      >
        <ContactDetailContent
          contactDocumentId={contactDocumentId}
          userId={userId}
          initialActionItems={initialActionItems}
          uniqueSegments={uniqueSegments}
        />
      </Suspense>
    </div>
  );
}

