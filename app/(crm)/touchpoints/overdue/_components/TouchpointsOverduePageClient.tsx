"use client";

import { useState } from "react";
import Card from "@/components/Card";
import ContactCard from "@/app/(crm)/_components/ContactCard";
import { useContacts } from "@/hooks/useContacts";
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
  const userId = user?.uid || "";
  const { data: contacts = [], isLoading: contactsLoading } = useContacts(userId);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Show loading state if contacts are loading (suspense mode)
  if (contactsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Overdue Touchpoints</h1>
          <p className="text-theme-dark text-lg">Loading touchpoints...</p>
        </div>
        <Card padding="md">
          <ThemedSuspense isLoading={true} variant="list" />
        </Card>
      </div>
    );
  }
  
  // Show empty state if no contacts
  if (contacts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Overdue Touchpoints</h1>
          <p className="text-theme-dark text-lg">Touchpoints that need your attention</p>
        </div>
        <EmptyState wrapInCard={true} size="lg" />
      </div>
    );
  }

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
        {paginatedTouchpoints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">🎉 You&apos;re all caught up! No overdue touchpoints.</p>
          </div>
        ) : (
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
                  userId={userId}
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
        )}
      </Card>
    </div>
  );
}

