import { getUserId } from "@/lib/auth-utils";
import { getAllContactsForUser } from "@/lib/contacts-server";
import { getDashboardStats } from "@/lib/dashboard-stats-server";
import { getQueryClient } from "@/lib/query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import DashboardPageClient from "../DashboardPageClient";

export default async function DashboardData() {
  const userId = await getUserId();
  const queryClient = getQueryClient();

  // Prefetch data on server
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

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardPageClient userId={userId} />
    </HydrationBoundary>
  );
}

