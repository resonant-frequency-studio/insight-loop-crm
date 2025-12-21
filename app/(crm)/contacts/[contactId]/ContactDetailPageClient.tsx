"use client";

import ContactEditor from "../../_components/ContactEditor";
import ContactsLink from "../../_components/ContactsLink";
import ContactDetailMenu from "../../_components/ContactDetailMenu";
import ContactSaveBar from "@/components/contacts/ContactSaveBar";
import { ContactAutosaveProvider } from "@/components/contacts/ContactAutosaveProvider";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { ActionItem, Contact } from "@/types/firestore";
import Skeleton from "@/components/Skeleton";

interface ContactDetailPageClientProps {
  contactDocumentId: string;
  userId: string;
  contact: Contact | null;
  actionItems: ActionItem[];
  uniqueSegments?: string[];
}

function ContactDetailContent({
  contactDocumentId,
  userId,
  contact,
  actionItems,
  uniqueSegments,
}: {
  contactDocumentId: string;
  userId: string;
  contact: Contact | null;
  actionItems: ActionItem[];
  uniqueSegments?: string[];
}) {
  if (!contact) {
    return (
      <div className="space-y-6">
        <Skeleton height="h-20" width="w-full" />
        <Skeleton height="h-96" width="w-full" />
      </div>
    );
  }

  return (
    <>
      {/* Header Section - Static structure, dynamic data */}
      <div className="flex flex-col gap-4">
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
          <div className="hidden xl:flex xl:items-center xl:gap-3">
            <ContactsLink variant="default" />
            <ContactDetailMenu contactId={contactDocumentId} userId={userId} />
          </div>
        </div>
        {/* Mobile: Save bar below header */}
        <div className="xl:hidden flex items-center justify-end">
          <ContactSaveBar />
        </div>
      </div>

      {/* Contact Editor */}
      <ContactEditor
        contactDocumentId={contactDocumentId}
        userId={userId}
        initialActionItems={actionItems}
        uniqueSegments={uniqueSegments || []}
      />
    </>
  );
}

export default function ContactDetailPageClient({
  contactDocumentId,
  userId,
  contact,
  actionItems,
  uniqueSegments,
}: ContactDetailPageClientProps) {
  return (
    <ContactAutosaveProvider>
      <div className="space-y-6">
        {/* Back Button and Menu - Mobile: top, Desktop: in header - Static, renders immediately */}
        <div className="xl:hidden flex items-center justify-between">
          <ContactsLink variant="default" />
          <ContactDetailMenu contactId={contactDocumentId} userId={userId} />
        </div>

        {/* Contact Data - Data comes from props (no suspense needed for real-time data) */}
        {contact ? (
          <ContactDetailContent
            contactDocumentId={contactDocumentId}
            userId={userId}
            contact={contact}
            actionItems={actionItems}
            uniqueSegments={uniqueSegments || []}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-theme-light rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 bg-theme-light rounded w-48 animate-pulse" />
                <div className="h-5 bg-theme-light rounded w-64 animate-pulse" />
              </div>
            </div>
            <div className="h-96 bg-theme-light rounded animate-pulse" />
          </div>
        )}
      </div>
    </ContactAutosaveProvider>
  );
}

