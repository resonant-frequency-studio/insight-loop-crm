"use client";

import ThemedSuspense from "@/components/ThemedSuspense";
import Card from "@/components/Card";
import ContactCard from "./ContactCard";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import { getDaysUntilTouchpoint } from "@/util/date-utils-server";
import { Contact } from "@/types/firestore";
import { useUpdateTouchpointStatus } from "@/hooks/useContactMutations";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { reportException } from "@/lib/error-reporting";
import ViewAllLink from "@/components/ViewAllLink";
import TouchpointBulkActions from "./TouchpointBulkActions";
import Checkbox from "@/components/Checkbox";
import EmptyState from "@/components/dashboard/EmptyState";

interface ContactWithTouchpoint extends Contact {
  id: string;
  touchpointDate: Date;
  daysUntil: number;
  needsReminder: boolean;
}

function TouchpointsContent({ userId }: { userId: string }) {
  const { user } = useAuth();
  const { contacts = [], loading: contactsLoading } = useContactsRealtime(userId);
  const [selectedTouchpointIds, setSelectedTouchpointIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const updateTouchpointStatusMutation = useUpdateTouchpointStatus(user?.uid);
  
  // Always render - show skeletons only when loading AND no contacts available
  // If contacts exist (even from cache), show them immediately
  const showSkeletons = contactsLoading && contacts.length === 0;

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
      const failures = results.filter((r) => r.status === "rejected");
      const failureCount = failures.length;
      const successCount = selectedIds.length - failureCount;

      // Report all failures to Sentry
      failures.forEach((result, index) => {
        if (result.status === "rejected") {
          reportException(result.reason, {
            context: "Bulk updating touchpoint status in DashboardTouchpoints",
            tags: { 
              component: "DashboardTouchpoints", 
              contactId: selectedIds[index],
              status,
            },
          });
        }
      });

      setSelectedTouchpointIds(new Set());

      if (failureCount > 0) {
        alert(
          `Updated ${successCount} of ${selectedIds.length} touchpoints. Some updates failed.`
        );
      }
    } catch (error) {
      reportException(error, {
        context: "Bulk updating touchpoint status in DashboardTouchpoints",
        tags: { component: "DashboardTouchpoints", status },
      });
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

  // Calculate 30 and 60 days ago for filtering
  const thirtyDaysAgo = new Date(serverTime);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(serverTime);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Get today's date boundaries
  const todayStart = new Date(serverTime);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(serverTime);
  todayEnd.setHours(23, 59, 59, 999);

  // Filter for due today
  const contactsWithTodayTouchpoints: ContactWithTouchpoint[] = contacts
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
    .sort((a, b) => a.touchpointDate.getTime() - b.touchpointDate.getTime())
    .slice(0, 3);

  const contactsWithOverdueTouchpoints: ContactWithTouchpoint[] = contacts
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
    .sort((a, b) => a.touchpointDate.getTime() - b.touchpointDate.getTime())
    .slice(0, 3);

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
    .slice(0, 3);

  // Filter for recently active contacts (within 30-60 days)
  const getLastEmailDate = (date: unknown): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === "string") return new Date(date);
    if (typeof date === "object" && "toDate" in date) {
      return (date as { toDate: () => Date }).toDate();
    }
    return null;
  };

  const recentContacts = contacts
    .filter((contact) => {
      if (contact.archived) return false;
      const lastEmail = getLastEmailDate(contact.lastEmailDate);
      // Include contacts with last interaction within the last 30 days (primary window)
      // OR last interaction within 30-60 days (secondary window) if has active threads
      if (lastEmail) {
        // Primary: last interaction within last 30 days
        if (lastEmail >= thirtyDaysAgo) {
          return true;
        }
        // Secondary: last interaction within 30-60 days AND has active threads
        if (lastEmail >= sixtyDaysAgo && contact.threadCount && contact.threadCount > 0) {
          return true;
        }
      }
      return false;
    })
    .map((contact) => ({
      ...contact,
      id: contact.contactId,
    }))
    .slice(0, 5);

  const renderBulkActions = (contactList: ContactWithTouchpoint[]) => {
    const selectedInSection = Array.from(selectedTouchpointIds).filter((id) =>
      contactList.some((c) => c.id === id)
    );

    return (
      <TouchpointBulkActions
        selectedCount={selectedInSection.length}
        onMarkAsContacted={() => handleBulkStatusUpdate("completed")}
        onSkip={() => handleBulkStatusUpdate("cancelled")}
        isLoading={bulkUpdating}
      />
    );
  };

  // Calculate total counts for headers
  const totalTodayCount = contacts.filter((contact) => {
    if (contact.archived) return false;
    const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
    if (!touchpointDate) return false;
    const status = contact.touchpointStatus;
    if (status === "completed" || status === "cancelled") return false;
    return touchpointDate >= todayStart && touchpointDate <= todayEnd;
  }).length;

  const totalOverdueCount = contacts.filter((contact) => {
    if (contact.archived) return false;
    const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
    if (!touchpointDate) return false;
    const status = contact.touchpointStatus;
    // Filter out completed, cancelled (skipped), and very old touchpoints
    if (status === "completed" || status === "cancelled") return false;
    // Only count overdue touchpoints within the last 30 days
    return touchpointDate < serverTime && touchpointDate >= thirtyDaysAgo;
  }).length;

  const totalUpcomingCount = contacts.filter((contact) => {
    if (contact.archived) return false;
    const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
    if (!touchpointDate) return false;
    const status = contact.touchpointStatus;
    if (status === "completed" || status === "cancelled") return false;
    return touchpointDate >= serverTime && touchpointDate <= maxDate;
  }).length;

  const totalTodayPriorities = totalTodayCount + totalOverdueCount;

  // Always render - no early returns
  return (
    <div className="space-y-6">
      {/* Today's Priorities - Combined Section */}
      {(contactsWithTodayTouchpoints.length > 0 || contactsWithOverdueTouchpoints.length > 0) && (
        <Card padding="sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-theme-darkest break-words">
                Your Touchpoints This Week ({totalTodayPriorities} touchpoints scheduled)
              </h2>
              <p className="text-xs text-theme-dark mt-1">
                Includes past due and upcoming touchpoints.
              </p>
            </div>
            <div className="flex-shrink-0">
              <ViewAllLink href="/touchpoints/today" />
            </div>
          </div>

          {/* Select All Checkbox for Today's Priorities */}
          {(contactsWithTodayTouchpoints.length > 0 || contactsWithOverdueTouchpoints.length > 0) && (
            <div className="flex items-start gap-2 sm:gap-3 pb-3 mb-3 border-b border-gray-200">
              <Checkbox
                checked={
                  [...contactsWithTodayTouchpoints, ...contactsWithOverdueTouchpoints].every((c) =>
                    selectedTouchpointIds.has(c.id)
                  ) && [...contactsWithTodayTouchpoints, ...contactsWithOverdueTouchpoints].length > 0
                }
                onChange={() => {
                  const allTodayPriorities = [...contactsWithTodayTouchpoints, ...contactsWithOverdueTouchpoints];
                  const allSelected = allTodayPriorities.every((c) => selectedTouchpointIds.has(c.id));
                  
                  setSelectedTouchpointIds((prev) => {
                    const newSet = new Set(prev);
                    if (allSelected) {
                      allTodayPriorities.forEach((c) => newSet.delete(c.id));
                    } else {
                      allTodayPriorities.forEach((c) => newSet.add(c.id));
                    }
                    return newSet;
                  });
                }}
                label={`Select all ${contactsWithTodayTouchpoints.length + contactsWithOverdueTouchpoints.length} priorit${contactsWithTodayTouchpoints.length + contactsWithOverdueTouchpoints.length === 1 ? "y" : "ies"} for bulk actions`}
                labelClassName="text-xs sm:text-sm font-medium text-theme-darker break-words flex-1 min-w-0 leading-tight"
              />
            </div>
          )}

          {/* Bulk Actions for Today's Priorities */}
          {renderBulkActions(
            [...contactsWithTodayTouchpoints, ...contactsWithOverdueTouchpoints]
          )}

          {/* Due Today Subsection */}
          {contactsWithTodayTouchpoints.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h3 className="text-sm font-medium text-theme-darker mb-2 sm:mb-3">Due Today</h3>
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {contactsWithTodayTouchpoints.map((contact) => {
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
                      userId={userId}
                      onTouchpointStatusUpdate={() => {}}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Overdue Subsection */}
          {contactsWithOverdueTouchpoints.length > 0 && (
            <div className={contactsWithTodayTouchpoints.length > 0 ? "border-t border-gray-200 pt-4 sm:pt-6" : ""}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-medium text-theme-darkest">Past due</h3>
                <div className="flex-shrink-0">
                  <ViewAllLink href="/touchpoints/overdue" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
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
                      userId={userId}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {contactsWithTodayTouchpoints.length === 0 && contactsWithOverdueTouchpoints.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-theme-dark">🎉 You&apos;re all caught up today!</p>
            </div>
          )}
        </Card>
      )}

      {/* Upcoming Touchpoints */}
      {contactsWithUpcomingTouchpoints.length > 0 && (
        <Card padding="sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-theme-darkest break-words">
              Upcoming ({totalUpcomingCount} total)
            </h2>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {contactsWithUpcomingTouchpoints.filter((c) => c.needsReminder).length > 0 && (
                <span className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full whitespace-nowrap">
                  {contactsWithUpcomingTouchpoints.filter((c) => c.needsReminder).length} need attention
                </span>
              )}
              <div className="flex-shrink-0">
                <ViewAllLink href="/touchpoints/upcoming" />
              </div>
            </div>
          </div>

          {contactsWithUpcomingTouchpoints.length > 0 && (
            <div className="flex items-start gap-2 sm:gap-3 pb-3 mb-3 border-b border-gray-200">
              <Checkbox
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
                label={`Select all ${contactsWithUpcomingTouchpoints.length} upcoming touchpoint${contactsWithUpcomingTouchpoints.length !== 1 ? "s" : ""}`}
                labelClassName="text-xs sm:text-sm font-medium text-theme-darker break-words flex-1 min-w-0 leading-tight"
              />
            </div>
          )}

          {renderBulkActions(contactsWithUpcomingTouchpoints)}

          <div className="grid grid-cols-1 gap-3 sm:gap-4">
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
                  userId={userId}
                  onTouchpointStatusUpdate={() => {}}
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Recently Active - Always render */}
      <Card padding="sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-theme-darkest">Recently Active</h2>
          {!showSkeletons && recentContacts.length > 0 && (
            <div className="flex-shrink-0">
              <ViewAllLink href="/contacts" />
            </div>
          )}
        </div>
        {showSkeletons ? (
          <ThemedSuspense isLoading={true} variant="list" />
        ) : recentContacts.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {recentContacts.map((contact) => (
              <ContactCard key={contact.contactId} contact={{ ...contact, id: contact.contactId }} showArrow={true} userId={userId} />
            ))}
          </div>
        ) : (
          <EmptyState
            message="No recent activity yet"
            description="When you reconnect, it will show here."
            showActions={false}
            wrapInCard={false}
            size="sm"
          />
        )}
      </Card>
    </div>
  );
}

export default function DashboardTouchpoints({ userId }: { userId: string }) {
  return (
    <ThemedSuspense
      fallback={
        <Card padding="sm" className="animate-pulse">
          <div className="h-6 bg-card-highlight-light rounded w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-card-highlight-light rounded-sm">
                <div className="w-12 h-12 bg-theme-light rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-theme-light rounded w-2/3" />
                  <div className="h-4 bg-theme-light rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      }
    >
      <TouchpointsContent userId={userId} />
    </ThemedSuspense>
  );
}

