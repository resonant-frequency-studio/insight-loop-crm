"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { SyncJob } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseContactsSyncJobReturn {
  syncJob: SyncJob | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to track a specific contacts sync job by ID
 * Uses Firestore real-time listener to get progress updates
 */
export function useContactsSyncJob(
  userId: string | null,
  syncJobId: string | null
): UseContactsSyncJobReturn {
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !syncJobId) {
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setLoading(false);
        setSyncJob(null);
      });
      return;
    }

    try {
      const docRef = doc(db, `users/${userId}/syncJobs/${syncJobId}`);

      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as SyncJob;
            setSyncJob({
              ...data,
              syncJobId: snapshot.id,
            });
          } else {
            setSyncJob(null);
          }
          setLoading(false);
        },
        (err) => {
          reportException(err, {
            context: "Fetching contacts sync job",
            tags: { component: "useContactsSyncJob", userId, syncJobId },
          });
          setError("Failed to load sync job status");
          setLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (err) {
      reportException(err, {
        context: "Setting up contacts sync job listener",
        tags: { component: "useContactsSyncJob", userId, syncJobId },
      });
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setError("Failed to initialize sync job listener");
        setLoading(false);
      });
    }
  }, [userId, syncJobId]);

  return { syncJob, loading, error };
}

