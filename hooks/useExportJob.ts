"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { ExportJob } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseExportJobReturn {
  exportJob: ExportJob | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to track a specific export job by ID
 * Uses Firestore real-time listener to get progress updates
 */
export function useExportJob(
  userId: string | null,
  exportJobId: string | null
): UseExportJobReturn {
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !exportJobId) {
      queueMicrotask(() => {
        setLoading(false);
        setExportJob(null);
      });
      return;
    }

    try {
      const docRef = doc(db, `users/${userId}/exportJobs/${exportJobId}`);

      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as ExportJob;
            setExportJob({
              ...data,
              jobId: snapshot.id,
            });
          } else {
            setExportJob(null);
          }
          setLoading(false);
        },
        (err) => {
          reportException(err, {
            context: "Fetching export job",
            tags: { component: "useExportJob", userId, exportJobId },
          });
          setError("Failed to load export job status");
          setLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (err) {
      reportException(err, {
        context: "Setting up export job listener",
        tags: { component: "useExportJob", userId, exportJobId },
      });
      queueMicrotask(() => {
        setError("Failed to initialize export job listener");
        setLoading(false);
      });
    }
  }, [userId, exportJobId]);

  return { exportJob, loading, error };
}

