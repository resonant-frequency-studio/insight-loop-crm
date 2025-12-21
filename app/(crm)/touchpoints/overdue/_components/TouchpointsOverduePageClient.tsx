"use client";

import { useState } from "react";
import Card from "@/components/Card";
import ContactCard from "@/app/(crm)/_components/ContactCard";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import { getDaysUntilTouchpoint } from "@/util/date-utils-server";
import { Contact } from "@/types/firestore";
import { useAuth } from "@/hooks/useAuth";
import Pagination from "@/components/Pagination";
import EmptyState from "@/components/dashboard/EmptyState";
import ThemedSuspense from "@/components/ThemedSuspense";

interface ContactWithTouchpoint extends Contact {
  id: string;
  touchpointDate: Date;
  daysUntil: number;
  needsReminder: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function TouchpointsOverduePageClient() {
  const { user } = useAuth();
  const userId = user?.uid || null;
  const { contacts = [], loading: contactsLoading, hasConfirmedNoContacts } = useContactsRealtime(userId);
  const userIdString = user?.uid || "";
  const [currentPage, setCurrentPage] = useState(1);
  
  // Always render - no early returns
  // Show skeletons only when loading AND no contacts available
  const showSkeletons = contactsLoading && contacts.length === 0;

  const serverTime = new Date();

  const getTouchpointDate = (date: unknown): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === "string") return new Date(date);
    if (typeof date === "object" && "toDate" in date) {
      return (date as { toDate: () => Date }).toDate();
    }
    return null;
  };

  // Calculate 30 days ago for overdue touchpoint limit
  const thirtyDaysAgo = new Date(serverTime);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Filter and sort all overdue touchpoints
  const allOverdueTouchpoints: ContactWithTouchpoint[] = contacts
    .filter((contact) => {
      if (contact.archived) return false;
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;
      const status = contact.touchpointStatus;
      // Filter out completed, cancelled (skipped), and very old touchpoints
      if (status === "completed" || status === "cancelled") return false;
      // Only show overdue touchpoints within the last 30 days
      return touchpointDate < serverTime && touchpointDate >= thirtyDaysAgo;
    })
    .map((contact) => {
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate)!;
      const daysUntil = getDaysUntilTouchpoint(contact.nextTouchpointDate, serverTime) || 0;
      return {
        ...contact,
        id: contact.contactId,
        touchpointDate,
        daysUntil,
        needsReminder: false,
      };
    })
    .sort((a, b) => a.touchpointDate.getTime() - b.touchpointDate.getTime());

  // Paginate
  const totalPages = Math.ceil(allOverdueTouchpoints.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTouchpoints = allOverdueTouchpoints.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Overdue Touchpoints</h1>
        <p className="text-theme-dark text-lg">
          {allOverdueTouchpoints.length} touchpoint{allOverdueTouchpoints.length !== 1 ? "s" : ""} need your attention
        </p>
      </div>

      <Card padding="md">
        {showSkeletons ? (
          <ThemedSuspense isLoading={true} variant="list" />
        ) : contacts.length === 0 && hasConfirmedNoContacts ? (
          <EmptyState wrapInCard={false} size="lg" />
        ) : !contactsLoading && contacts.length > 0 && allOverdueTouchpoints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">🎉 You&apos;re all caught up! No overdue touchpoints.</p>
          </div>
        ) : allOverdueTouchpoints.length > 0 ? (
          <>
            {/* Top Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={allOverdueTouchpoints.length}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="touchpoint"
              onPageChange={setCurrentPage}
              hideItemCount={true}
            />

            <div className="grid grid-cols-1 gap-4 mb-6">
              {paginatedTouchpoints.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  variant="touchpoint-overdue"
                  showArrow={false}
                  touchpointDate={contact.touchpointDate}
                  daysUntil={contact.daysUntil}
                  needsReminder={false}
                  showTouchpointActions={true}
                  userId={userIdString}
                  onTouchpointStatusUpdate={() => {}}
                />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={allOverdueTouchpoints.length}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="touchpoint"
              onPageChange={setCurrentPage}
            />
          </>
        ) : null}
      </Card>
    </div>
  );
}

