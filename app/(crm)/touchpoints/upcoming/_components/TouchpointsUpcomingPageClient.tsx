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

export default function TouchpointsUpcomingPageClient() {
  const { user } = useAuth();
  const userId = user?.uid || "";
  const { data: contacts = [], isLoading: contactsLoading } = useContacts(userId);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Show loading state if contacts are loading (suspense mode)
  if (contactsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Upcoming Touchpoints</h1>
          <p className="text-theme-dark text-lg">Loading touchpoints...</p>
        </div>
        <Card padding="md">
          <ThemedSuspense isLoading={true} variant="list" />
        </Card>
      </div>
    );
  }
  
  // Show empty state only after loading completes AND there's no data
  if (!contactsLoading && contacts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Upcoming Touchpoints</h1>
          <p className="text-theme-dark text-lg">Touchpoints in the next 60 days</p>
        </div>
        <EmptyState wrapInCard={true} size="lg" />
      </div>
    );
  }

  const serverTime = new Date();
  const maxDaysAhead = 60;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

  const getTouchpointDate = (date: unknown): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === "string") return new Date(date);
    if (typeof date === "object" && "toDate" in date) {
      return (date as { toDate: () => Date }).toDate();
    }
    return null;
  };

  // Filter and sort all upcoming touchpoints
  const allUpcomingTouchpoints: ContactWithTouchpoint[] = contacts
    .filter((contact) => {
      if (contact.archived) return false;
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;
      const status = contact.touchpointStatus;
      if (status === "completed" || status === "cancelled") return false;
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
    .sort((a, b) => a.touchpointDate.getTime() - b.touchpointDate.getTime());

  // Paginate
  const totalPages = Math.ceil(allUpcomingTouchpoints.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTouchpoints = allUpcomingTouchpoints.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Upcoming Touchpoints</h1>
        <p className="text-theme-dark text-lg">
          {allUpcomingTouchpoints.length} touchpoint{allUpcomingTouchpoints.length !== 1 ? "s" : ""} in the next 60 days
        </p>
      </div>

      <Card padding="md">
        {paginatedTouchpoints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No upcoming touchpoints in the next 60 days.</p>
          </div>
        ) : (
          <>
            {/* Top Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={allUpcomingTouchpoints.length}
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
                  variant={contact.needsReminder ? "touchpoint-upcoming" : "touchpoint-upcoming"}
                  showArrow={false}
                  touchpointDate={contact.touchpointDate}
                  daysUntil={contact.daysUntil}
                  needsReminder={contact.needsReminder}
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
              totalItems={allUpcomingTouchpoints.length}
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

