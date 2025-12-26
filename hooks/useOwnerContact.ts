"use client";

import { useState, useEffect } from "react";
import { collection, query, where, limit, onSnapshot, doc, onSnapshot as onDocSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { Contact } from "@/types/firestore";
import { useAuth } from "@/hooks/useAuth";
import { normalizeContactId } from "@/util/csv-utils";
import { reportException } from "@/lib/error-reporting";

/**
 * Hook to get the owner contact (the logged-in user's contact)
 * Returns the contact that matches the user's email
 */
export function useOwnerContact() {
  const { user, loading: authLoading } = useAuth();
  const [ownerContact, setOwnerContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user?.email) {
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setLoading(authLoading);
      });
      return;
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    const ownerContactId = normalizeContactId(normalizedEmail);

    // Try multiple approaches to find the owner contact:
    // 1. Query by primaryEmail
    // 2. Query by document ID (normalized contact ID)
    // 3. Query by Owner tag

    const contactRef = collection(db, `users/${user.uid}/contacts`);
    
    // Primary query: by email
    const emailQuery = query(
      contactRef,
      where("primaryEmail", "==", normalizedEmail),
      limit(1)
    );

    // Also try to get by document ID directly
    const docRef = doc(db, `users/${user.uid}/contacts/${ownerContactId}`);

    let emailUnsubscribe: (() => void) | null = null;
    let docUnsubscribe: (() => void) | null = null;
    let foundContact = false;

    // Try document ID first (fastest)
    docUnsubscribe = onDocSnapshot(
      docRef,
      (docSnapshot) => {
        if (docSnapshot.exists() && !foundContact) {
          const contactData = { ...docSnapshot.data(), contactId: docSnapshot.id } as Contact;
          // Verify it's the owner by checking email
          if (contactData.primaryEmail?.toLowerCase().trim() === normalizedEmail) {
            foundContact = true;
            setOwnerContact(contactData);
            setLoading(false);
          }
        }
      },
      () => {
        // Document might not exist, that's okay - try query
      }
    );

    // Also try email query
    emailUnsubscribe = onSnapshot(
      emailQuery,
      (snapshot) => {
        if (!snapshot.empty && !foundContact) {
          foundContact = true;
          const doc = snapshot.docs[0];
          const contactData = { ...doc.data(), contactId: doc.id } as Contact;
          setOwnerContact(contactData);
          setLoading(false);
        } else if (snapshot.empty && !foundContact) {
          // If both queries return empty, set to null
          setOwnerContact(null);
          setLoading(false);
        }
      },
      (error) => {
        reportException(error as Error, {
          context: "Error fetching owner contact",
          tags: { component: "useOwnerContact" },
        });
        if (!foundContact) {
          setOwnerContact(null);
          setLoading(false);
        }
      }
    );

    return () => {
      if (emailUnsubscribe) emailUnsubscribe();
      if (docUnsubscribe) docUnsubscribe();
    };
  }, [user, authLoading]);

  return { ownerContact, loading };
}

