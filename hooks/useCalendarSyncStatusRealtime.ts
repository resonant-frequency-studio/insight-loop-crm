"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { SyncJob } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseCalendarSyncStatusRealtimeReturn {
  lastSync: SyncJob | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch the latest calendar sync job status using Firebase real-time listener
 * Updates automatically when sync jobs change in Firestore
 * 
 * @param userId - The user ID
 * 
 * @requires Firestore composite index on:
 * - Collection: `users/{userId}/syncJobs`
 * - Fields: `service` (Ascending), `startedAt` (Descending)
 * 
 * Firebase will automatically prompt to create this index when the query first runs,
 * or you can create it manually in Firebase Console.
 */
export function useCalendarSyncStatusRealtime(userId: string | null): UseCalendarSyncStatusRealtimeReturn {
  const [lastSync, setLastSync] = useState<SyncJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      // Defer setState to avoid cascading renders
      queueMicrotask(() => {
        setLoading(false);
        setLastSync(null);
      });
      return;
    }

    let isMounted = true;

    try {
      // Query sync jobs filtered by service: "calendar", ordered by startedAt desc, limit 1
      const syncStatusQuery = query(
        collection(db, `users/${userId}/syncJobs`),
        where("service", "==", "calendar"),
        orderBy("startedAt", "desc"),
        limit(1)
      );

      const unsubscribe = onSnapshot(
        syncStatusQuery,
        (snapshot) => {
          if (!isMounted) return;

          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            setLastSync({ ...(doc.data() as SyncJob), syncJobId: doc.id });
          } else {
            setLastSync(null);
          }
          setLoading(false);
          setError(null);
        },
        (err) => {
          if (!isMounted) return;

          // Check if this is an index error and extract the creation link
          const errorMessage = err instanceof Error ? err.message : String(err);
          const indexErrorMatch = errorMessage.match(/You can create it here: (https:\/\/[^\s]+)/);
          
          if (indexErrorMatch) {
            // This is an index error - create a more helpful error message
            const indexUrl = indexErrorMatch[1];
            const helpfulError = new Error(
              `Firestore index required for calendar sync status. Click here to create it: ${indexUrl}`
            );
            reportException(helpfulError, {
              context: "Fetching calendar sync status (real-time) - index required",
              tags: { component: "useCalendarSyncStatusRealtime", userId, indexUrl },
            });
            setError(helpfulError);
          } else {
            reportException(err, {
              context: "Fetching calendar sync status (real-time)",
              tags: { component: "useCalendarSyncStatusRealtime", userId },
            });
            setError(err);
          }
          
          setLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      if (!isMounted) return;

      const error = err instanceof Error ? err : new Error(String(err));
      reportException(error, {
        context: "Setting up calendar sync status listener",
        tags: { component: "useCalendarSyncStatusRealtime", userId },
      });

      // Defer setState to avoid cascading renders
      queueMicrotask(() => {
        if (isMounted) {
          setError(error);
          setLoading(false);
        }
      });
    }
  }, [userId]);

  return { lastSync, loading, error };
}

