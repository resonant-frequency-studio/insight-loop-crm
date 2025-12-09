"use client";

import { notFound } from "next/navigation";
import { useContact } from "@/hooks/useContact";
import { useActionItems } from "@/hooks/useActionItems";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { convertTimestampToISO } from "@/util/timestamp-utils-server";
import ContactDetailPageClient from "../ContactDetailPageClient";
import { ActionItem } from "@/types/firestore";

interface ContactDetailPageClientWrapperProps {
  contactId: string;
  userId: string;
}

export default function ContactDetailPageClientWrapper({
  contactId,
  userId,
}: ContactDetailPageClientWrapperProps) {
  const { user, loading: authLoading } = useAuth();
  // Use userId prop if provided (from SSR), otherwise get from client auth (for E2E mode or if SSR didn't have it)
  // In production, userId prop should always be provided from SSR
  // In E2E mode, it might be empty, so we wait for auth to load and use user?.uid
  const effectiveUserId = userId || (authLoading ? "" : user?.uid || "");
  // React Query automatically uses prefetched data from HydrationBoundary
  const { data: contact } = useContact(effectiveUserId, contactId);
  const { data: actionItems = [] } = useActionItems(effectiveUserId, contactId);
  const { data: uniqueSegments = [] } = useQuery({
    queryKey: ["unique-segments", effectiveUserId],
    queryFn: async () => {
      // For now, we'll fetch all contacts and extract unique segments
      // TODO: Create an API route for this if needed
      const response = await fetch("/api/contacts");
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      const contacts = data.contacts || [];
      const segments = new Set<string>();
      contacts.forEach((contact: { segment?: string | null }) => {
        if (contact.segment?.trim()) {
          segments.add(contact.segment.trim());
        }
      });
      return Array.from(segments).sort();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!contact) {
    notFound();
  }

  // Action items are already converted to ISO strings on the server
  // This is just a safety check in case any timestamps slipped through
  const serializedActionItems: ActionItem[] = actionItems.map((item) => ({
    ...item,
    dueDate: convertTimestampToISO(item.dueDate),
    completedAt: convertTimestampToISO(item.completedAt),
    createdAt: convertTimestampToISO(item.createdAt) || new Date().toISOString(),
    updatedAt: convertTimestampToISO(item.updatedAt) || new Date().toISOString(),
  }));

  return (
    <ContactDetailPageClient
      contactDocumentId={contactId}
      userId={userId}
      initialActionItems={serializedActionItems}
      uniqueSegments={uniqueSegments}
    />
  );
}

