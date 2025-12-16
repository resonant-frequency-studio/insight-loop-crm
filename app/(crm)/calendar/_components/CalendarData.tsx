import { getUserId } from "@/lib/auth-utils";
import { getCalendarEventsForUser } from "@/lib/calendar/get-calendar-events-server";
import { getQueryClient } from "@/lib/query-client";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { isPlaywrightTest } from "@/util/test-utils";
import { adminDb } from "@/lib/firebase-admin";
import CalendarPageClientWrapper from "./CalendarPageClientWrapper";

export default async function CalendarData() {
  // In E2E mode, try to get userId but don't fail if cookie isn't ready yet
  let userId: string = "";
  const queryClient = getQueryClient();

  if (isPlaywrightTest()) {
    try {
      userId = await getUserId();
    } catch {
      // In E2E mode, cookie might not be recognized by SSR yet
      userId = "";
    }
  } else {
    userId = await getUserId();
  }

  // Only prefetch if we have userId
  if (userId) {
    // Prefetch events for current month
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), 1);
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await queryClient.prefetchQuery({
      queryKey: ["calendar-events", userId, timeMin.toISOString(), timeMax.toISOString()],
      queryFn: async () => {
        // Try to get from cache first
        const cachedEvents = await getCalendarEventsForUser(
          adminDb,
          userId,
          timeMin,
          timeMax
        );
        return cachedEvents;
      },
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CalendarPageClientWrapper userId={userId} />
    </HydrationBoundary>
  );
}

