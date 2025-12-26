import { reportException } from "@/lib/error-reporting";

export interface ContactGroup {
  resourceName: string;
  groupType: string;
  name: string;
  formattedName?: string;
  memberCount?: number;
}

export interface ContactGroupsListResponse {
  contactGroups?: ContactGroup[];
  nextPageToken?: string;
}

export interface CreateContactGroupResponse {
  contactGroup: ContactGroup;
}

/**
 * List all contact groups from Google People API
 */
export async function listContactGroups(accessToken: string): Promise<ContactGroup[]> {
  const allGroups: ContactGroup[] = [];
  let pageToken: string | undefined;

  do {
    try {
      let url = "https://people.googleapis.com/v1/contactGroups?pageSize=1000";
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `People API listContactGroups failed: ${response.status} ${response.statusText}`
        );
        reportException(error, {
          context: "Listing contact groups",
          tags: { component: "contact-groups", status: String(response.status) },
          extra: { errorText },
        });
        throw error;
      }

      const data: ContactGroupsListResponse = await response.json();

      if (data.contactGroups) {
        // Filter out system groups (like "My Contacts", "Starred", etc.)
        // User-created groups have groupType === "USER_CONTACT_GROUP"
        const userGroups = data.contactGroups.filter(
          (group) => group.groupType === "USER_CONTACT_GROUP"
        );
        allGroups.push(...userGroups);
      }

      pageToken = data.nextPageToken;
    } catch (error) {
      reportException(error, {
        context: "Error listing contact groups from People API",
        tags: { component: "contact-groups" },
      });
      throw error;
    }
  } while (pageToken);

  return allGroups;
}

/**
 * Create a new contact group in Google Contacts
 */
export async function createContactGroup(
  accessToken: string,
  groupName: string
): Promise<ContactGroup> {
  try {
    const response = await fetch("https://people.googleapis.com/v1/contactGroups", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactGroup: {
          name: groupName,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: { code?: number; message?: string; status?: string } = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // If parsing fails, use the raw error text
      }
      
      const error = new Error(
        `People API createContactGroup failed: ${response.status} ${response.statusText}`
      );
      // Add the status code and error details to the error object for easier handling
      interface ErrorWithStatus extends Error {
        statusCode?: number;
        errorData?: { code?: number; message?: string; status?: string };
      }
      (error as ErrorWithStatus).statusCode = response.status;
      (error as ErrorWithStatus).errorData = errorData;
      
      reportException(error, {
        context: "Creating contact group",
        tags: { component: "contact-groups", status: String(response.status) },
        extra: { errorText, groupName, errorData },
      });
      throw error;
    }

    const data: CreateContactGroupResponse = await response.json();
    return data.contactGroup;
  } catch (error) {
    reportException(error, {
      context: "Error creating contact group in People API",
      tags: { component: "contact-groups" },
      extra: { groupName },
    });
    throw error;
  }
}

/**
 * Add a contact to a contact group
 */
export async function addContactToGroup(
  accessToken: string,
  contactResourceName: string,
  groupId: string
): Promise<void> {
  try {
    // The groupId should be the resourceName (e.g., "contactGroups/123456789")
    const response = await fetch(
      `https://people.googleapis.com/v1/${groupId}/members:modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceNamesToAdd: [contactResourceName],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(
        `People API addContactToGroup failed: ${response.status} ${response.statusText}`
      );
      reportException(error, {
        context: "Adding contact to group",
        tags: { component: "contact-groups", status: String(response.status) },
        extra: { errorText, contactResourceName, groupId },
      });
      throw error;
    }
  } catch (error) {
    reportException(error, {
      context: "Error adding contact to group in People API",
      tags: { component: "contact-groups" },
      extra: { contactResourceName, groupId },
    });
    throw error;
  }
}

