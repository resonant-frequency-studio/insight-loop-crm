"use client";

import { useState, useCallback } from "react";
import { OverwriteMode, ImportResult, BatchImportProgress } from "@/lib/contact-import";
import {
  countExistingContacts,
  testWritePermissions,
  importContactsBatch,
} from "@/lib/contact-import";
import { normalizeContactId } from "@/util/csv-utils";

export interface ImportState {
  isImporting: boolean;
  status: string;
  importCount: number;
  errorDetails: string[];
  progress: BatchImportProgress | null;
}

export interface ImportCallbacks {
  onStatusChange?: (status: string) => void;
  onProgress?: (progress: BatchImportProgress) => void;
  onError?: (error: string, details?: string[]) => void;
  onComplete?: (progress: BatchImportProgress) => void;
}

/**
 * Hook for managing contact import operations
 */
export function useContactImport(userId: string | null, callbacks?: ImportCallbacks) {
  const [state, setState] = useState<ImportState>({
    isImporting: false,
    status: "",
    importCount: 0,
    errorDetails: [],
    progress: null,
  });

  const checkExistingContacts = useCallback(
    async (rows: Record<string, string>[]): Promise<number> => {
      if (!userId) throw new Error("User ID is required");
      
      const status = "Checking for existing contacts...";
      setState((prev) => ({ ...prev, status }));
      callbacks?.onStatusChange?.(status);

      const count = await countExistingContacts(userId, rows);
      return count;
    },
    [userId, callbacks]
  );

  const testPermissions = useCallback(
    async (testEmail: string): Promise<void> => {
      if (!userId) throw new Error("User ID is required");

      try {
        await testWritePermissions(userId, testEmail);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        
        let statusMessage = "";
        if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) {
          statusMessage =
            `Error: Firestore writes are timing out. This usually means Firestore security rules are blocking writes. ` +
            `Please check your Firestore rules in Firebase Console. The rule should be: ` +
            `match /users/{userId}/contacts/{contactId} { allow read, write: if request.auth != null && request.auth.uid == userId; }`;
        } else if (errorMsg.includes("permission") || errorMsg.includes("Permission")) {
          statusMessage =
            `Error: Firestore security rules are blocking writes. Please check your Firestore rules to allow authenticated users to write to users/{userId}/contacts/{contactId}`;
        } else {
          statusMessage = `Error: Cannot write to Firestore. ${errorMsg}`;
        }

        setState((prev) => ({ ...prev, status: statusMessage, isImporting: false }));
        callbacks?.onError?.(statusMessage);
        throw error;
      }
    },
    [userId, callbacks]
  );

  const startImport = useCallback(
    async (
      rows: Record<string, string>[],
      overwriteMode: OverwriteMode
    ): Promise<BatchImportProgress> => {
      if (!userId) throw new Error("User ID is required");

      setState({
        isImporting: true,
        status: "Starting import...",
        importCount: 0,
        errorDetails: [],
        progress: null,
      });
      callbacks?.onStatusChange?.("Starting import...");

      // Test permissions with first contact
      if (rows.length > 0) {
        const firstRow = rows[0];
        const testEmail = firstRow.Email?.trim().toLowerCase();
        if (testEmail) {
          await testPermissions(testEmail);
        }
      }

      const totalRows = rows.length;
      const status = `Importing ${totalRows} contacts...`;
      setState((prev) => ({ ...prev, status }));
      callbacks?.onStatusChange?.(status);

      const progress = await importContactsBatch(
        userId,
        rows,
        overwriteMode,
        10, // batch size
        (progressUpdate) => {
          setState((prev) => ({
            ...prev,
            importCount: progressUpdate.imported,
            progress: progressUpdate,
            errorDetails: progressUpdate.errorDetails,
            status: `Importing ${totalRows} contacts... (${progressUpdate.imported} imported, ${progressUpdate.errors} errors)`,
          }));
          callbacks?.onProgress?.(progressUpdate);
        }
      );

      let statusMessage = `Import complete! ${progress.imported} contact${progress.imported !== 1 ? "s" : ""} imported`;
      if (progress.skipped > 0) {
        statusMessage += `, ${progress.skipped} skipped`;
      }
      if (progress.errors > 0) {
        statusMessage += `, ${progress.errors} failed`;
      }
      statusMessage += ".";

      setState((prev) => ({
        ...prev,
        isImporting: false,
        status: statusMessage,
        progress,
        errorDetails: progress.errorDetails,
      }));
      
      callbacks?.onStatusChange?.(statusMessage);
      callbacks?.onComplete?.(progress);

      return progress;
    },
    [userId, testPermissions, callbacks]
  );

  const reset = useCallback(() => {
    setState({
      isImporting: false,
      status: "",
      importCount: 0,
      errorDetails: [],
      progress: null,
    });
  }, []);

  const cancel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isImporting: false,
      status: "",
      importCount: 0,
      errorDetails: [],
    }));
  }, []);

  return {
    state,
    checkExistingContacts,
    startImport,
    reset,
    cancel,
  };
}

