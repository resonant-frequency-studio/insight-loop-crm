"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { ActionItem } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseActionItemsForContactRealtimeReturn {
  actionItems: ActionItem[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch action items for a specific contact using Firebase real-time listener
 * Updates automatically when action items change in Firestore
 * 
 * @param userId - The user ID
 * @param contactId - The contact ID
 * 
 * @requires Firestore composite index on:
 * - Collection: `users/{userId}/contacts/{contactId}/actionItems`
 * - Fields: `createdAt` (Descending)
 * 
 * Firebase will automatically prompt to create this index when the query first runs,
 * or you can create it manually in Firebase Console.
 */
export function useActionItemsForContactRealtime(
  userId: string | null,
  contactId: string | null
): UseActionItemsForContactRealtimeReturn {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || !contactId) {
      queueMicrotask(() => {
        setLoading(false);
        setActionItems([]);
      });
      return;
    }

    let isMounted = true;
    const decodedContactId = decodeURIComponent(contactId);

    try {
      // Query action items subcollection for the specific contact
      const actionItemsRef = collection(db, `users/${userId}/contacts/${decodedContactId}/actionItems`);
      const actionItemsQuery = query(actionItemsRef, orderBy("createdAt", "desc"));

      const unsubscribe = onSnapshot(
        actionItemsQuery,
        (snapshot) => {
          if (!isMounted) return;

          const itemsData = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              ...data,
              actionItemId: doc.id,
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
            context: "Fetching action items for contact (real-time)",
            tags: { component: "useActionItemsForContactRealtime", userId, contactId: decodedContactId },
            extra: { originalError: errorMessage }
          });

          queueMicrotask(() => {
            setError(new Error(userFriendlyError));
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
        tags: { component: "useActionItemsForContactRealtime", userId, contactId: decodedContactId },
      });

      queueMicrotask(() => {
        if (isMounted) {
          setError(error);
          setLoading(false);
        }
      });
    }
  }, [userId, contactId]);

  return { actionItems, loading, error };
}

