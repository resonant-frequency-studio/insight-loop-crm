"use client";

import { Suspense } from "react";
import Card from "@/components/Card";
import ContactCard from "./ContactCard";
import { useContacts } from "@/hooks/useContacts";
import { getDaysUntilTouchpoint } from "@/util/date-utils-server";
import { Contact } from "@/types/firestore";
import { useUpdateTouchpointStatus } from "@/hooks/useContactMutations";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Button } from "@/components/Button";
import Link from "next/link";

interface ContactWithTouchpoint extends Contact {
  id: string;
  touchpointDate: Date;
  daysUntil: number;
  needsReminder: boolean;
}

function TouchpointsContent({ userId }: { userId: string }) {
  const { user } = useAuth();
  const { data: contacts = [] } = useContacts(userId);
  const [selectedTouchpointIds, setSelectedTouchpointIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const updateTouchpointStatusMutation = useUpdateTouchpointStatus(user?.uid);

  const toggleTouchpointSelection = (contactId: string) => {
    setSelectedTouchpointIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleBulkStatusUpdate = async (status: "completed" | "cancelled") => {
    if (selectedTouchpointIds.size === 0) return;

    const selectedIds = Array.from(selectedTouchpointIds);
    setBulkUpdating(true);

    try {
      const updates = selectedIds.map((contactId) =>
        updateTouchpointStatusMutation.mutateAsync({
          contactId,
          status,
        })
      );

      const results = await Promise.allSettled(updates);
      const failures = results.filter((r) => r.status === "rejected").length;
      const successCount = selectedIds.length - failures;

      setSelectedTouchpointIds(new Set());

      if (failures > 0) {
        alert(
          `Updated ${successCount} of ${selectedIds.length} touchpoints. Some updates failed.`
        );
      }
    } catch (error) {
      alert("Failed to update touchpoints. Please try again.");
    } finally {
      setBulkUpdating(false);
    }
  };

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

  const maxDaysAhead = 60;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

  const contactsWithOverdueTouchpoints: ContactWithTouchpoint[] = contacts
    .filter((contact) => {
      if (contact.archived) return false;
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;
      const status = contact.touchpointStatus;
      if (status === "completed" || status === "cancelled") return false;
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
        needsReminder: false,
      };
    })
    .sort((a, b) => a.touchpointDate.getTime() - b.touchpointDate.getTime())
    .slice(0, 5);

  const contactsWithUpcomingTouchpoints: ContactWithTouchpoint[] = contacts
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
      return {
        ...contact,
        id: contact.contactId,
        touchpointDate,
        daysUntil,
        needsReminder: daysUntil <= 7 && daysUntil >= 0,
      };
    })
    .sort((a, b) => a.touchpointDate.getTime() - b.touchpointDate.getTime())
    .slice(0, 5);

  const recentContacts = contacts
    .filter((contact) => !contact.archived)
    .map((contact) => ({
      ...contact,
      id: contact.contactId,
    }))
    .slice(0, 5);

  const renderBulkActions = (contactList: ContactWithTouchpoint[], sectionType: "upcoming" | "overdue") => {
    const selectedInSection = Array.from(selectedTouchpointIds).filter((id) =>
      contactList.some((c) => c.id === id)
    );

    if (selectedInSection.length === 0) return null;

    return (
      <Card padding="md" className="bg-blue-50 border-blue-200 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-900">
              {selectedInSection.length} touchpoint{selectedInSection.length !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleBulkStatusUpdate("completed")}
              disabled={bulkUpdating}
              loading={bulkUpdating}
              variant="gradient-green"
              size="sm"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            >
              Mark as Contacted ({selectedInSection.length})
            </Button>
            <Button
              onClick={() => handleBulkStatusUpdate("cancelled")}
              disabled={bulkUpdating}
              loading={bulkUpdating}
              variant="gradient-gray"
              size="sm"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
            >
              Skip Touchpoint ({selectedInSection.length})
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Card padding="md">
      {contactsWithUpcomingTouchpoints.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Upcoming Touchpoints</h2>
            {contactsWithUpcomingTouchpoints.filter((c) => c.needsReminder).length > 0 && (
              <span className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                {contactsWithUpcomingTouchpoints.filter((c) => c.needsReminder).length} need attention
              </span>
            )}
          </div>

          {contactsWithUpcomingTouchpoints.length > 0 && (
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactsWithUpcomingTouchpoints.every((c) => selectedTouchpointIds.has(c.id))}
                  onChange={() => {
                    if (contactsWithUpcomingTouchpoints.every((c) => selectedTouchpointIds.has(c.id))) {
                      setSelectedTouchpointIds((prev) => {
                        const newSet = new Set(prev);
                        contactsWithUpcomingTouchpoints.forEach((c) => newSet.delete(c.id));
                        return newSet;
                      });
                    } else {
                      setSelectedTouchpointIds((prev) => {
                        const newSet = new Set(prev);
                        contactsWithUpcomingTouchpoints.forEach((c) => newSet.add(c.id));
                        return newSet;
                      });
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select all {contactsWithUpcomingTouchpoints.length} upcoming touchpoint
                  {contactsWithUpcomingTouchpoints.length !== 1 ? "s" : ""}
                </span>
              </label>
            </div>
          )}

          {renderBulkActions(contactsWithUpcomingTouchpoints, "upcoming")}

          <div className="grid grid-cols-1 gap-3 mb-6">
            {contactsWithUpcomingTouchpoints.map((contact) => {
              const isSelected = selectedTouchpointIds.has(contact.id);
              return (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  showCheckbox={true}
                  isSelected={isSelected}
                  onSelectChange={toggleTouchpointSelection}
                  variant={isSelected ? "selected" : "touchpoint-upcoming"}
                  showArrow={false}
                  touchpointDate={contact.touchpointDate}
                  daysUntil={contact.daysUntil}
                  needsReminder={contact.needsReminder}
                  showTouchpointActions={true}
                  onTouchpointStatusUpdate={() => {}}
                />
              );
            })}
          </div>
          <div className="border-t border-gray-200 mb-6"></div>
        </div>
      )}

      {contactsWithOverdueTouchpoints.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-red-900">Overdue Touchpoints</h2>
            <span className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
              {contactsWithOverdueTouchpoints.length} overdue
            </span>
          </div>

          {contactsWithOverdueTouchpoints.length > 0 && (
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-red-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactsWithOverdueTouchpoints.every((c) => selectedTouchpointIds.has(c.id))}
                  onChange={() => {
                    if (contactsWithOverdueTouchpoints.every((c) => selectedTouchpointIds.has(c.id))) {
                      setSelectedTouchpointIds((prev) => {
                        const newSet = new Set(prev);
                        contactsWithOverdueTouchpoints.forEach((c) => newSet.delete(c.id));
                        return newSet;
                      });
                    } else {
                      setSelectedTouchpointIds((prev) => {
                        const newSet = new Set(prev);
                        contactsWithOverdueTouchpoints.forEach((c) => newSet.add(c.id));
                        return newSet;
                      });
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select all {contactsWithOverdueTouchpoints.length} overdue touchpoint
                  {contactsWithOverdueTouchpoints.length !== 1 ? "s" : ""}
                </span>
              </label>
            </div>
          )}

          {renderBulkActions(contactsWithOverdueTouchpoints, "overdue")}

          <div className="grid grid-cols-1 gap-3 mb-6">
            {contactsWithOverdueTouchpoints.map((contact) => {
              const isSelected = selectedTouchpointIds.has(contact.id);
              return (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  showCheckbox={true}
                  isSelected={isSelected}
                  onSelectChange={toggleTouchpointSelection}
                  variant={isSelected ? "selected" : "touchpoint-overdue"}
                  showArrow={false}
                  touchpointDate={contact.touchpointDate}
                  daysUntil={contact.daysUntil}
                  needsReminder={false}
                  showTouchpointActions={true}
                  onTouchpointStatusUpdate={() => {}}
                />
              );
            })}
          </div>
          <div className="border-t border-gray-200 mb-6"></div>
        </div>
      )}

      {recentContacts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Contacts</h2>
            <Link href="/contacts" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {recentContacts.map((contact) => (
              <ContactCard key={contact.contactId} contact={{ ...contact, id: contact.contactId }} showArrow={true} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DashboardTouchpoints({ userId }: { userId: string }) {
  return (
    <Suspense
      fallback={
        <Card padding="md" className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      }
    >
      <TouchpointsContent userId={userId} />
    </Suspense>
  );
}

