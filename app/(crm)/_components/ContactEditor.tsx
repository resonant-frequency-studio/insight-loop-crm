"use client";

import { useEffect } from "react";
import { useContact } from "@/hooks/useContact";
import { useAuth } from "@/hooks/useAuth";
import Skeleton from "@/components/Skeleton";
import BasicInfoCard from "./contact-cards/BasicInfoCard";
import TagsClassificationCard from "./contact-cards/TagsClassificationCard";
import ActionItemsCard from "./contact-cards/ActionItemsCard";
import NotesCard from "./contact-cards/NotesCard";
import NextTouchpointCard from "./contact-cards/NextTouchpointCard";
import OutreachDraftCard from "./contact-cards/OutreachDraftCard";
import ContactInsightsCard from "./contact-cards/ContactInsightsCard";
import ActivityCard from "./contact-cards/ActivityCard";
import ContactTimelineCard from "./contact-cards/ContactTimelineCard";
import { useContactAutosave } from "@/components/contacts/ContactAutosaveProvider";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import { isOwnerContact } from "@/lib/contacts/owner-utils";

interface ContactEditorProps {
  contactDocumentId: string;
  userId: string;
  // Pre-fetched data (for SSR)
  initialActionItems?: import("@/types/firestore").ActionItem[];
  initialContact?: import("@/types/firestore").Contact;
  uniqueSegments?: string[];
}

function ContactEditorContent({
  contactDocumentId,
  userId,
  initialActionItems,
  initialContact,
  uniqueSegments = [],
}: ContactEditorProps) {
  // Read contact directly from React Query cache for optimistic updates
  const { data: contact } = useContact(userId, contactDocumentId);
  const { user } = useAuth();
  
  // Check if this is the owner contact
  const isOwner = contact?.primaryEmail && user?.email
    ? isOwnerContact(user.email, contact.primaryEmail)
    : false;
  
  // Initialize autosave hook (must be inside provider)
  useDebouncedAutosave();
  
  // Browser unload guard
  const { hasUnsavedChanges, pendingCount, lastError } = useContactAutosave();
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0 || hasUnsavedChanges || lastError) {
        e.preventDefault();
        e.returnValue = "Changes are still saving. Please wait.";
        return "Changes are still saving. Please wait.";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, pendingCount, lastError]);

  // Show loading state if contact is not available
  if (!contact && !initialContact) {
    return (
      <div className="space-y-6">
        <Skeleton height="h-96" width="w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content - Left Column (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          <BasicInfoCard contactId={contactDocumentId} userId={userId} />
          {!isOwner && (
            <>
              <TagsClassificationCard
                contactId={contactDocumentId}
                userId={userId}
                uniqueSegments={uniqueSegments}
              />
              <ActionItemsCard
                contactId={contactDocumentId}
                userId={userId}
                initialActionItems={initialActionItems}
                initialContact={contact || undefined}
              />
              <NextTouchpointCard contactId={contactDocumentId} userId={userId} />
              <OutreachDraftCard contactId={contactDocumentId} userId={userId} />
            </>
          )}
          <NotesCard contactId={contactDocumentId} userId={userId} />
          {!isOwner && (
            <ContactTimelineCard contactId={contactDocumentId} userId={userId} />
          )}
        </div>

        {/* Sidebar - Right Column (1/3) */}
        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <ContactInsightsCard
            contactId={contactDocumentId}
            userId={userId}
            initialContact={initialContact}
          />
          <ActivityCard contactId={contactDocumentId} userId={userId} />
        </div>
      </div>
    </div>
  );
}

export default function ContactEditor({
  contactDocumentId,
  userId,
  initialActionItems,
  initialContact,
  uniqueSegments = [],
}: ContactEditorProps) {
  return (
    <ContactEditorContent
      contactDocumentId={contactDocumentId}
      userId={userId}
      initialActionItems={initialActionItems}
      initialContact={initialContact}
      uniqueSegments={uniqueSegments}
    />
  );
}
