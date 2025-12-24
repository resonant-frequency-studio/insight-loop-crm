"use client";

import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseContactsRealtimeReturn {
  contacts: Contact[];
  loading: boolean;
  error: Error | null;
  hasConfirmedNoContacts: boolean; // True when both cache and server confirm no contacts
}

/**
 * Hook to fetch all contacts for a user using Firebase real-time listener
 * Updates automatically when contacts change in Firestore
 */
export function useContactsRealtime(userId: string | null): UseContactsRealtimeReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasConfirmedNoContacts, setHasConfirmedNoContacts] = useState(false);
  const hasReceivedServerSnapshotRef = useRef(false);
  const cachedSnapshotWasEmptyRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      // Defer setState to avoid cascading renders
      queueMicrotask(() => {
        setLoading(false);
        setContacts([]);
        setHasConfirmedNoContacts(false);
      });
      hasReceivedServerSnapshotRef.current = false;
      cachedSnapshotWasEmptyRef.current = false;
      return;
    }

    let isMounted = true;
    hasReceivedServerSnapshotRef.current = false;
    cachedSnapshotWasEmptyRef.current = false;
    queueMicrotask(() => {
      setLoading(true);
      setHasConfirmedNoContacts(false);
    });

    try {
      const contactsRef = collection(db, `users/${userId}/contacts`);

      const unsubscribe = onSnapshot(
        contactsRef,
        (snapshot) => {
          if (!isMounted) return;

          const contactsData = snapshot.docs.map((doc) => {
            const data = doc.data();
            // Ensure contactId matches document ID (real-time listener uses doc.id)
            // If contactId field exists but doesn't match doc.id, use doc.id as source of truth
            const contact = {
              ...data,
              contactId: doc.id, // Always use document ID as contactId
            } as Contact;
            
            // Ensure archived field exists (default to false if missing)
            if (contact.archived === undefined) {
              contact.archived = false;
            }
            
            return contact;
          });

          setContacts(contactsData);
          
          const isFromCache = snapshot.metadata.fromCache;
          
          if (!isFromCache) {
            // Server snapshot received
            hasReceivedServerSnapshotRef.current = true;
            setLoading(false);
            
            // Check if both cache and server confirmed no contacts
            if (contactsData.length === 0 && cachedSnapshotWasEmptyRef.current) {
              setHasConfirmedNoContacts(true);
            } else {
              setHasConfirmedNoContacts(false);
            }
          } else {
            // Cached snapshot
            if (contactsData.length === 0) {
              cachedSnapshotWasEmptyRef.current = true;
            } else {
              cachedSnapshotWasEmptyRef.current = false;
            }
            // Keep loading true until server snapshot arrives
          }
          
          setError(null);
        },
        (err) => {
          if (!isMounted) return;

          reportException(err, {
            context: "Fetching contacts (real-time)",
            tags: { component: "useContactsRealtime", userId },
          });

          setError(err);
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
        context: "Setting up contacts listener",
        tags: { component: "useContactsRealtime", userId },
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

  return { contacts, loading, error, hasConfirmedNoContacts };
}

