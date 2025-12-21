"use client";

import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import { useAuth } from "@/hooks/useAuth";
import { getDaysUntilTouchpoint } from "@/util/date-utils-server";
import { Contact } from "@/types/firestore";
import DashboardPageClient from "../DashboardPageClient";
import ThemedSuspense from "@/components/ThemedSuspense";

interface ContactWithTouchpoint extends Contact {
  id: string;
  touchpointDate: Date;
  daysUntil: number;
  needsReminder: boolean;
}

export default function DashboardPageClientWrapper() {
  const { user, loading: authLoading } = useAuth();
  
  // Get userId from auth (no longer passed as prop from SSR)
  const effectiveUserId = !authLoading && user?.uid ? user.uid : null;
  
  // Use Firebase real-time listeners
  const { contacts, loading: contactsLoading } = useContactsRealtime(effectiveUserId);

  // Show loading if we don't have userId yet OR if contacts are loading (initial load)
  // Once contacts load, real-time updates happen silently
  if (!effectiveUserId || (contactsLoading && contacts.length === 0)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Welcome back!</h1>
          <p className="text-theme-dark text-lg">Loading dashboard...</p>
        </div>
        <ThemedSuspense isLoading={true} variant="dashboard" />
      </div>
    );
  }

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
      contacts={contacts}
      contactsWithUpcomingTouchpoints={contactsWithUpcomingTouchpoints}
      contactsWithOverdueTouchpoints={contactsWithOverdueTouchpoints}
      recentContacts={recentContacts}
    />
  );
}

