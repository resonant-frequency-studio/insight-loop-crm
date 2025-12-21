"use client";

import { notFound } from "next/navigation";
import { useContactRealtime } from "@/hooks/useContactRealtime";
import { useActionItemsForContactRealtime } from "@/hooks/useActionItemsForContactRealtime";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useEffect, useRef } from "react";
import { convertTimestampToISO } from "@/util/timestamp-utils-server";
import ContactDetailPageClient from "../ContactDetailPageClient";
import { ActionItem } from "@/types/firestore";

interface ContactDetailPageClientWrapperProps {
  contactId: string;
}

export default function ContactDetailPageClientWrapper({
  contactId,
}: ContactDetailPageClientWrapperProps) {
  const { user, loading: authLoading } = useAuth();
  
  // Get userId from auth (no longer passed as prop from SSR)
  // For Firebase listeners, null is acceptable - the hook will handle it
  const userId = !authLoading && user?.uid ? user.uid : null;
  
  // Use Firebase real-time listeners
  const { contact, loading: contactLoading, error: contactError } = useContactRealtime(userId, contactId);
  const { actionItems = [], loading: actionItemsLoading } = useActionItemsForContactRealtime(userId, contactId);
  const { contacts } = useContactsRealtime(userId);
  
  // Calculate unique segments client-side from contacts
  const uniqueSegments = useMemo(() => {
    const segments = new Set<string>();
    contacts.forEach((contact) => {
      if (contact.segment?.trim()) {
        segments.add(contact.segment.trim());
      }
    });
    return Array.from(segments).sort();
  }, [contacts]);

  // Track if we've ever had userId/contactId available (to ensure we've attempted a load)
  // Track the previous loading state to detect when loading completes
  const hasHadValidParamsRef = useRef(false);
  const prevLoadingRef = useRef<boolean | undefined>(undefined);
  const hasCompletedLoadRef = useRef(false);
  const notFoundCalledRef = useRef(false);
  
  useEffect(() => {
    // Mark that we've had valid params at least once
    if (userId && contactId && !hasHadValidParamsRef.current) {
      hasHadValidParamsRef.current = true;
    }
    
    // Track when loading transitions from true to false (load completed)
    if (userId && contactId) {
      // If loading was true and now it's false, we've completed a load
      if (prevLoadingRef.current === true && contactLoading === false) {
        hasCompletedLoadRef.current = true;
      }
      prevLoadingRef.current = contactLoading;
    } else {
      // Reset when userId or contactId is not available
      if (!userId || !contactId) {
        prevLoadingRef.current = undefined;
        hasCompletedLoadRef.current = false;
        notFoundCalledRef.current = false;
      }
    }
    
    // Check for notFound after we've completed at least one load attempt
    // Only call notFound if:
    // 1. We haven't called it yet
    // 2. Auth has finished loading
    // 3. We have a userId and contactId (current)
    // 4. We've had valid params at least once (ensures hook has started)
    // 5. We've completed at least one load attempt (loading went from true to false)
    // 6. Contact loading is currently false (not in progress)
    // 7. Contact is null (not found)
    // 8. No error occurred (errors might be temporary/permissions issues)
    if (
      !notFoundCalledRef.current &&
      !authLoading &&
      userId &&
      contactId &&
      hasHadValidParamsRef.current &&
      hasCompletedLoadRef.current &&
      !contactLoading &&
      contact === null &&
      !contactError
    ) {
      notFoundCalledRef.current = true;
      notFound();
    }
  }, [contact, authLoading, userId, contactLoading, contactId, contactError]);
  
  // Action items timestamp conversion (safety check)
  // Memoize to prevent infinite loops from changing object references
  const serializedActionItems: ActionItem[] = useMemo(() => {
    return actionItems.map((item) => ({
      ...item,
      dueDate: convertTimestampToISO(item.dueDate),
      completedAt: convertTimestampToISO(item.completedAt),
      createdAt: convertTimestampToISO(item.createdAt) || new Date().toISOString(),
      updatedAt: convertTimestampToISO(item.updatedAt) || new Date().toISOString(),
    }));
  }, [actionItems]);

  // Show loading state if auth is loading or data is loading
  if (authLoading || contactLoading || actionItemsLoading || !userId) {
    // Return a minimal loading state instead of null to prevent unmounting
    return <div style={{ display: 'none' }} />;
  }

  return (
    <ContactDetailPageClient
      contactDocumentId={contactId}
      userId={userId || ""}
      contact={contact}
      actionItems={serializedActionItems}
      uniqueSegments={uniqueSegments}
    />
  );
}

