"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { AdminJob } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseAdminJobReturn {
  adminJob: AdminJob | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to track a specific admin job by ID
 * Uses Firestore real-time listener to get progress updates
 */
export function useAdminJob(
  userId: string | null,
  jobId: string | null
): UseAdminJobReturn {
  const [adminJob, setAdminJob] = useState<AdminJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !jobId) {
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setLoading(false);
        setAdminJob(null);
      });
      return;
    }

    try {
      const docRef = doc(db, `users/${userId}/adminJobs/${jobId}`);

      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AdminJob;
            setAdminJob({
              ...data,
              jobId: snapshot.id,
            });
          } else {
            setAdminJob(null);
          }
          setLoading(false);
        },
        (err) => {
          reportException(err, {
            context: "Fetching admin job",
            tags: { component: "useAdminJob", userId, jobId },
          });
          setError("Failed to load admin job status");
          setLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (err) {
      reportException(err, {
        context: "Setting up admin job listener",
        tags: { component: "useAdminJob", userId, jobId },
      });
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setError("Failed to initialize admin job listener");
        setLoading(false);
      });
    }
  }, [userId, jobId]);

  return { adminJob, loading, error };
}

