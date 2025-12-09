"use client";

import { useContacts } from "@/hooks/useContacts";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAuth } from "@/hooks/useAuth";
import { getDaysUntilTouchpoint } from "@/util/date-utils-server";
import { Contact } from "@/types/firestore";
import DashboardPageClient from "../DashboardPageClient";

interface ContactWithTouchpoint extends Contact {
  id: string;
  touchpointDate: Date;
  daysUntil: number;
  needsReminder: boolean;
}

export default function DashboardPageClientWrapper({ userId }: { userId: string }) {
  const { user, loading: authLoading } = useAuth();
  
  // Prioritize userId prop from SSR (production should always have this)
  // Only fallback to client auth if userId prop is empty (E2E mode)
  const effectiveUserId = userId || (!authLoading && user?.uid ? user.uid : "");
  
  // Debug: Always log to diagnose the issue
  console.log("[DashboardPageClientWrapper] RENDER - userId prop:", userId, "effectiveUserId:", effectiveUserId, "authLoading:", authLoading, "user:", user?.uid);
  
  const { data: contacts = [], isLoading: contactsLoading } = useContacts(effectiveUserId);
  const { data: stats, isLoading: statsLoading, status: statsStatus } = useDashboardStats(effectiveUserId);
  
  // Debug: log hook status
  console.log("[DashboardPageClientWrapper] HOOKS - statsStatus:", statsStatus, "statsLoading:", statsLoading, "hasStats:", !!stats, "hasContacts:", contacts.length, "effectiveUserId:", effectiveUserId);

  // Show loading if we don't have userId yet OR if stats are loading
  // In production, this should only be true briefly during initial render
  if (!effectiveUserId) {
    console.log("[DashboardPageClientWrapper] RETURNING NULL - no effectiveUserId");
    return null; // Suspense will handle loading
  }
  
  // If hooks are enabled but stats are loading, show loading
  // But if we have prefetched data, it should be available immediately
  if (statsLoading && !stats) {
    console.log("[DashboardPageClientWrapper] RETURNING NULL - statsLoading:", statsLoading, "hasStats:", !!stats);
    return null; // Suspense will handle loading
  }
  
  console.log("[DashboardPageClientWrapper] RENDERING - effectiveUserId:", effectiveUserId, "hasStats:", !!stats, "hasContacts:", contacts.length);

  // Use consistent server time for all calculations
  const serverTime = new Date();

  // Helper function to safely get touchpoint date
  const getTouchpointDate = (date: unknown): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === "string") return new Date(date);
    if (typeof date === "object" && "toDate" in date) {
      return (date as { toDate: () => Date }).toDate();
    }
    return null;
  };

  // Filter for upcoming touchpoints within the next 60 days (including overdue)
  const maxDaysAhead = 60;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

  // Separate overdue and upcoming touchpoints
  const contactsWithOverdueTouchpoints: ContactWithTouchpoint[] = contacts
    .filter((contact) => {
      // Exclude archived contacts
      if (contact.archived) return false;

      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;

      // Exclude completed or cancelled touchpoints
      const status = contact.touchpointStatus;
      if (status === "completed" || status === "cancelled") return false;

      // Only include overdue (past dates)
      return touchpointDate < serverTime;
    })
    .map((contact) => {
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate)!;
      const daysUntil = getDaysUntilTouchpoint(contact.nextTouchpointDate, serverTime) || 0;
      const needsReminder = daysUntil <= 7 && daysUntil >= 0;

      return {
        ...contact,
        id: contact.contactId,
        touchpointDate,
        daysUntil,
        needsReminder: false, // Overdue don't need reminder badge
      };
    })
    .sort((a, b) => {
      // Sort by most overdue first
      return a.touchpointDate.getTime() - b.touchpointDate.getTime();
    })
    .slice(0, 5); // Limit to 5 most overdue

  const contactsWithUpcomingTouchpoints: ContactWithTouchpoint[] = contacts
    .filter((contact) => {
      // Exclude archived contacts
      if (contact.archived) return false;

      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;

      // Exclude completed or cancelled touchpoints
      const status = contact.touchpointStatus;
      if (status === "completed" || status === "cancelled") return false;

      // Only include future dates (not overdue) within next 60 days
      return touchpointDate >= serverTime && touchpointDate <= maxDate;
    })
    .map((contact) => {
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate)!;
      const daysUntil = getDaysUntilTouchpoint(contact.nextTouchpointDate, serverTime) || 0;
      const needsReminder = daysUntil <= 7 && daysUntil >= 0;

      return {
        ...contact,
        id: contact.contactId,
        touchpointDate,
        daysUntil,
        needsReminder,
      };
    })
    .sort((a, b) => {
      // Sort by soonest first
      return a.touchpointDate.getTime() - b.touchpointDate.getTime();
    })
    .slice(0, 5); // Limit to 5 soonest

  // Get the 5 most recently updated contacts (excluding archived)
  const recentContacts = contacts
    .filter((contact) => !contact.archived)
    .map((contact) => ({
      ...contact,
      id: contact.contactId,
    }))
    .slice(0, 5);

  return (
    <DashboardPageClient
      userId={effectiveUserId}
      initialStats={stats}
      contactsWithUpcomingTouchpoints={contactsWithUpcomingTouchpoints}
      contactsWithOverdueTouchpoints={contactsWithOverdueTouchpoints}
      recentContacts={recentContacts}
    />
  );
}

