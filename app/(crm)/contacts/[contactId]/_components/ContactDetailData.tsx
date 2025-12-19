import { notFound } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { getContactForUser, getUniqueSegmentsForUser, getAllContactsForUserUncached } from "@/lib/contacts-server";
import { getActionItemsForContact } from "@/lib/action-items";
import { getQueryClient } from "@/lib/query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { isPlaywrightTest } from "@/util/test-utils";
import ContactDetailPageClientWrapper from "./ContactDetailPageClientWrapper";

interface ContactDetailDataProps {
  contactId: string;
}

export default async function ContactDetailData({ contactId }: ContactDetailDataProps) {
  // In E2E mode, try to get userId but don't fail if cookie isn't ready yet
  let userId: string | null = null;
  const decodedContactId = decodeURIComponent(contactId);
  const queryClient = getQueryClient();

  if (isPlaywrightTest()) {
    try {
      userId = await getUserId();
    } catch {
      // In E2E mode, cookie might not be recognized by SSR yet
      userId = null;
    }
  } else {
    userId = await getUserId();
  }

  // Only prefetch and check if we have userId
  if (userId) {
    // Check if contact exists first (for notFound) - this is critical path
    const contact = await getContactForUser(userId, decodedContactId);
    if (!contact) {
      // In E2E mode, don't call notFound() immediately - let client-side handle it
      // This allows tests to create contacts and immediately navigate to them
      if (!isPlaywrightTest()) {
        notFound();
      }
      // In E2E mode, continue - the client-side component will fetch and handle notFound if needed
    }

    // Prefetch in background - don't block navigation
    // Use Promise.allSettled to not block on failures
    Promise.allSettled([
      // Prefetch contact
      queryClient.prefetchQuery({
        queryKey: ["contact", userId, decodedContactId],
        queryFn: () => getContactForUser(userId!, decodedContactId),
      }),
      // Prefetch action items
      queryClient.prefetchQuery({
        queryKey: ["action-items", userId, decodedContactId],
        queryFn: () => getActionItemsForContact(userId!, decodedContactId).catch(() => []),
      }),
      // Prefetch contacts list (using uncached version to avoid Next.js cache size limits)
      queryClient.prefetchQuery({
        queryKey: ["contacts", userId],
        queryFn: () => getAllContactsForUserUncached(userId!),
      }),
      // Prefetch unique segments
      queryClient.prefetchQuery({
        queryKey: ["unique-segments", userId],
        queryFn: () => getUniqueSegmentsForUser(userId!).catch(() => []),
      }),
    ]).catch(() => {
      // Silently handle errors - client will fetch on mount
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContactDetailPageClientWrapper
        contactId={decodedContactId}
        userId={userId || ""}
      />
    </HydrationBoundary>
  );
}

