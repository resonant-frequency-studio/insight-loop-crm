"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

export function useContactDetailPage(contactId: string) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!user || !contactId) return;

    let isMounted = true;
    
    // Decode the contactId in case it was URL encoded
    const decodedContactId = decodeURIComponent(contactId);
    
    // First try direct document lookup (using document ID)
    const ref = doc(db, `users/${user.uid}/contacts/${decodedContactId}`);
    
    const unsub = onSnapshot(ref, (snap) => {
      if (!isMounted) return;
      
      if (snap.exists()) {
        const contactData = snap.data() as Contact;
        setContact(contactData);
        setChecking(false);
      } else {
        // If not found by document ID, try querying by contactId field
        const q = query(
          collection(db, `users/${user.uid}/contacts`),
          where("contactId", "==", decodedContactId)
        );
        
        getDocs(q).then((querySnapshot) => {
          if (!isMounted) return;
          
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            setContact({ ...doc.data(), contactId: doc.id } as Contact);
          } else {
            setContact(null);
          }
          setChecking(false);
        }).catch((error) => {
          if (!isMounted) return;
          reportException(error, {
            context: "Querying contact",
            tags: { component: "useContactDetailPage", contactId },
          });
          setContact(null);
          setChecking(false);
        });
      }
    }, (error) => {
      reportException(error, {
        context: "Error in onSnapshot",
        tags: { component: "useContactDetailPage", contactId },
      });
      if (isMounted) {
        setContact(null);
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [user, contactId, loading, router]);

  return {
    contact,
    checking,
    user,
    loading,
    decodedContactId: contactId ? decodeURIComponent(contactId) : contactId,
  };
}

