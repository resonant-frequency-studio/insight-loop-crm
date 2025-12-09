"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reportException } from "@/lib/error-reporting";

/**
 * Mutation hook to create an action item
 */
export function useCreateActionItem(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      text,
      dueDate,
    }: {
      contactId: string;
      text: string;
      dueDate?: Date | string | null;
    }) => {
      const response = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, text, dueDate }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create action item");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate by prefixes → guarantees matching all screen variations
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
    },
    onError: (error) => {
      reportException(error, {
        context: "Creating action item",
        tags: { component: "useCreateActionItem" },
      });
    },
  });
}

/**
 * Mutation hook to update an action item
 */
export function useUpdateActionItem(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      actionItemId,
      updates,
    }: {
      contactId: string;
      actionItemId: string;
      updates: {
        text?: string;
        status?: "pending" | "completed";
        dueDate?: Date | string | null;
      };
    }) => {
      const url = new URL("/api/action-items", window.location.origin);
      url.searchParams.set("contactId", contactId);
      url.searchParams.set("actionItemId", actionItemId);

      const response = await fetch(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update action item");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate by prefixes → guarantees matching all screen variations
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
    },
    onError: (error) => {
      reportException(error, {
        context: "Updating action item",
        tags: { component: "useUpdateActionItem" },
      });
    },
  });
}

/**
 * Mutation hook to delete an action item
 */
export function useDeleteActionItem(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      actionItemId,
    }: {
      contactId: string;
      actionItemId: string;
    }) => {
      const url = new URL("/api/action-items", window.location.origin);
      url.searchParams.set("contactId", contactId);
      url.searchParams.set("actionItemId", actionItemId);

      const response = await fetch(url.toString(), {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete action item");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate by prefixes → guarantees matching all screen variations
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
    },
    onError: (error) => {
      reportException(error, {
        context: "Deleting action item",
        tags: { component: "useDeleteActionItem" },
      });
    },
  });
}

