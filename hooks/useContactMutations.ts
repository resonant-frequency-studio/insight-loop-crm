"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reportException } from "@/lib/error-reporting";
import { Contact } from "@/types/firestore";

/**
 * Mutation hook to create a new contact
 */
export function useCreateContact() {
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
 * 
 * 🔧 HARDENED VERSION:
 * - Updates ALL contacts lists regardless of cache key shape
 * - Handles contactId vs id vs _id mismatches
 * - Works even if userId is not provided
 */
export function useUpdateContact(userId?: string) {
  const queryClient = useQueryClient();

  // Defensive contact matcher - handles contactId, id, or _id fields
  const isSameContact = (c: Contact, contactId: string): boolean => {
    return (
      c.contactId === contactId ||
      (c as Contact & { id?: string; _id?: string }).id === contactId ||
      (c as Contact & { id?: string; _id?: string })._id === contactId
    );
  };

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

      const data = await response.json();
      return data.contact as Contact; // API now returns { contact: Contact }
    },
    /**
     * OPTIMISTIC UPDATE
     * Immediately update both detail and ALL list caches so UI feels instant
     */
    onMutate: async ({ contactId, updates }: { contactId: string; updates: Partial<Contact> }) => {
      // Cancel all related queries
      await queryClient.cancelQueries({ queryKey: ["contact"], exact: false });
      await queryClient.cancelQueries({ queryKey: ["contacts"], exact: false });

      // Snapshot previous detail state (for this specific user+contact, if such a query exists)
      const prevDetail = userId
        ? queryClient.getQueryData<Contact>(["contact", userId, contactId])
        : undefined;

      // Snapshot ALL contacts lists (regardless of key shape)
      const prevLists: Record<string, Contact[]> = {};
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["contacts"], exact: false })
        .forEach((q) => {
          const key = JSON.stringify(q.queryKey);
          const data = q.state.data as Contact[] | undefined;
          if (data) prevLists[key] = data;
        });

      // Optimistically update detail (if userId provided)
      if (userId) {
        queryClient.setQueryData<Contact>(["contact", userId, contactId], (old) =>
          old ? { ...old, ...updates } : old
        );
      }

      // Optimistically update ALL contacts lists (regardless of key shape)
      queryClient.setQueriesData<Contact[]>({ queryKey: ["contacts"], exact: false }, (old) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((c) => (isSameContact(c, contactId) ? { ...c, ...updates } : c));
      });

      return { prevDetail, prevLists };
    },
    /**
     * SUCCESS — update detail only & delay list invalidation
     * Firestore eventual consistency means list queries might not see the update immediately
     * So we invalidate after a delay to let Firestore propagate the change
     */
    onSuccess: (updatedContact, variables) => {
      const { contactId } = variables;

      // Update detail cache with actual server result
      if (userId) {
        queryClient.setQueryData<Contact>(
          ["contact", userId, contactId],
          updatedContact
        );
      }

      
      queryClient.invalidateQueries({ queryKey: ["contacts"], exact: false });
      // Invalidate dashboard stats to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"], exact: false });
    },
    /**
     * Roll back if error
     */
    onError: (error, variables, context) => {
      // Restore detail (if userId provided)
      if (userId && context?.prevDetail) {
        queryClient.setQueryData(
          ["contact", userId, variables.contactId],
          context.prevDetail
        );
      }

      // Restore ALL contacts lists
      if (context?.prevLists) {
        for (const [key, data] of Object.entries(context.prevLists)) {
          queryClient.setQueryData(JSON.parse(key), data);
        }
      }

      reportException(error, {
        context: "Updating contact",
        tags: { component: "useUpdateContact" },
      });
    },
  });
}

/**
 * Mutation hook to delete a contact
 */
