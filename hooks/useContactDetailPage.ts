"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";

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
    console.log("Looking up contact with ID:", decodedContactId);
    
    // First try direct document lookup (using document ID)
    const ref = doc(db, `users/${user.uid}/contacts/${decodedContactId}`);
    console.log("Document path:", ref.path);
    
    const unsub = onSnapshot(ref, (snap) => {
      if (!isMounted) return;
      
      console.log("Document exists:", snap.exists(), "Path:", snap.ref.path);
      
      if (snap.exists()) {
        const contactData = snap.data() as Contact;
        console.log("Found contact:", contactData);
        setContact(contactData);
        setChecking(false);
      } else {
        console.log("Document not found by ID, trying query by contactId field...");
        // If not found by document ID, try querying by contactId field
        const q = query(
          collection(db, `users/${user.uid}/contacts`),
          where("contactId", "==", decodedContactId)
        );
        
        getDocs(q).then((querySnapshot) => {
          if (!isMounted) return;
          
          console.log("Query results:", querySnapshot.size, "documents");
          
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            console.log("Found contact by contactId field:", doc.id);
            setContact({ ...doc.data(), contactId: doc.id } as Contact);
          } else {
            console.log("Contact not found by contactId field either");
            setContact(null);
          }
          setChecking(false);
        }).catch((error) => {
          if (!isMounted) return;
          console.error("Error querying contact:", error);
          setContact(null);
          setChecking(false);
        });
      }
    }, (error) => {
      console.error("Error in onSnapshot:", error);
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

