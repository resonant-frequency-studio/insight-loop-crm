"use client";

import { useSyncJobs } from "@/hooks/useSyncJobs";
import { SyncJob } from "@/types/firestore";
import SyncPageClient from "../SyncPageClient";

export default function SyncPageClientWrapper({ userId }: { userId: string }) {
  // React Query automatically uses prefetched data from HydrationBoundary
  const { data: lastSyncData } = useSyncJobs(userId, false);
  const { data: syncHistoryData } = useSyncJobs(userId, true);

  // Type guard to ensure lastSync is a single SyncJob, not an array
  const lastSync = Array.isArray(lastSyncData) ? null : (lastSyncData as SyncJob | null);
  const syncHistory = Array.isArray(syncHistoryData) ? (syncHistoryData as SyncJob[]) : [];

  return (
    <SyncPageClient
      userId={userId}
      initialLastSync={lastSync}
      initialSyncHistory={syncHistory}
    />
  );
}

