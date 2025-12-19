import { getUserId } from "@/lib/auth-utils";
import { getAllActionItemsForUser } from "@/lib/action-items";
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
  // Note: Action items are now enriched with contact fields, so we don't need to prefetch contacts separately
  // Don't block navigation - prefetch in background
  if (userId) {
    Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["action-items", userId],
        queryFn: () => getAllActionItemsForUser(userId!),
      }),
    ]).catch(() => {
      // Silently handle errors - client will fetch on mount
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ActionItemsPageClientWrapper userId={userId || ""} />
    </HydrationBoundary>
  );
}

