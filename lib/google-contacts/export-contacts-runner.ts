import { adminDb } from "@/lib/firebase-admin";
import { getAccessToken } from "@/lib/gmail/get-access-token";
import { ExportJob, Contact } from "@/types/firestore";
import { FieldValue, FieldPath } from "firebase-admin/firestore";
import { reportException, ErrorLevel } from "@/lib/error-reporting";
import { listContactGroups, createContactGroup, addContactToGroup } from "@/lib/google-people/contact-groups";
import { checkContactExists, batchCreateContacts } from "@/lib/google-people/create-contact";

export interface ExportContactsOptions {
  userId: string;
  exportJobId: string;
  contactIds: string[];
  groupId?: string;
  groupName?: string;
}

/**
 * Create a new export job document
 */
async function createExportJob(
  userId: string,
  exportJobId: string,
  totalContacts: number,
  groupId?: string,
  groupName?: string
): Promise<void> {
  await adminDb
    .collection("users")
    .doc(userId)
    .collection("exportJobs")
    .doc(exportJobId)
    .set({
      jobId: exportJobId,
      userId,
      status: "running",
      startedAt: FieldValue.serverTimestamp(),
      totalContacts,
      processedContacts: 0,
      skippedContacts: 0,
      errors: 0,
      groupId: groupId || null,
      groupName: groupName || null,
    });
}

/**
 * Update export job status
 */
async function updateExportJob(
  userId: string,
  exportJobId: string,
  updates: Partial<ExportJob>
): Promise<void> {
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  );

  const docRef = adminDb
    .collection("users")
    .doc(userId)
    .collection("exportJobs")
    .doc(exportJobId);

  await docRef.set(
    {
      jobId: exportJobId,
      userId,
      ...cleanUpdates,
    },
    { merge: true }
  );
}

/**
 * Run the export job to export contacts to Google Contacts
 */
