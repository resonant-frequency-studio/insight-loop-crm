import { Contact } from "@/types/firestore";
import { reportException, ErrorLevel } from "@/lib/error-reporting";

export interface PeopleApiContact {
  names?: Array<{
    givenName?: string;
    familyName?: string;
  }>;
  emailAddresses?: Array<{
    value: string;
    type?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
  }>;
  biographies?: Array<{
    value?: string;
  }>;
}

export interface CreateContactResponse {
  person: {
    resourceName: string;
    [key: string]: unknown;
  };
}

export interface BatchCreateContactsRequest {
  contacts: Array<{
    contactPerson: PeopleApiContact;
  }>;
  readMask?: string;
}

export interface BatchCreateContactsResponse {
  createdPeople?: Array<{
    person: {
      resourceName: string;
      [key: string]: unknown;
    };
    createdPersonResourceName?: string;
  }>;
}

/**
 * Check if a contact exists in Google Contacts by email
 */
export async function checkContactExists(
  accessToken: string,
  email: string
): Promise<{ exists: boolean; resourceName?: string }> {
  try {
    // Search for contact by email
    // readMask is required - specify which fields to return
    // Note: resourceName is returned automatically, not part of readMask
    const readMask = "emailAddresses,names";
    const response = await fetch(
      `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=${encodeURIComponent(readMask)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      // If search fails, assume contact doesn't exist
      if (response.status === 404 || response.status === 403) {
        return { exists: false };
      }
      const errorText = await response.text();
      const error = new Error(
        `People API checkContactExists failed: ${response.status} ${response.statusText}`
      );
      reportException(error, {
        context: "Checking if contact exists",
        tags: { component: "create-contact", status: String(response.status) },
        extra: { errorText, email },
      });
      throw error;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const person = data.results[0].person;
      if (person && person.resourceName) {
        // Verify the email matches
        const emailAddresses = person.emailAddresses || [];
        const matchingEmail = emailAddresses.find(
          (e: { value?: string }) => e.value?.toLowerCase() === email.toLowerCase()
        );
        if (matchingEmail) {
          return { exists: true, resourceName: person.resourceName };
        }
      }
    }

    return { exists: false };
  } catch (error) {
    reportException(error, {
      context: "Error checking if contact exists in People API",
      tags: { component: "create-contact" },
      extra: { email },
    });
    // On error, assume contact doesn't exist to allow creation
    return { exists: false };
  }
}

/**
 * Convert CRM Contact to People API format
 */
function contactToPeopleApiFormat(contact: Contact): PeopleApiContact {
  const peopleContact: PeopleApiContact = {};

  // Names
  if (contact.firstName || contact.lastName) {
    peopleContact.names = [
      {
        givenName: contact.firstName || undefined,
        familyName: contact.lastName || undefined,
      },
    ];
  }

  // Email
  if (contact.primaryEmail) {
    peopleContact.emailAddresses = [
      {
        value: contact.primaryEmail,
        type: "other", // Can be "home", "work", "other"
      },
    ];
  }

  // Organization/Company
  if (contact.company) {
    peopleContact.organizations = [
      {
        name: contact.company,
      },
    ];
  }

  // Notes (as biography)
  if (contact.notes) {
    peopleContact.biographies = [
      {
        value: contact.notes,
      },
    ];
  }

  return peopleContact;
}

/**
 * Create a single contact in Google Contacts
 */
export async function createContact(
  accessToken: string,
  contact: Contact,
  groupId?: string
): Promise<{ resourceName: string }> {
  try {
    const peopleContact = contactToPeopleApiFormat(contact);

    const response = await fetch("https://people.googleapis.com/v1/people:createContact", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...peopleContact,
        // If groupId is provided, we'll add the contact to the group after creation
        // (People API doesn't support adding to group during creation)
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(
        `People API createContact failed: ${response.status} ${response.statusText}`
      );
      reportException(error, {
        context: "Creating contact",
        tags: { component: "create-contact", status: String(response.status) },
        extra: { errorText, contactId: contact.contactId, email: contact.primaryEmail },
      });
      throw error;
    }

    const data: CreateContactResponse = await response.json();

    // If groupId is provided, add contact to group
    if (groupId && data.person.resourceName) {
      try {
        const { addContactToGroup } = await import("./contact-groups");
        await addContactToGroup(accessToken, data.person.resourceName, groupId);
      } catch (groupError) {
        // Log but don't fail - contact was created successfully
        reportException(groupError, {
          context: "Adding contact to group after creation",
          tags: { component: "create-contact" },
          extra: { contactId: contact.contactId, groupId },
          level: ErrorLevel.WARNING,
        });
      }
    }

    return { resourceName: data.person.resourceName };
  } catch (error) {
    reportException(error, {
      context: "Error creating contact in People API",
      tags: { component: "create-contact" },
      extra: { contactId: contact.contactId, email: contact.primaryEmail },
    });
    throw error;
  }
}

/**
 * Batch create contacts in Google Contacts (up to 200 contacts per request)
 */
export async function batchCreateContacts(
  accessToken: string,
  contacts: Contact[],
  groupId?: string
): Promise<Array<{ resourceName: string; contactId: string }>> {
  if (contacts.length === 0) {
    return [];
  }

  if (contacts.length > 200) {
    throw new Error("Batch create supports maximum 200 contacts per request");
  }

  try {
    const requestBody: BatchCreateContactsRequest = {
      contacts: contacts.map((contact) => ({
        contactPerson: contactToPeopleApiFormat(contact),
      })),
      readMask: "resourceNames",
    };

    const response = await fetch("https://people.googleapis.com/v1/people:batchCreateContacts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(
        `People API batchCreateContacts failed: ${response.status} ${response.statusText}`
      );
      reportException(error, {
        context: "Batch creating contacts",
        tags: { component: "create-contact", status: String(response.status) },
        extra: { errorText, contactCount: contacts.length },
      });
      throw error;
    }

    const data: BatchCreateContactsResponse = await response.json();
    const results: Array<{ resourceName: string; contactId: string }> = [];

    if (data.createdPeople) {
      // Map created contacts back to their original contact IDs
      data.createdPeople.forEach((created, index) => {
        if (created.person?.resourceName) {
          results.push({
            resourceName: created.person.resourceName,
            contactId: contacts[index].contactId,
          });
        }
      });

      // If groupId is provided, add all contacts to group
      if (groupId && results.length > 0) {
        try {
          const { addContactToGroup } = await import("./contact-groups");
          // Add contacts to group sequentially to avoid rate limits
          for (const result of results) {
            try {
              await addContactToGroup(accessToken, result.resourceName, groupId);
              // Small delay between group additions
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (groupError) {
              // Log but continue - contact was created successfully
              reportException(groupError, {
                context: "Adding contact to group after batch creation",
                tags: { component: "create-contact" },
                extra: { contactId: result.contactId, groupId },
                level: ErrorLevel.WARNING,
              });
            }
          }
        } catch (groupError) {
          // Log but don't fail - contacts were created successfully
          reportException(groupError, {
            context: "Adding contacts to group after batch creation",
            tags: { component: "create-contact" },
            extra: { groupId, contactCount: results.length },
            level: ErrorLevel.WARNING,
          });
        }
      }
    }

    return results;
  } catch (error) {
    reportException(error, {
      context: "Error batch creating contacts in People API",
      tags: { component: "create-contact" },
      extra: { contactCount: contacts.length },
    });
    throw error;
  }
}

