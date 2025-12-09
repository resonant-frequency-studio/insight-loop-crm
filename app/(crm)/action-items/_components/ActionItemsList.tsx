import { getUserId } from "@/lib/auth-utils";
import { getAllActionItemsForUser } from "@/lib/action-items";
import { getAllContactsForUser } from "@/lib/contacts-server";
import { getQueryClient } from "@/lib/query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { isPlaywrightTest } from "@/util/test-utils";
import ActionItemsPageClientWrapper from "./ActionItemsPageClientWrapper";


export default async function ActionItemsList() {
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
  if (userId) {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["action-items", userId],
        queryFn: () => getAllActionItemsForUser(userId!),
      }),
      queryClient.prefetchQuery({
        queryKey: ["contacts", userId],
        queryFn: () => getAllContactsForUser(userId!),
      }),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ActionItemsPageClientWrapper userId={userId || ""} />
    </HydrationBoundary>
  );
}

