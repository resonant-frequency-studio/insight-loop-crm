"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { SyncJob } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";
import { getUIMode } from "@/lib/ui-mode";

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
  const uiMode = getUIMode();

  useEffect(() => {
    if (!userId) {
      // Defer setState to avoid cascading renders
      queueMicrotask(() => {
        setLoading(false);
      });
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
          reportException(err, {
            context: "Fetching last sync",
            tags: { component: "useSyncStatus" },
          });
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
          reportException(err, {
            context: "Fetching sync history",
            tags: { component: "useSyncStatus" },
          });
        }
      );

      return () => {
        unsubscribeLast();
        unsubscribeHistory();
      };
    } catch (err) {
      reportException(err, {
        context: "Setting up sync status",
        tags: { component: "useSyncStatus" },
      });
      // Defer setState to avoid cascading renders
      queueMicrotask(() => {
        setError("Failed to initialize sync status");
        setLoading(false);
      });
    }
  }, [userId]);

  // Override return values based on UI mode
  return useMemo(() => {
    if (uiMode === "suspense") {
      return { lastSync: null, syncHistory: [], loading: true, error: null };
    }
    if (uiMode === "empty") {
      return { lastSync: null, syncHistory: [], loading: false, error: null };
    }
    return { lastSync, syncHistory, loading, error };
  }, [lastSync, syncHistory, loading, error, uiMode]);
}