export function useDeleteContact() {
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
    mutationFn: async ({
      contactId,
      archived,
    }: {
      contactId: string;
      archived: boolean;
    }) => {
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
     * Immediately update the cache so UI feels instant
     */
    onMutate: async ({ contactId, archived }: { contactId: string; archived: boolean }) => {
      if (!userId) return;

        await queryClient.cancelQueries({ queryKey: ["contact"] });
        await queryClient.cancelQueries({ queryKey: ["contacts"] });

      // Snapshot previous value for rollback
      const prev = queryClient.getQueryData<Contact>(["contact", userId, contactId]);

      // Update cache immediately - UI updates instantly
        queryClient.setQueryData<Contact>(["contact", userId, contactId], (old) => {
          if (!old) return old;
        return { ...old, archived };
        });

        // Also update in contacts list
        queryClient.setQueryData<Contact[]>(["contacts", userId], (old) => {
          if (!old) return old;
        return old.map((c) =>
          c.contactId === contactId ? { ...c, archived } : c
          );
        });

      return { prev };
    },
    /**
     * Roll back if error
     */
    onError: (error, variables, context) => {
      if (userId && context?.prev) {
        queryClient.setQueryData(["contact", userId, variables.contactId], context.prev);
      }
      reportException(error, {
        context: "Archiving contact",
        tags: { component: "useArchiveContact" },
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["contact"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
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
    /**
     * OPTIMISTIC UPDATE
     * Immediately update the cache so UI feels instant
     */
    onMutate: async ({ contactId, status, reason }) => {
      if (!userId) return;

      // Cancel outgoing refetches to avoid overwriting optimistic update
        await queryClient.cancelQueries({ queryKey: ["contact", userId, contactId] });
        await queryClient.cancelQueries({ queryKey: ["contacts", userId] });

      // Snapshot previous value for rollback
      const prev = queryClient.getQueryData<Contact>(["contact", userId, contactId]);

      // Update cache immediately - UI updates instantly
        queryClient.setQueryData<Contact>(["contact", userId, contactId], (old) => {
          if (!old) return old;
          return {
            ...old,
            touchpointStatus: status,
          touchpointStatusUpdatedAt: status !== null ? new Date().toISOString() : null,
            touchpointStatusReason: reason !== undefined ? reason : old.touchpointStatusReason,
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
                touchpointStatusUpdatedAt: status !== null ? new Date().toISOString() : null,
                  touchpointStatusReason: reason !== undefined ? reason : contact.touchpointStatusReason,
                }
              : contact
          );
        });

      return { prev };
    },
    /**
     * Roll back if error
     */
    onError: (error, variables, context) => {
      if (userId && context?.prev) {
        queryClient.setQueryData(["contact", userId, variables.contactId], context.prev);
      }
      reportException(error, {
        context: "Updating touchpoint status",
        tags: { component: "useUpdateTouchpointStatus" },
      });
    },
    /**
     * Invalidate after success to ensure server consistency
     */
    onSettled: (_data, _error, vars) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ["contact", userId, vars.contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

/**
 * Mutation hook for bulk archiving contacts
 */
export function useBulkArchiveContacts() {
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

/**
 * Mutation hook for bulk updating contact segments
 */
export function useBulkUpdateSegments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      segment,
    }: {
      contactIds: string[];
      segment: string | null;
    }) => {
      const response = await fetch("/api/contacts/bulk-segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, segment }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to bulk update segments");
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
        context: "Bulk updating contact segments",
        tags: { component: "useBulkUpdateSegments" },
      });
    },
  });
}

/**
 * Mutation hook for bulk updating contact tags
 */
export function useBulkUpdateTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      tags,
    }: {
      contactIds: string[];
      tags: string[];
    }) => {
      const response = await fetch("/api/contacts/bulk-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, tags }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to bulk update tags");
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
        context: "Bulk updating contact tags",
        tags: { component: "useBulkUpdateTags" },
      });
    },
  });
}

/**
 * Mutation hook for bulk updating contact companies
 */
export function useBulkUpdateCompanies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      company,
    }: {
      contactIds: string[];
      company: string | null;
    }) => {
      const response = await fetch("/api/contacts/bulk-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, company }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to bulk update companies");
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
        context: "Bulk updating contact companies",
        tags: { component: "useBulkUpdateCompanies" },
      });
    },
  });
}

