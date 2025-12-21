import { getUserId } from "@/lib/auth-utils";
import { isPlaywrightTest } from "@/util/test-utils";
import DashboardPageClientWrapper from "./DashboardPageClientWrapper";

export default async function DashboardData() {
  // In E2E mode, try to get userId but don't fail if cookie isn't ready yet
  // Client-side auth will handle it
  // Note: We no longer prefetch data here - client will use Firebase real-time listeners
  if (!isPlaywrightTest()) {
    try {
      await getUserId();
    } catch {
      // Auth check failed - page-level redirect will handle it
    }
  }

  // Client wrapper will get userId from useAuth and use Firebase real-time listeners
  return <DashboardPageClientWrapper />;
}

