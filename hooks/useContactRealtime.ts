"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseContactRealtimeReturn {
  contact: Contact | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch a single contact for a user using Firebase real-time listener
 * Updates automatically when contact changes in Firestore
 * 
 * @param userId - The user ID
 * @param contactId - The contact ID (can be document ID or contactId field)
 * 
 * Handles both cases:
 * - Document ID lookup (primary method)
 * - Fallback to contactId field query if document ID doesn't match
 */
export function useContactRealtime(userId: string | null, contactId: string | null): UseContactRealtimeReturn {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state when userId or contactId changes
    setLoading(true);
    setContact(null);
    setError(null);

    if (!userId || !contactId) {
      queueMicrotask(() => {
        setLoading(false);
        setContact(null);
      });
      return;
    }

    let isMounted = true;
    const decodedContactId = decodeURIComponent(contactId);

    try {
      // First try direct document lookup (using document ID)
      const contactRef = doc(db, `users/${userId}/contacts/${decodedContactId}`);
      
      const unsubscribe = onSnapshot(
        contactRef,
        (snapshot) => {
          if (!isMounted) return;

          if (snapshot.exists()) {
            const contactData = snapshot.data();
            setContact({
              ...contactData,
              contactId: snapshot.id,
            } as Contact);
            setLoading(false);
            setError(null);
          } else {
            // If not found by document ID, try querying by contactId field
            // Keep loading true while performing the fallback query
            const q = query(
              collection(db, `users/${userId}/contacts`),
              where("contactId", "==", decodedContactId)
            );
            
            getDocs(q)
              .then((querySnapshot) => {
                if (!isMounted) return;

                if (!querySnapshot.empty) {
                  const doc = querySnapshot.docs[0];
                  setContact({
                    ...doc.data(),
                    contactId: doc.id,
                  } as Contact);
                } else {
                  setContact(null);
                }
                setLoading(false);
                setError(null);
              })
              .catch((queryError) => {
                if (!isMounted) return;

                reportException(queryError, {
                  context: "Querying contact by contactId field",
                  tags: { component: "useContactRealtime", userId, contactId: decodedContactId },
                });
                setContact(null);
                setError(queryError instanceof Error ? queryError : new Error(String(queryError)));
                setLoading(false);
              });
            // Note: loading remains true until the fallback query completes
          }
        },
        (err) => {
          if (!isMounted) return;

          reportException(err, {
            context: "Fetching contact (real-time)",
            tags: { component: "useContactRealtime", userId, contactId: decodedContactId },
          });

          queueMicrotask(() => {
            setError(err instanceof Error ? err : new Error(String(err)));
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
        context: "Setting up contact listener",
        tags: { component: "useContactRealtime", userId, contactId: decodedContactId },
      });

      queueMicrotask(() => {
        if (isMounted) {
          setError(error);
          setLoading(false);
        }
      });
    }
  }, [userId, contactId]);

  return { contact, loading, error };
}

