"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { ErrorMessage, extractApiError, extractErrorMessage } from "@/components/ErrorMessage";
import { ActionItem } from "@/types/firestore";
import { formatContactDate } from "@/util/contact-utils";
import Link from "next/link";

type FilterStatus = "all" | "pending" | "completed";
type FilterDate = "all" | "overdue" | "today" | "thisWeek" | "upcoming";

export default function ActionItemsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [actionItems, setActionItems] = useState<
    Array<ActionItem & { contactId: string; contactName?: string }>
  >([]);
  const [contacts, setContacts] = useState<
    Map<string, { firstName?: string; lastName?: string; primaryEmail: string }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterDate, setFilterDate] = useState<FilterDate>("all");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(() => {
    // Check localStorage for persisted quota status
    if (typeof window !== "undefined") {
      return localStorage.getItem("firestoreQuotaExceeded") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load contacts
  useEffect(() => {
    if (!user?.uid) return;

    const contactsQuery = query(collection(db, `users/${user.uid}/contacts`));

    const unsubscribe = onSnapshot(contactsQuery, (snapshot) => {
      const contactsMap = new Map();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        contactsMap.set(doc.id, {
          firstName: data.firstName,
          lastName: data.lastName,
          primaryEmail: data.primaryEmail,
        });
      });
      setContacts(contactsMap);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Fetch action items function (memoized so it can be called manually)
  const fetchAllActionItems = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Don't fetch if quota is already exceeded - prevents repeated failed requests
    if (quotaExceeded) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/action-items/all");
      
      // Check for quota errors BEFORE trying to parse response
      if (response.status === 429) {
        setQuotaExceeded(true);
        if (typeof window !== "undefined") {
          localStorage.setItem("firestoreQuotaExceeded", "true");
        }
        setCompleteError("Database quota exceeded. Please wait a few hours or upgrade your plan.");
        setActionItems([]);
        setLoading(false);
        return; // Stop here, don't throw
      }
      
      if (!response.ok) {
        const errorMessage = await extractApiError(response);
        // Check if it's a quota error
        if (errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
          setQuotaExceeded(true);
          if (typeof window !== "undefined") {
            localStorage.setItem("firestoreQuotaExceeded", "true");
          }
          setCompleteError("Database quota exceeded. Please wait a few hours or upgrade your plan.");
          setActionItems([]);
          setLoading(false);
          return; // Stop here, don't throw
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      const items = data.actionItems || [];

      // Get contact names for each action item
      const itemsWithContactNames = await Promise.all(
        items.map(async (item: ActionItem & { contactId: string }) => {
          const contact = contacts.get(item.contactId);
          const contactName = contact
            ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
              contact.primaryEmail
            : "Unknown Contact";
          return { ...item, contactName };
        })
      );

      setActionItems(itemsWithContactNames);
      setLoading(false);
      // Reset quota status if successful
      setQuotaExceeded(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("firestoreQuotaExceeded");
      }
    } catch (error) {
      console.error("Error fetching action items:", error);
      const errorMessage = extractErrorMessage(error);
      // Check for quota errors in catch block too
      if (errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        setQuotaExceeded(true);
        if (typeof window !== "undefined") {
          localStorage.setItem("firestoreQuotaExceeded", "true");
        }
        setCompleteError("Database quota exceeded. Please wait a few hours or upgrade your plan.");
        setActionItems([]);
        setLoading(false);
        return; // Stop here
      }
      setActionItems([]);
      setLoading(false);
    }
    // Note: quotaExceeded is NOT in dependencies to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, contacts]);

  // Load action items on mount and when dependencies change
  useEffect(() => {
    fetchAllActionItems();
    // No polling - only fetch on mount or when user/contacts change
    // Updates will be triggered manually after create/update/delete operations
  }, [fetchAllActionItems]);

  const handleComplete = async (item: ActionItem & { contactId: string }) => {
    setCompleting(item.actionItemId);
    setCompleteError(null);
    try {
      const response = await fetch(
        `/api/action-items?contactId=${item.contactId}&actionItemId=${item.actionItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        }
      );

      if (!response.ok) {
        const errorMessage = await extractApiError(response);
        throw new Error(errorMessage);
      }
      setCompleteError(null);
      // Clear quota flag to allow refresh attempt after successful operation
      setQuotaExceeded(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("firestoreQuotaExceeded");
      }
      // Refresh action items
      fetchAllActionItems();
    } catch (error) {
      console.error("Error completing action item:", error);
      setCompleteError(extractErrorMessage(error));
    } finally {
      setCompleting(null);
    }
  };

  const handleDelete = async (item: ActionItem & { contactId: string }) => {
    if (!confirm("Are you sure you want to delete this action item?")) {
      return;
    }

    setDeleting(item.actionItemId);
    setDeleteError(null);
    try {
      const response = await fetch(
        `/api/action-items?contactId=${item.contactId}&actionItemId=${item.actionItemId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorMessage = await extractApiError(response);
        throw new Error(errorMessage);
      }
      setDeleteError(null);
      // Clear quota flag to allow refresh attempt after successful operation
      setQuotaExceeded(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("firestoreQuotaExceeded");
      }
      // Refresh action items
      fetchAllActionItems();
    } catch (error) {
      console.error("Error deleting action item:", error);
      setDeleteError(extractErrorMessage(error));
    } finally {
      setDeleting(null);
    }
  };

  const getDateCategory = (dueDate: unknown): string => {
    if (!dueDate) return "upcoming";

    let date: Date;
    if (dueDate instanceof Date) {
      date = dueDate;
    } else if (typeof dueDate === "string") {
      // Handle ISO date strings (with or without time)
      const dateStr = dueDate.split("T")[0]; // Get just the date part
      date = new Date(dateStr + "T00:00:00"); // Add time to avoid timezone issues
      if (isNaN(date.getTime())) {
        console.warn("Invalid date string:", dueDate);
        return "upcoming";
      }
    } else if (typeof dueDate === "object" && "toDate" in dueDate) {
      date = (dueDate as { toDate: () => Date }).toDate();
    } else {
      return "upcoming";
    }

    const now = new Date();
    // Normalize to midnight for date comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Compare dates (ignoring time)
    if (due < today) return "overdue";
    if (due.getTime() === today.getTime()) return "today";

    const daysDiff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) return "thisWeek";
    return "upcoming";
  };

  const isOverdue = (dueDate: unknown): boolean => {
    const category = getDateCategory(dueDate);
    return category === "overdue";
  };

  const filteredItems = actionItems.filter((item) => {
    // Status filter
    if (filterStatus !== "all" && item.status !== filterStatus) {
      return false;
    }

    // Contact filter
    if (selectedContactId && item.contactId !== selectedContactId) {
      return false;
    }

    // Date filter
    if (filterDate !== "all" && item.status === "pending") {
      const category = getDateCategory(item.dueDate);
      if (filterDate === "overdue" && category !== "overdue") return false;
      if (filterDate === "today" && category !== "today") return false;
      if (filterDate === "thisWeek" && !["today", "thisWeek"].includes(category)) return false;
      if (filterDate === "upcoming" && category === "overdue") return false;
    } else if (filterDate !== "all" && item.status === "completed") {
      return false; // Don't show completed items in date filters
    }

    return true;
  });

  const pendingItems = actionItems.filter((i) => i.status === "pending");
  const overdueItems = pendingItems.filter((i) => isOverdue(i.dueDate));
  const overdueCount = overdueItems.length;
  const todayCount = pendingItems.filter((i) => getDateCategory(i.dueDate) === "today").length;

  // Debug: Log overdue items for troubleshooting
  useEffect(() => {
    if (actionItems.length > 0 && !loading) {
      console.log("Action Items Debug:", {
        total: actionItems.length,
        pending: pendingItems.length,
        overdue: overdueCount,
        overdueItems: overdueItems.map((i) => ({
          text: i.text.substring(0, 30),
          dueDate: i.dueDate,
          status: i.status,
          category: getDateCategory(i.dueDate),
        })),
        itemsWithDueDates: actionItems.filter((i) => i.dueDate).length,
        samplePendingItem: pendingItems[0] ? {
          text: pendingItems[0].text.substring(0, 30),
          dueDate: pendingItems[0].dueDate,
          dueDateType: typeof pendingItems[0].dueDate,
        } : null,
      });
    }
  }, [actionItems, pendingItems, overdueCount, overdueItems, loading]);

  if (authLoading || loading) {
    return <Loading />;
  }

  if (!user) {
    return null;
  }

  const uniqueContactIds = Array.from(new Set(actionItems.map((i) => i.contactId)));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Action Items</h1>
        <p className="text-gray-600 text-lg">
          Manage tasks and action items across all your contacts
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-sm font-medium text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{actionItems.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-blue-600">{pendingItems.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm font-medium text-gray-500 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm font-medium text-gray-500 mb-1">Due Today</p>
          <p className="text-2xl font-bold text-amber-600">{todayCount}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Date
            </label>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value as FilterDate)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="thisWeek">Due This Week</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Contact
            </label>
            <select
              value={selectedContactId || ""}
              onChange={(e) => setSelectedContactId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Contacts</option>
              {uniqueContactIds.map((contactId) => {
                const contact = contacts.get(contactId);
                const name = contact
                  ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                    contact.primaryEmail
                  : "Unknown";
                return (
                  <option key={contactId} value={contactId}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </Card>

      {/* Action Items List */}
      <Card padding="md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {filteredItems.length} Action Item{filteredItems.length !== 1 ? "s" : ""}
        </h2>
        {filteredItems.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No action items match your filters
          </p>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const contact = contacts.get(item.contactId);
              const contactName = contact
                ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                  contact.primaryEmail
                : "Unknown Contact";
              const overdue = isOverdue(item.dueDate);

              return (
                <div
                  key={`${item.contactId}_${item.actionItemId}`}
                  className={`p-4 rounded-lg border ${
                    item.status === "completed"
                      ? "bg-gray-50 border-gray-200"
                      : overdue
                      ? "bg-red-50 border-red-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Button
                      onClick={() => handleComplete(item)}
                      disabled={
                        item.status === "completed" ||
                        completing === item.actionItemId
                      }
                      loading={completing === item.actionItemId}
                      variant="ghost"
                      size="sm"
                      className={`mt-0.5 w-5 h-5 p-0 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        item.status === "completed"
                          ? "bg-green-500 border-green-500 hover:bg-green-500"
                          : "border-gray-300 hover:border-green-500 bg-transparent"
                      }`}
                      title={item.status === "completed" ? "Mark as pending" : "Mark as completed"}
                      icon={
                        item.status === "completed" ? (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : undefined
                      }
                    >
                      <span className="sr-only">
                        {item.status === "completed" ? "Mark as pending" : "Mark as completed"}
                      </span>
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <p
                          className={`text-sm font-medium ${
                            item.status === "completed"
                              ? "text-gray-500 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {item.text}
                        </p>
                        {item.status === "pending" && (
                          <Button
                            onClick={() => handleDelete(item)}
                            disabled={deleting === item.actionItemId}
                            loading={deleting === item.actionItemId}
                            variant="ghost"
                            size="sm"
                            className="p-1 text-gray-400 hover:text-red-600 shrink-0"
                            title="Delete"
                            icon={
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            }
                          >
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <Link
                          href={`/contacts/${encodeURIComponent(item.contactId)}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                        >
                          {contactName}
                        </Link>
                        {item.dueDate ? (
                          <span
                            className={
                              overdue && item.status === "pending"
                                ? "text-red-600 font-medium"
                                : ""
                            }
                          >
                            Due: {String(formatContactDate(item.dueDate, { relative: true }))}
                            {overdue && item.status === "pending" && " (Overdue)"}
                          </span>
                        ) : null}
                        {item.status === "completed" && item.completedAt ? (
                          <span>
                            Completed: {String(formatContactDate(item.completedAt, { relative: true }))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {(completeError || deleteError) && (
          <div className="mt-4 space-y-2">
            {completeError && (
              <ErrorMessage
                message={completeError}
                dismissible
                onDismiss={() => setCompleteError(null)}
              />
            )}
            {deleteError && (
              <ErrorMessage
                message={deleteError}
                dismissible
                onDismiss={() => setDeleteError(null)}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

