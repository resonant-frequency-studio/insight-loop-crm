"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ContactWithTouchpoint } from "@/lib/touchpoints-server";
import { getUIMode } from "@/lib/ui-mode";

/**
 * Hook to fetch today's touchpoints (up to 3)
 */
export function useDashboardTodayTouchpoints(userId: string) {
  const query = useQuery({
    queryKey: ["dashboard-touchpoints", userId, "today"],
    queryFn: async () => {
      const response = await fetch("/api/touchpoints/today?limit=3");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch today touchpoints");
      }
      const data = await response.json();
      return data.touchpoints as ContactWithTouchpoint[];
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });

  const uiMode = getUIMode();

  return useMemo(() => {
    if (uiMode === "suspense") {
      return { ...query, data: undefined, isLoading: true };
    }
    if (uiMode === "empty") {
      return { ...query, data: [], isLoading: false };
    }
    return query;
  }, [query, uiMode]);
}

/**
 * Hook to fetch overdue touchpoints (up to 3)
 */
export function useDashboardOverdueTouchpoints(userId: string) {
  const query = useQuery({
    queryKey: ["dashboard-touchpoints", userId, "overdue"],
    queryFn: async () => {
      const response = await fetch("/api/touchpoints/overdue?limit=3");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch overdue touchpoints");
      }
      const data = await response.json();
      return data.touchpoints as ContactWithTouchpoint[];
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });

  const uiMode = getUIMode();

  return useMemo(() => {
    if (uiMode === "suspense") {
      return { ...query, data: undefined, isLoading: true };
    }
    if (uiMode === "empty") {
      return { ...query, data: [], isLoading: false };
    }
    return query;
  }, [query, uiMode]);
}

/**
 * Hook to fetch upcoming touchpoints (up to 3)
 */
export function useDashboardUpcomingTouchpoints(userId: string) {
  const query = useQuery({
    queryKey: ["dashboard-touchpoints", userId, "upcoming"],
    queryFn: async () => {
      const response = await fetch("/api/touchpoints/upcoming?limit=3");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch upcoming touchpoints");
      }
      const data = await response.json();
      return data.touchpoints as ContactWithTouchpoint[];
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });

  const uiMode = getUIMode();

  return useMemo(() => {
    if (uiMode === "suspense") {
      return { ...query, data: undefined, isLoading: true };
    }
    if (uiMode === "empty") {
      return { ...query, data: [], isLoading: false };
    }
    return query;
  }, [query, uiMode]);
}

