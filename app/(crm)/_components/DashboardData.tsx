import { getUserId } from "@/lib/auth-utils";
import { getAllContactsForUser } from "@/lib/contacts-server";
import { getDashboardStats } from "@/lib/dashboard-stats-server";
import { getQueryClient } from "@/lib/query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { isPlaywrightTest } from "@/util/test-utils";
import DashboardPageClientWrapper from "./DashboardPageClientWrapper";

export default async function DashboardData() {
  // In E2E mode, try to get userId but don't fail if cookie isn't ready yet
  // Client-side auth will handle it
  let userId: string = "";
  const queryClient = getQueryClient();

  if (isPlaywrightTest()) {
    try {
      userId = await getUserId();
    } catch {
      // In E2E mode, cookie might not be recognized by SSR yet
      // Render without prefetch - client will fetch data once auth is ready
      userId = "";
    }
  } else {
    // In production, getUserId should always succeed if user is authenticated
    // If it fails, the page-level redirect will handle it
    userId = await getUserId();
  }

  // Only prefetch if we have userId
  if (userId) {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["contacts", userId],
        queryFn: () => getAllContactsForUser(userId),
      }),
      queryClient.prefetchQuery({
        queryKey: ["dashboard-stats", userId],
        queryFn: () => getDashboardStats(userId),
      }),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* Client wrapper will get userId from useAuth if not provided */}
      <DashboardPageClientWrapper userId={userId} />
    </HydrationBoundary>
  );
}

