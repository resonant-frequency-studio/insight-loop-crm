"use client";

import { useState, useEffect } from "react";
import { collectionGroup, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { ActionItem } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseActionItemsRealtimeReturn {
  actionItems: ActionItem[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch all action items for a user using Firebase real-time listener
 * Uses collection group query to fetch action items across all contacts
 * Updates automatically when action items change in Firestore
 * 
 * @param userId - The user ID
 * 
 * @requires Firestore composite index on:
 * - Collection Group: `actionItems`
 * - Fields: `userId` (Ascending), `createdAt` (Descending)
 * 
 * Firebase will automatically prompt to create this index when the query first runs,
 * or you can create it manually in Firebase Console.
 */
export function useActionItemsRealtime(userId: string | null): UseActionItemsRealtimeReturn {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => {
        setLoading(false);
        setActionItems([]);
      });
      return;
    }

    let isMounted = true;

    try {
      // Use collection group query to fetch all actionItems across all contacts
      const actionItemsQuery = query(
        collectionGroup(db, "actionItems"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(
        actionItemsQuery,
        (snapshot) => {
          if (!isMounted) return;

          const itemsData = snapshot.docs.map((doc) => {
            const data = doc.data();
            // Extract contactId from document path
            // Path format: users/{userId}/contacts/{contactId}/actionItems/{actionItemId}
            const pathParts = doc.ref.path.split("/");
            const contactId = pathParts[3]; // Extract contactId from path

            return {
              ...data,
              actionItemId: doc.id,
              contactId,
            } as ActionItem;
          });

          setActionItems(itemsData);
          setLoading(false);
          setError(null);
        },
        (err) => {
          if (!isMounted) return;

          const errorMessage = err instanceof Error ? err.message : String(err);
          let userFriendlyError = "Failed to load action items.";
          
          if (errorMessage.includes("The query requires an index")) {
            userFriendlyError = `A Firestore index is missing for action items. Please create it using the link in the console: ${errorMessage.match(/https:\/\/[^\s]+/)?.[0] || ''}`;
          }

          reportException(err, {
            context: "Fetching action items (real-time)",
            tags: { component: "useActionItemsRealtime", userId },
            extra: { 
              originalError: errorMessage,
              userId,
            }
          });

          queueMicrotask(() => {
            setError(new Error(userFriendlyError));
            setActionItems([]); // Clear items on error to prevent stale data
            setLoading(false);
          });
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
        context: "Setting up action items listener",
        tags: { component: "useActionItemsRealtime", userId },
      });

      queueMicrotask(() => {
        if (isMounted) {
          setError(error);
          setLoading(false);
        }
      });
    }
  }, [userId]);

  return { actionItems, loading, error };
}

