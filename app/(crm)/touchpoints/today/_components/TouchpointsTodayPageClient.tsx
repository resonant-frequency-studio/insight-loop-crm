"use client";

import { useState } from "react";
import Card from "@/components/Card";
import ContactCard from "@/app/(crm)/_components/ContactCard";
import { useContacts } from "@/hooks/useContacts";
import { getDaysUntilTouchpoint } from "@/util/date-utils-server";
import { Contact } from "@/types/firestore";
import { useAuth } from "@/hooks/useAuth";
import Pagination from "@/components/Pagination";

interface ContactWithTouchpoint extends Contact {
  id: string;
  touchpointDate: Date;
  daysUntil: number;
  needsReminder: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function TouchpointsTodayPageClient() {
  const { user } = useAuth();
  const userId = user?.uid || "";
  const { data: contacts = [] } = useContacts(userId);
  const [currentPage, setCurrentPage] = useState(1);

  const serverTime = new Date();
  const todayStart = new Date(serverTime);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(serverTime);
  todayEnd.setHours(23, 59, 59, 999);

  const getTouchpointDate = (date: unknown): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === "string") return new Date(date);
    if (typeof date === "object" && "toDate" in date) {
      return (date as { toDate: () => Date }).toDate();
    }
    return null;
  };

  // Filter and sort all today's touchpoints
  const allTodayTouchpoints: ContactWithTouchpoint[] = contacts
    .filter((contact) => {
      if (contact.archived) return false;
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;
      const status = contact.touchpointStatus;
      if (status === "completed" || status === "cancelled") return false;
      return touchpointDate >= todayStart && touchpointDate <= todayEnd;
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
  const totalPages = Math.ceil(allTodayTouchpoints.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTouchpoints = allTodayTouchpoints.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Today&apos;s Touchpoints</h1>
        <p className="text-theme-dark text-lg">
          {allTodayTouchpoints.length} touchpoint{allTodayTouchpoints.length !== 1 ? "s" : ""} due today
        </p>
      </div>

      <Card padding="md">
        {paginatedTouchpoints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">🎉 You&apos;re all caught up! No touchpoints due today.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 mb-6">
              {paginatedTouchpoints.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  variant="touchpoint-upcoming"
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
              totalItems={allTodayTouchpoints.length}
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

