"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reportException } from "@/lib/error-reporting";
import { Contact } from "@/types/firestore";

/**
 * Mutation hook to create a new contact
 */
export function useCreateContact(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactData: Partial<Contact>) => {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create contact");
      }

      const data = await response.json();
      return data.contactId as string;
    },
    onSuccess: () => {
      // Invalidate by prefixes → guarantees matching all screen variations
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error) => {
      reportException(error, {
        context: "Creating contact",
        tags: { component: "useCreateContact" },
      });
    },
  });
}

/**
 * Mutation hook to update a contact
 */
export function useUpdateContact(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      updates,
    }: {
      contactId: string;
      updates: Partial<Contact>;
    }) => {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update contact");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate by prefixes → guarantees matching all screen variations
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error) => {
      reportException(error, {
        context: "Updating contact",
        tags: { component: "useUpdateContact" },
      });
    },
  });
}

/**
 * Mutation hook to update contact outreach draft
 */
export function useUpdateContactDraft(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      outreachDraft,
    }: {
      contactId: string;
      outreachDraft: string | null;
    }) => {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreachDraft }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update outreach draft");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate by prefixes → guarantees matching all screen variations
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error) => {
      reportException(error, {
        context: "Updating outreach draft",
        tags: { component: "useUpdateContactDraft" },
      });
    },
  });
}

/**
 * Mutation hook to delete a contact
 */
export function useDeleteContact(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete contact");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate by prefixes → guarantees matching all screen variations
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
    },
    onError: (error) => {
      reportException(error, {
        context: "Deleting contact",
        tags: { component: "useDeleteContact" },
      });
    },
  });
}

/**
 * Mutation hook to archive/unarchive a contact
 */
export function useArchiveContact(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, archived }: { contactId: string; archived: boolean }) => {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to archive contact");
      }

      return response.json();
    },

    /**
     * OPTIMISTIC UPDATE
     */
    onMutate: async ({ contactId, archived }) => {
      // Cancel ALL queries that could overwrite optimistic state
      await queryClient.cancelQueries({ queryKey: ["contact"], exact: false });
      await queryClient.cancelQueries({ queryKey: ["contacts"], exact: false });

      // Snapshot previous values
      const prevDetail = queryClient.getQueryData<Contact>(["contact", userId, contactId]);
      const prevList = queryClient.getQueryData<Contact[]>(["contacts", userId]);

      // Optimistically update ALL contact detail queries
      queryClient.setQueriesData<Contact>(["contact"], (old) => {
        if (!old) return old;
        if (old.contactId !== contactId) return old;
        return { ...old, archived };
      });

      // Optimistically update ALL contact list queries
      queryClient.setQueriesData<Contact[]>(["contacts"], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((c) =>
          c.contactId === contactId ? { ...c, archived } : c
        );
      });

      return { prevDetail, prevList };
    },

    /**
     * ROLLBACK ON ERROR
     */
    onError: (error, _vars, ctx) => {
      if (ctx?.prevDetail) {
        queryClient.setQueryData(["contact", userId, _vars.contactId], ctx.prevDetail);
      }

      if (ctx?.prevList) {
        queryClient.setQueryData(["contacts", userId], ctx.prevList);
      }

      reportException(error, {
        context: "Archiving contact",
        tags: { component: "useArchiveContact" },
      });
    },

    /**
     * FINAL REFRESH
     */
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: ["contact"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["contacts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"], exact: false });
    },
  });
}


/**
 * Mutation hook to update touchpoint status
 */
export function useUpdateTouchpointStatus(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      status,
      reason,
    }: {
      contactId: string;
      status: "pending" | "completed" | "cancelled" | null;
      reason?: string | null;
    }) => {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(contactId)}/touchpoint-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reason }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Throw user-friendly error message - will be extracted by component
        const errorMessage = errorData.error || "Failed to update touchpoint status. Please try again.";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return { ...data, contactId, status, reason };
    },
    onMutate: async ({ contactId, status, reason }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      if (userId) {
        await queryClient.cancelQueries({ queryKey: ["contact", userId, contactId] });
        await queryClient.cancelQueries({ queryKey: ["contacts", userId] });
      } else {
        await queryClient.cancelQueries({ queryKey: ["contact"] });
        await queryClient.cancelQueries({ queryKey: ["contacts"] });
      }

      // Snapshot previous value
      const previousContact = userId
        ? queryClient.getQueryData<Contact>(["contact", userId, contactId])
        : queryClient.getQueryData<Contact>(["contact"]);

      const previousContacts = userId
        ? queryClient.getQueryData<Contact[]>(["contacts", userId])
        : queryClient.getQueryData<Contact[]>(["contacts"]);

      const now = new Date().toISOString();

      // Optimistically update the contact
      if (userId) {
        queryClient.setQueryData<Contact>(["contact", userId, contactId], (old) => {
          if (!old) return old;
          return {
            ...old,
            touchpointStatus: status,
            touchpointStatusUpdatedAt: status !== null ? now : null,
            touchpointStatusReason: reason !== undefined ? reason : old.touchpointStatusReason,
            updatedAt: now,
          };
        });

        // Also update in contacts list
        queryClient.setQueryData<Contact[]>(["contacts", userId], (old) => {
          if (!old) return old;
          return old.map((contact) =>
            contact.contactId === contactId
              ? {
                  ...contact,
                  touchpointStatus: status,
                  touchpointStatusUpdatedAt: status !== null ? now : null,
                  touchpointStatusReason: reason !== undefined ? reason : contact.touchpointStatusReason,
                  updatedAt: now,
                }
              : contact
          );
        });
      }

      return { previousContact, previousContacts };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (userId) {
        if (context?.previousContact) {
          queryClient.setQueryData(["contact", userId, variables.contactId], context.previousContact);
        }
        if (context?.previousContacts) {
          queryClient.setQueryData(["contacts", userId], context.previousContacts);
        }
      }
      reportException(error, {
        context: "Updating touchpoint status",
        tags: { component: "useUpdateTouchpointStatus" },
      });
    },
    onSuccess: () => {
      // Optimistic update from onMutate is the source of truth
      // DO NOT overwrite it with server data - it's already correct and user sees it immediately
      // Only invalidate dashboard stats (needs recalculation), not contact queries
      // This ensures button text and UI state persist and don't flash/revert
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      }, 100);
    },
  });
}

/**
 * Mutation hook for bulk archiving contacts
 */
export function useBulkArchiveContacts(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      archived,
    }: {
      contactIds: string[];
      archived: boolean;
    }) => {
      const response = await fetch("/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, archived }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to bulk archive contacts");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate by prefixes → guarantees matching all screen variations
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error) => {
      reportException(error, {
        context: "Bulk archiving contacts",
        tags: { component: "useBulkArchiveContacts" },
      });
    },
  });
}

