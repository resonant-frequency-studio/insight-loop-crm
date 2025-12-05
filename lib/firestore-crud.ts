import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    getDocs,
    serverTimestamp,
  } from "firebase/firestore";
  import { db } from "@/lib/firebase-client";
  import { contactDoc, contactsPath, messageDoc, syncJobDoc, threadDoc } from "./firestore-paths";
import { Contact, Message, SyncJob, Thread } from "@/types/firestore";
  
  // Create or update a contact
  export async function upsertContact(userId: string, contactId: string, data: Partial<Contact>) {
    const ref = doc(db, contactDoc(userId, contactId));
  
    await setDoc(
      ref,
      {
        ...data,
        contactId,
        updatedAt: serverTimestamp(),
        createdAt: data.createdAt || serverTimestamp(),
      },
      { merge: true }
    );
  }
  
  // Get a single contact
  export async function getContact(userId: string, contactId: string) {
    const ref = doc(db, contactDoc(userId, contactId));
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as Contact) : null;
  }
  
  // Get all contacts
  export async function getAllContacts(userId: string) {
    const ref = collection(db, contactsPath(userId));
    const snap = await getDocs(ref);
    return snap.docs.map((d) => d.data() as Contact);
  }

  export async function upsertThread(userId: string, threadId: string, data: Partial<Thread>) {
    const ref = doc(db, threadDoc(userId, threadId));
  
    await setDoc(
      ref,
      {
        ...data,
        threadId,
        updatedAt: serverTimestamp(),
        createdAt: data.createdAt || serverTimestamp(),
      },
      { merge: true }
    );
  }
  
  export async function getThread(userId: string, threadId: string) {
    const ref = doc(db, threadDoc(userId, threadId));
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as Thread) : null;
  }

  export async function upsertMessage(
    userId: string,
    threadId: string,
    messageId: string,
    data: Partial<Message>
  ) {
    const ref = doc(db, messageDoc(userId, threadId, messageId));
  
    await setDoc(
      ref,
      {
        ...data,
        messageId,
        updatedAt: serverTimestamp(),
        createdAt: data.createdAt || serverTimestamp(),
      },
      { merge: true }
    );
  }

  export async function createSyncJob(userId: string, syncJobId: string, data: Partial<SyncJob>) {
    const ref = doc(db, syncJobDoc(userId, syncJobId));
  
    await setDoc(
      ref,
      {
        ...data,
        syncJobId,
        userId,
        startedAt: serverTimestamp(),
        processedThreads: 0,
        processedMessages: 0,
        status: "pending",
      },
      { merge: true }
    );
  }
  
  export async function updateSyncJob(userId: string, syncJobId: string, data: Partial<SyncJob>) {
    const ref = doc(db, syncJobDoc(userId, syncJobId));
    await updateDoc(ref, { ...data });
  }
  