export async function runExportJob(options: ExportContactsOptions): Promise<void> {
  const { userId, exportJobId, contactIds, groupId, groupName } = options;

  let accessToken: string;
  let finalGroupId: string | undefined = groupId;
  let finalGroupName: string | undefined = groupName;

  try {
    // Get access token
    accessToken = await getAccessToken(userId);
    
    // If groupId is provided but no groupName, fetch the group name
    if (groupId && !groupName) {
      try {
        const groups = await listContactGroups(accessToken);
        const foundGroup = groups.find((g) => g.resourceName === groupId);
        if (foundGroup) {
          finalGroupName = foundGroup.name;
          await updateExportJob(userId, exportJobId, {
            groupName: finalGroupName,
          });
        }
      } catch (error) {
        // Log but don't fail - group name is just for display
        reportException(error, {
          context: "Fetching group name for export",
          tags: { component: "export-contacts-runner", groupId },
          level: ErrorLevel.WARNING,
        });
      }
    }
  } catch (error) {
    await updateExportJob(userId, exportJobId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Failed to get access token",
      finishedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  try {
    // Fetch contacts from Firestore by document ID
    // Firestore 'in' query supports max 10 items, so we fetch in batches
    const allContacts: Contact[] = [];
    for (let i = 0; i < contactIds.length; i += 10) {
      const batch = contactIds.slice(i, i + 10);
      const batchSnapshot = await adminDb
        .collection("users")
        .doc(userId)
        .collection("contacts")
        .where(FieldPath.documentId(), "in", batch)
        .get();
      
      batchSnapshot.docs.forEach((doc) => {
        allContacts.push({ ...doc.data(), contactId: doc.id } as Contact);
      });
    }

    // Create export job document
    await createExportJob(userId, exportJobId, allContacts.length, groupId, groupName);

    // If groupName is provided but no groupId, create the group (or use existing if it already exists)
    if (groupName && !groupId) {
      await updateExportJob(userId, exportJobId, {
        currentStep: "Creating contact group...",
      });

      try {
        const newGroup = await createContactGroup(accessToken, groupName);
        finalGroupId = newGroup.resourceName;
        await updateExportJob(userId, exportJobId, {
          groupId: finalGroupId,
        });
      } catch (error) {
        // If group already exists (409), find and use the existing group
        interface ErrorWithStatus extends Error {
          statusCode?: number;
          errorData?: { code?: number; message?: string; status?: string };
        }
        const errorWithStatus = error as ErrorWithStatus;
        const is409Error = error instanceof Error && (
          error.message.includes("409") ||
          errorWithStatus.statusCode === 409 ||
          errorWithStatus.errorData?.code === 409 ||
          errorWithStatus.errorData?.status === "ALREADY_EXISTS"
        );
        
        if (is409Error) {
          try {
            await updateExportJob(userId, exportJobId, {
              currentStep: "Finding existing contact group...",
            });
            
            const existingGroups = await listContactGroups(accessToken);
            const existingGroup = existingGroups.find(
              (group) => group.name?.toLowerCase() === groupName.toLowerCase()
            );
            
            if (existingGroup) {
              finalGroupId = existingGroup.resourceName;
              finalGroupName = existingGroup.name;
              await updateExportJob(userId, exportJobId, {
                groupId: finalGroupId,
                groupName: finalGroupName,
                currentStep: "Using existing contact group...",
              });
            } else {
              // Group name conflict but couldn't find it - this shouldn't happen, but handle gracefully
              await updateExportJob(userId, exportJobId, {
                status: "error",
                errorMessage: `Contact group "${groupName}" already exists but could not be found. Please select it from the existing groups list.`,
                finishedAt: FieldValue.serverTimestamp(),
              });
              return;
            }
          } catch {
            await updateExportJob(userId, exportJobId, {
              status: "error",
              errorMessage: `Failed to create or find contact group: ${error instanceof Error ? error.message : "Unknown error"}`,
              finishedAt: FieldValue.serverTimestamp(),
            });
            return;
          }
        } else {
          // Other errors - fail the export
          await updateExportJob(userId, exportJobId, {
            status: "error",
            errorMessage: `Failed to create contact group: ${error instanceof Error ? error.message : "Unknown error"}`,
            finishedAt: FieldValue.serverTimestamp(),
          });
          return;
        }
      }
    }

    // Process contacts in batches of 200 (People API batch limit)
    const BATCH_SIZE = 200;
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allContacts.length; i += BATCH_SIZE) {
      const batch = allContacts.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allContacts.length / BATCH_SIZE);

      await updateExportJob(userId, exportJobId, {
        currentStep: `Exporting contacts (batch ${batchNumber}/${totalBatches})...`,
      });

      try {
        // Check which contacts already exist in Google
        const contactsToCreate: Contact[] = [];
        const existingContacts: Array<{ contact: Contact; resourceName: string }> = [];

        for (const contact of batch) {
          try {
            const exists = await checkContactExists(accessToken, contact.primaryEmail);
            if (exists.exists && exists.resourceName) {
              existingContacts.push({
                contact,
                resourceName: exists.resourceName,
              });
            } else {
              contactsToCreate.push(contact);
            }
            // Small delay to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            // If check fails, try to create anyway
            contactsToCreate.push(contact);
            reportException(error, {
              context: "Checking if contact exists during export",
              tags: { component: "export-contacts-runner", contactId: contact.contactId },
              level: ErrorLevel.WARNING,
            });
          }
        }

        // Create new contacts in batch
        if (contactsToCreate.length > 0) {
          try {
            await batchCreateContacts(accessToken, contactsToCreate, finalGroupId);
            processedCount += contactsToCreate.length;
          } catch (error) {
            // If batch create fails, try individual creates
            reportException(error, {
              context: "Batch creating contacts failed, trying individual creates",
              tags: { component: "export-contacts-runner" },
            });

            for (const contact of contactsToCreate) {
              try {
                const { createContact } = await import("@/lib/google-people/create-contact");
                await createContact(accessToken, contact, finalGroupId);
                processedCount++;
                await new Promise((resolve) => setTimeout(resolve, 200)); // Rate limiting
              } catch (createError) {
                errorCount++;
                reportException(createError, {
                  context: "Creating individual contact during export",
                  tags: { component: "export-contacts-runner", contactId: contact.contactId },
                });
              }
            }
          }
        }

        // Add existing contacts to group (if group specified)
        if (finalGroupId && existingContacts.length > 0) {
          for (const { contact, resourceName } of existingContacts) {
            try {
              await addContactToGroup(accessToken, resourceName, finalGroupId);
              skippedCount++; // Count as skipped since we didn't create, just added to group
              await new Promise((resolve) => setTimeout(resolve, 100)); // Rate limiting
            } catch (error) {
              errorCount++;
              reportException(error, {
                context: "Adding existing contact to group during export",
                tags: { component: "export-contacts-runner", contactId: contact.contactId },
                level: ErrorLevel.WARNING,
              });
            }
          }
        } else if (existingContacts.length > 0) {
          // If no group specified, just skip existing contacts
          skippedCount += existingContacts.length;
        }

        // Update progress
        await updateExportJob(userId, exportJobId, {
          processedContacts: processedCount,
          skippedContacts: skippedCount,
          errors: errorCount,
        });

        // Delay between batches to respect rate limits (600 requests/min = ~10/sec)
        if (i + BATCH_SIZE < allContacts.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        }
      } catch (error) {
        errorCount += batch.length;
        reportException(error, {
          context: "Error processing batch during export",
          tags: { component: "export-contacts-runner" },
          extra: { batchStart: i, batchSize: batch.length },
        });
      }
    }

    // Mark job as complete
    await updateExportJob(userId, exportJobId, {
      status: "complete",
      finishedAt: FieldValue.serverTimestamp(),
      currentStep: "Export complete",
    });
  } catch (error) {
    await updateExportJob(userId, exportJobId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      finishedAt: FieldValue.serverTimestamp(),
    });
    reportException(error, {
      context: "Error running export job",
      tags: { component: "export-contacts-runner", userId, exportJobId },
    });
  }
}

