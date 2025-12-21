import { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { normalizeContactId, csvRowToContact } from "@/util/csv-utils";
import { reportException } from "@/lib/error-reporting";

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
  
  // Extract actionItems text before converting row to contact
  // This will be converted to subcollection format after contact is saved
  const actionItemsText = row.ActionItems?.trim() || null;
  
  // Check if contact exists
  const docSnap = await getDoc(docRef);
  const exists = docSnap.exists();
  
  // Skip if contact exists and we're in skip mode
  if (exists && overwriteMode === "skip") {
    return { success: true, skipped: true };
  }
  
  // Prepare contact data (actionItems field is excluded by csvRowToContact)
  const contactData = csvRowToContact(row, contactId);
  
  // Handle createdAt and archived status based on overwrite mode
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
    
    // Preserve archived status when overwriting (CSV won't have this field)
    if (existingData?.archived !== undefined) {
      contactData.archived = existingData.archived;
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
    
    // Check if existing contact has action items in legacy format (string field)
    // that need to be migrated to subcollection format
    let legacyActionItemsText: string | null = null;
    let hasLegacyField = false;
    
    if (exists) {
      const existingData = docSnap.data();
      if (existingData?.actionItems && typeof existingData.actionItems === "string") {
        hasLegacyField = true;
        // If CSV doesn't have action items, migrate the legacy ones
        if (!actionItemsText) {
          legacyActionItemsText = existingData.actionItems;
        }
      }
    }
    
    // Migrate action items: prioritize CSV, fallback to legacy format if no CSV action items
    const actionItemsToMigrate = actionItemsText || legacyActionItemsText;
    
    if (actionItemsToMigrate && actionItemsToMigrate.length > 0) {
      try {
        const response = await fetch("/api/action-items/import-from-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contactId,
            actionItemsText: actionItemsToMigrate,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          reportException(new Error(errorData.error || "Unknown error"), {
            context: "Failed to import action items for contact",
            tags: { component: "contact-import", contactId },
          });
          // Don't fail the contact import if action items conversion fails
        } else if (hasLegacyField) {
          // If contact had legacy actionItems field (regardless of whether we migrated it or CSV had new ones),
          // remove the old string field to prevent confusion and ensure subcollection is the source of truth
          try {
            await updateDoc(docRef, {
              actionItems: deleteField(),
            });
          } catch (deleteError) {
            // Non-critical: if deletion fails, log but don't fail import
            reportException(deleteError, {
              context: "Failed to delete legacy actionItems field after migration",
              tags: { component: "contact-import", contactId },
            });
          }
        }
      } catch (error) {
        reportException(error, {
          context: "Error importing action items for contact",
          tags: { component: "contact-import", contactId },
        });
        // Don't fail the contact import if action items conversion fails
      }
    } else if (hasLegacyField && exists) {
      // If CSV doesn't have action items and contact has legacy field,
      // we should still delete it if we're overwriting (to clean up)
      // But if we're just creating a new contact, there's nothing to delete
      if (overwriteMode === "overwrite") {
        try {
          await updateDoc(docRef, {
            actionItems: deleteField(),
          });
        } catch (deleteError) {
          // Non-critical: if deletion fails, log but don't fail import
          reportException(deleteError, {
            context: "Failed to delete legacy actionItems field during import",
            tags: { component: "contact-import", contactId },
          });
        }
      }
    }
    
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

