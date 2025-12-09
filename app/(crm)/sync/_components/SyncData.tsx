import { getUserId } from "@/lib/auth-utils";
import { getLastSyncForUser, getSyncHistoryForUser } from "@/lib/sync-jobs-server";
import { getQueryClient } from "@/lib/query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { isPlaywrightTest } from "@/util/test-utils";
import SyncPageClientWrapper from "./SyncPageClientWrapper";

export default async function SyncData() {
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
        queryKey: ["sync-jobs", userId, "last"],
        queryFn: () => getLastSyncForUser(userId!).catch(() => null),
      }),
      queryClient.prefetchQuery({
        queryKey: ["sync-jobs", userId, "history"],
        queryFn: () => getSyncHistoryForUser(userId!, 10).catch(() => []),
      }),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SyncPageClientWrapper userId={userId || ""} />
    </HydrationBoundary>
  );
}

