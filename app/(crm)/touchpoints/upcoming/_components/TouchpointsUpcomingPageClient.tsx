"use client";

import { useState } from "react";
import Card from "@/components/Card";
import ContactCard from "@/app/(crm)/_components/ContactCard";
import { useContacts } from "@/hooks/useContacts";
import { getDaysUntilTouchpoint } from "@/util/date-utils-server";
import { Contact } from "@/types/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/Button";

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
  const { data: contacts = [] } = useContacts(userId);
  const [currentPage, setCurrentPage] = useState(1);

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
            <div className="grid grid-cols-1 gap-3 mb-6">
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-theme-darker">
                  Showing {startIndex + 1} to {Math.min(endIndex, allUpcomingTouchpoints.length)} of{" "}
                  {allUpcomingTouchpoints.length} touchpoints
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4 text-sm text-theme-darker">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

