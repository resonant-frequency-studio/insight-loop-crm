import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { Contact } from "@/types/firestore";
import { normalizeContactId, csvRowToContact } from "@/util/csv-utils";

export type OverwriteMode = "overwrite" | "skip";

export interface ImportResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

export interface BatchImportProgress {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
  errorDetails: string[];
}

/**
 * Checks if a contact exists in Firestore
 */
export async function checkContactExists(
  userId: string,
  email: string
): Promise<boolean> {
  const contactId = normalizeContactId(email);
  const docRef = doc(db, `users/${userId}/contacts/${contactId}`);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
}

/**
 * Counts how many contacts from a list already exist
 */
export async function countExistingContacts(
  userId: string,
  rows: Record<string, string>[]
): Promise<number> {
  let existingCount = 0;
  
  for (const row of rows) {
    const email = row.Email?.trim().toLowerCase();
    if (email) {
      const exists = await checkContactExists(userId, email);
      if (exists) {
        existingCount++;
      }
    }
  }
  
  return existingCount;
}

/**
 * Tests write permissions by attempting a test write
 */
export async function testWritePermissions(
  userId: string,
  testEmail: string
): Promise<void> {
  const testContactId = normalizeContactId(testEmail);
  const testDocRef = doc(db, `users/${userId}/contacts/${testContactId}`);
  
  const testWritePromise = setDoc(
    testDocRef,
    {
      contactId: testContactId,
      primaryEmail: testEmail,
      test: true,
    },
    { merge: true }
  );
  
  const testTimeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Permission test timeout - Firestore rules may be blocking writes")),
      3000
    );
  });
  
  await Promise.race([testWritePromise, testTimeout]);
}

/**
 * Imports a single contact from a CSV row
 */
export async function importContact(
  userId: string,
  row: Record<string, string>,
  overwriteMode: OverwriteMode
): Promise<ImportResult> {
  const email = row.Email?.trim().toLowerCase();
  if (!email) {
    return { success: false, reason: "No email" };
  }

  const contactId = normalizeContactId(email);
  const docRef = doc(db, `users/${userId}/contacts/${contactId}`);
  
  // Check if contact exists
  const docSnap = await getDoc(docRef);
  const exists = docSnap.exists();
  
  // Skip if contact exists and we're in skip mode
  if (exists && overwriteMode === "skip") {
    return { success: true, skipped: true };
  }
  
  // Prepare contact data
  const contactData = csvRowToContact(row, contactId);
  
  // Handle createdAt based on overwrite mode
  if (!exists) {
    contactData.createdAt = serverTimestamp();
  } else if (overwriteMode === "overwrite") {
    // Preserve existing createdAt when overwriting
    const existingData = docSnap.data();
    if (existingData?.createdAt) {
      contactData.createdAt = existingData.createdAt;
    } else {
      contactData.createdAt = serverTimestamp();
    }
  }
  
  // Write with timeout
  const writePromise = setDoc(
    docRef,
    contactData,
    { merge: overwriteMode === "overwrite" }
  );
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Write timeout after 5 seconds")), 5000);
  });
  
  try {
    await Promise.race([writePromise, timeoutPromise]);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, reason: errorMsg };
  }
}

/**
 * Imports contacts in batches with progress reporting
 */
export async function importContactsBatch(
  userId: string,
  rows: Record<string, string>[],
  overwriteMode: OverwriteMode,
  batchSize: number,
  onProgress?: (progress: BatchImportProgress) => void
): Promise<BatchImportProgress> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];
  const total = rows.length;
  const totalBatches = Math.ceil(rows.length / batchSize);
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    const promises = batch.map(async (row) => {
      try {
        const result = await importContact(userId, row, overwriteMode);
        return { result, row };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        return { result: { success: false, reason: errorMsg }, row };
      }
    });
    
    const batchResults = await Promise.all(promises);
    
    batchResults.forEach(({ result, row }) => {
      if (result.success) {
        if (result.skipped) {
          skipped++;
        } else {
          imported++;
        }
      } else {
        errors++;
        const email = row.Email?.trim() || "Unknown";
        errorDetails.push(`${email}: ${result.reason || "Unknown error"}`);
      }
    });
    
    // Report progress
    if (onProgress) {
      onProgress({ imported, skipped, errors, total, errorDetails: [...errorDetails] });
    }
  }
  
  return { imported, skipped, errors, total, errorDetails };
}

