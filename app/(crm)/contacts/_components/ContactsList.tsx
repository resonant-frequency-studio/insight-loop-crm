import { getUserId } from "@/lib/auth-utils";
import { getAllContactsForUser } from "@/lib/contacts-server";
import { getQueryClient } from "@/lib/query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { isPlaywrightTest } from "@/util/test-utils";
import ContactsPageClientWrapper from "./ContactsPageClientWrapper";

export default async function ContactsList() {
  // In E2E mode, try to get userId but don't fail if cookie isn't ready yet
  let userId: string | null = null;
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

  // Only prefetch if we have userId
  // Don't block navigation - prefetch in background
  if (userId) {
    Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["contacts", userId],
        queryFn: () => getAllContactsForUser(userId!),
      }),
    ]).catch(() => {
      // Silently handle errors - client will fetch on mount
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContactsPageClientWrapper userId={userId || ""} />
    </HydrationBoundary>
  );
}

