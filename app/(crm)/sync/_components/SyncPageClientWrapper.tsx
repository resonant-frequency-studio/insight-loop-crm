"use client";

import { useSyncJobs } from "@/hooks/useSyncJobs";
import { useAuth } from "@/hooks/useAuth";
import { SyncJob } from "@/types/firestore";
import SyncPageClient from "../SyncPageClient";

export default function SyncPageClientWrapper({ userId }: { userId: string }) {
  const { user, loading: authLoading } = useAuth();
  // Use userId prop if provided (from SSR), otherwise get from client auth (for E2E mode or if SSR didn't have it)
  // In production, userId prop should always be provided from SSR
  // In E2E mode, it might be empty, so we wait for auth to load and use user?.uid
  const effectiveUserId = userId || (authLoading ? "" : user?.uid || "");
  // React Query automatically uses prefetched data from HydrationBoundary
  const { data: lastSyncData } = useSyncJobs(effectiveUserId, false);
  const { data: syncHistoryData } = useSyncJobs(effectiveUserId, true);

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

