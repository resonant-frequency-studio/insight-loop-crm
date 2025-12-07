"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import Link from "next/link";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import SegmentChart from "@/components/charts/SegmentChart";
import LeadSourceChart from "@/components/charts/LeadSourceChart";
import EngagementChart from "@/components/charts/EngagementChart";
import TopTagsChart from "@/components/charts/TopTagsChart";
import SentimentChart from "@/components/charts/SentimentChart";
import ContactCard from "@/components/ContactCard";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { contacts, stats, loading: statsLoading } = useDashboardStats(user?.uid || null);
  const [selectedTouchpointIds, setSelectedTouchpointIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // Get contacts with upcoming touchpoints
  const now = new Date();
  
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


  // Helper function to get days until touchpoint
  const getDaysUntilTouchpoint = (date: unknown): number | null => {
    const touchpointDate = getTouchpointDate(date);
    if (!touchpointDate) return null;
    const diffMs = touchpointDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  // Helper function to check if touchpoint needs reminder (within 7 days)
  const needsReminder = (date: unknown): boolean => {
    const daysUntil = getDaysUntilTouchpoint(date);
    if (daysUntil === null) return false;
    return daysUntil <= 7 && daysUntil >= 0;
  };
  
  // Filter for upcoming touchpoints within the next 60 days (including overdue)
  const maxDaysAhead = 60;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);
  
  // Separate overdue and upcoming touchpoints
  const contactsWithOverdueTouchpoints = contacts
    .filter((contact) => {
      // Exclude archived contacts
      if (contact.archived) return false;
      
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;
      
      // Exclude completed or cancelled touchpoints
      const status = contact.touchpointStatus;
      if (status === "completed" || status === "cancelled") return false;
      
      // Only include overdue (past dates)
      return touchpointDate < now;
    })
    .sort((a, b) => {
      const dateA = getTouchpointDate(a.nextTouchpointDate) || new Date(0);
      const dateB = getTouchpointDate(b.nextTouchpointDate) || new Date(0);
      // Sort by most overdue first
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5); // Limit to 5 most overdue

  const contactsWithUpcomingTouchpoints = contacts
    .filter((contact) => {
      // Exclude archived contacts
      if (contact.archived) return false;
      
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      if (!touchpointDate) return false;
      
      // Exclude completed or cancelled touchpoints
      const status = contact.touchpointStatus;
      if (status === "completed" || status === "cancelled") return false;
      
      // Only include future dates (not overdue) within next 60 days
      return touchpointDate >= now && touchpointDate <= maxDate;
    })
    .sort((a, b) => {
      const dateA = getTouchpointDate(a.nextTouchpointDate) || new Date(0);
      const dateB = getTouchpointDate(b.nextTouchpointDate) || new Date(0);
      // Sort by soonest first
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5); // Limit to 5 soonest

  const toggleTouchpointSelection = (contactId: string) => {
    setSelectedTouchpointIds(prev => {
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
      const updates = selectedIds.map(contactId =>
        fetch(`/api/contacts/${encodeURIComponent(contactId)}/touchpoint-status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }).then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || "Update failed");
          }
          return res;
        })
      );

      const results = await Promise.allSettled(updates);
      const failures = results.filter(r => r.status === "rejected").length;
      const successCount = selectedIds.length - failures;

      // Clear selection immediately
      setSelectedTouchpointIds(new Set());

      if (failures > 0) {
        alert(`Updated ${successCount} of ${selectedIds.length} touchpoints. Some updates failed.`);
      } else {
        // Don't show alert for successful bulk updates - let the UI update naturally
        // The touchpoints will disappear from the list via real-time listener
      }
    } catch (error) {
      console.error("Error updating touchpoints:", error);
      alert("Failed to update touchpoints. Please try again.");
    } finally {
      setBulkUpdating(false);
    }
  };
  
  // Get the 5 most recently updated contacts (excluding archived)
  const recentContacts = contacts
    .filter((contact) => !contact.archived)
    .slice(0, 5);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || statsLoading) {
    return <Loading />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Welcome back, {user.displayName?.split(" ")[0] || "User"}!
        </h1>
        <p className="text-gray-600 text-lg">
          Here&apos;s what&apos;s happening with your contacts today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Contacts Card */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Total Contacts
            </h3>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalContacts}</div>
          <p className="text-sm text-gray-500">Active contacts in your CRM</p>
        </Card>

        {/* Contacts with Threads Card */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Active Threads
            </h3>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.contactsWithThreads}</div>
          <p className="text-sm text-gray-500">Contacts with email threads</p>
        </Card>

        {/* Average Engagement Score Card */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Avg Engagement
            </h3>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {stats.averageEngagementScore}
          </div>
          <p className="text-sm text-gray-500">Average engagement score</p>
        </Card>
      </div>

      {/* Recent Contacts Preview */}
      <Card padding="md">
        {/* Upcoming Touchpoints Section */}
        {contactsWithUpcomingTouchpoints.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Upcoming Touchpoints</h2>
              {contactsWithUpcomingTouchpoints.filter((c) => {
                const needsReminderBadge = needsReminder(c.nextTouchpointDate);
                return needsReminderBadge;
              }).length > 0 && (
                <span className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                  {contactsWithUpcomingTouchpoints.filter((c) => {
                    const needsReminderBadge = needsReminder(c.nextTouchpointDate);
                    return needsReminderBadge;
                  }).length} need attention
                </span>
              )}
            </div>
            
            {/* Select All Checkbox for Upcoming */}
            {contactsWithUpcomingTouchpoints.length > 0 && (
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactsWithUpcomingTouchpoints.every(c => selectedTouchpointIds.has(c.id))}
                    onChange={() => {
                      if (contactsWithUpcomingTouchpoints.every(c => selectedTouchpointIds.has(c.id))) {
                        // Deselect all upcoming
                        setSelectedTouchpointIds(prev => {
                          const newSet = new Set(prev);
                          contactsWithUpcomingTouchpoints.forEach(c => newSet.delete(c.id));
                          return newSet;
                        });
                      } else {
                        // Select all upcoming
                        setSelectedTouchpointIds(prev => {
                          const newSet = new Set(prev);
                          contactsWithUpcomingTouchpoints.forEach(c => newSet.add(c.id));
                          return newSet;
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select all {contactsWithUpcomingTouchpoints.length} upcoming touchpoint{contactsWithUpcomingTouchpoints.length !== 1 ? "s" : ""}
                  </span>
                </label>
              </div>
            )}

            {/* Bulk Action Bar for Upcoming */}
            {selectedTouchpointIds.size > 0 && contactsWithUpcomingTouchpoints.some(c => selectedTouchpointIds.has(c.id)) && (
              <Card padding="md" className="bg-blue-50 border-blue-200 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {Array.from(selectedTouchpointIds).filter(id => contactsWithUpcomingTouchpoints.some(c => c.id === id)).length} touchpoint{Array.from(selectedTouchpointIds).filter(id => contactsWithUpcomingTouchpoints.some(c => c.id === id)).length !== 1 ? "s" : ""} selected
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      }
                    >
                      Mark as Contacted ({Array.from(selectedTouchpointIds).filter(id => contactsWithUpcomingTouchpoints.some(c => c.id === id)).length})
                    </Button>
                    <Button
                      onClick={() => handleBulkStatusUpdate("cancelled")}
                      disabled={bulkUpdating}
                      loading={bulkUpdating}
                      variant="gradient-gray"
                      size="sm"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      }
                    >
                      Skip Touchpoint ({Array.from(selectedTouchpointIds).filter(id => contactsWithUpcomingTouchpoints.some(c => c.id === id)).length})
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-3 mb-6">
              {contactsWithUpcomingTouchpoints.map((contact) => {
                const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
                if (!touchpointDate) return null;
                
                const daysUntil = getDaysUntilTouchpoint(contact.nextTouchpointDate);
                const needsReminderBadge = needsReminder(contact.nextTouchpointDate);
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
                    touchpointDate={touchpointDate}
                    daysUntil={daysUntil}
                    needsReminder={needsReminderBadge}
                    showTouchpointActions={true}
                    onTouchpointStatusUpdate={() => {
                      // Refresh will happen automatically via real-time listener
                    }}
                  />
                );
              })}
            </div>
            <div className="border-t border-gray-200 mb-6"></div>
          </div>
        )}

        {/* Overdue Touchpoints Section */}
        {contactsWithOverdueTouchpoints.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-red-900">Overdue Touchpoints</h2>
              <span className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                {contactsWithOverdueTouchpoints.length} overdue
              </span>
            </div>
            
            {/* Select All Checkbox */}
            {contactsWithOverdueTouchpoints.length > 0 && (
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-red-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactsWithOverdueTouchpoints.every(c => selectedTouchpointIds.has(c.id))}
                    onChange={() => {
                      if (contactsWithOverdueTouchpoints.every(c => selectedTouchpointIds.has(c.id))) {
                        // Deselect all overdue
                        setSelectedTouchpointIds(prev => {
                          const newSet = new Set(prev);
                          contactsWithOverdueTouchpoints.forEach(c => newSet.delete(c.id));
                          return newSet;
                        });
                      } else {
                        // Select all overdue
                        setSelectedTouchpointIds(prev => {
                          const newSet = new Set(prev);
                          contactsWithOverdueTouchpoints.forEach(c => newSet.add(c.id));
                          return newSet;
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select all {contactsWithOverdueTouchpoints.length} overdue touchpoint{contactsWithOverdueTouchpoints.length !== 1 ? "s" : ""}
                  </span>
                </label>
              </div>
            )}

            {/* Bulk Action Bar */}
            {selectedTouchpointIds.size > 0 && contactsWithOverdueTouchpoints.some(c => selectedTouchpointIds.has(c.id)) && (
              <Card padding="md" className="bg-blue-50 border-blue-200 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {Array.from(selectedTouchpointIds).filter(id => contactsWithOverdueTouchpoints.some(c => c.id === id)).length} touchpoint{Array.from(selectedTouchpointIds).filter(id => contactsWithOverdueTouchpoints.some(c => c.id === id)).length !== 1 ? "s" : ""} selected
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      }
                    >
                      Mark as Contacted ({Array.from(selectedTouchpointIds).filter(id => contactsWithOverdueTouchpoints.some(c => c.id === id)).length})
                    </Button>
                    <Button
                      onClick={() => handleBulkStatusUpdate("cancelled")}
                      disabled={bulkUpdating}
                      loading={bulkUpdating}
                      variant="gradient-gray"
                      size="sm"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      }
                    >
                      Skip Touchpoint ({Array.from(selectedTouchpointIds).filter(id => contactsWithOverdueTouchpoints.some(c => c.id === id)).length})
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-3 mb-6">
              {contactsWithOverdueTouchpoints.map((contact) => {
                const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
                if (!touchpointDate) return null;
                
                const daysUntil = getDaysUntilTouchpoint(contact.nextTouchpointDate);
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
                    touchpointDate={touchpointDate}
                    daysUntil={daysUntil}
                    showTouchpointActions={true}
                    onTouchpointStatusUpdate={() => {
                      // Refresh will happen automatically via real-time listener
                    }}
                  />
                );
              })}
            </div>
            <div className="border-t border-red-200 mb-6"></div>
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Contacts</h2>
          <Link
            href="/contacts"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View all →
          </Link>
        </div>
        {recentContacts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="text-lg font-medium mb-2">No contacts yet</p>
            <p className="text-sm">
              Start by importing contacts from a CSV file or adding contacts manually
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {recentContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                showCheckbox={false}
                variant="default"
              />
            ))}
          </div>
        )}
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Segment Distribution Chart */}
        <Card padding="responsive">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-2 lg:mb-4">Contact Segments</h2>
          <SegmentChart data={stats.segmentDistribution} />
        </Card>

        {/* Lead Source Distribution Chart */}
        <Card padding="responsive">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-2 lg:mb-4">Lead Sources</h2>
          <LeadSourceChart data={stats.leadSourceDistribution} />
        </Card>

        {/* Engagement Levels Chart */}
        <Card className="px-3 pt-3 pb-2 lg:p-6">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-2 lg:mb-4">Engagement Levels</h2>
          <EngagementChart data={stats.engagementLevels} />
        </Card>

        {/* Sentiment Distribution Chart */}
        <Card padding="responsive">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-2 lg:mb-4">Sentiment Analysis</h2>
          <SentimentChart data={stats.sentimentDistribution} />
        </Card>
      </div>

      {/* Top Tags Chart - Full Width */}
      {Object.keys(stats.tagDistribution).length > 0 && (
        <Card padding="responsive">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-2 lg:mb-4">Top Tags</h2>
          <TopTagsChart data={stats.tagDistribution} />
        </Card>
      )}

      {/* Quick Actions */}
      <Card padding="md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/contacts"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                View All Contacts
              </h3>
              <p className="text-sm text-gray-500">Browse and manage your contact list</p>
            </div>
          </Link>

          <Link
            href="/contacts/import"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all duration-200 group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-green-200 transition-colors">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-green-700">
                Import Contacts
              </h3>
              <p className="text-sm text-gray-500">Import contacts from CSV file</p>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
}
