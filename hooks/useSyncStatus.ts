"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { SyncJob } from "@/types/firestore";

interface UseSyncStatusReturn {
  lastSync: SyncJob | null;
  syncHistory: SyncJob[];
  loading: boolean;
  error: string | null;
}

export function useSyncStatus(userId: string | null): UseSyncStatusReturn {
  const [lastSync, setLastSync] = useState<SyncJob | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Get last sync (most recent)
      const lastSyncQuery = query(
        collection(db, `users/${userId}/syncJobs`),
        orderBy("startedAt", "desc"),
        limit(1)
      );

      const unsubscribeLast = onSnapshot(
        lastSyncQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            setLastSync({ ...(doc.data() as SyncJob), syncJobId: doc.id });
          } else {
            setLastSync(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error("Error fetching last sync:", err);
          setError("Failed to load sync status");
          setLoading(false);
        }
      );

      // Get sync history (last 10)
      const historyQuery = query(
        collection(db, `users/${userId}/syncJobs`),
        orderBy("startedAt", "desc"),
        limit(10)
      );

      const unsubscribeHistory = onSnapshot(
        historyQuery,
        (snapshot) => {
          const history = snapshot.docs.map((doc) => ({
            ...(doc.data() as SyncJob),
            syncJobId: doc.id,
          }));
          setSyncHistory(history);
        },
        (err) => {
          console.error("Error fetching sync history:", err);
        }
      );

      return () => {
        unsubscribeLast();
        unsubscribeHistory();
      };
    } catch (err) {
      console.error("Error setting up sync status:", err);
      setError("Failed to initialize sync status");
      setLoading(false);
    }
  }, [userId]);

  return { lastSync, syncHistory, loading, error };
}

