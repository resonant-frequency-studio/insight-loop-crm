"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import Link from "next/link";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import SegmentChart from "@/components/charts/SegmentChart";
import LeadSourceChart from "@/components/charts/LeadSourceChart";
import EngagementChart from "@/components/charts/EngagementChart";
import TopTagsChart from "@/components/charts/TopTagsChart";
import SentimentChart from "@/components/charts/SentimentChart";
import { getInitials, getDisplayName, formatContactDate } from "@/util/contact-utils";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { contacts, stats, loading: statsLoading } = useDashboardStats(user?.uid || null);
  
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
  
  // Filter for upcoming touchpoints within the next 30 days
  const maxDaysAhead = 60;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);
  
  const contactsWithUpcomingTouchpoints = contacts
    .filter((contact) => {
      const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
      return touchpointDate && touchpointDate > now && touchpointDate <= maxDate;
    })
    .sort((a, b) => {
      const dateA = getTouchpointDate(a.nextTouchpointDate) || new Date(0);
      const dateB = getTouchpointDate(b.nextTouchpointDate) || new Date(0);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);
  
  // Get the 5 most recently updated contacts
  const recentContacts = contacts.slice(0, 5);

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
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Upcoming Touchpoints</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 mb-6">
              {contactsWithUpcomingTouchpoints.map((contact) => {
                const touchpointDate = getTouchpointDate(contact.nextTouchpointDate);
                return (
                  <Link
                    key={contact.id}
                    href={`/contacts/${contact.id}`}
                    className="block bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="shrink-0">
                        <div className="w-10 h-10 bg-linear-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                          {getInitials(contact)}
                        </div>
                      </div>
                      {/* Contact Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                            {getDisplayName(contact)}
                          </h3>
                          {touchpointDate && (
                            <span className="text-xs font-medium text-gray-700 bg-gray-200 px-2 py-1 rounded-md whitespace-nowrap shrink-0">
                              {touchpointDate > now 
                                ? formatContactDate(touchpointDate, { relative: true })
                                : `Due ${formatContactDate(touchpointDate, { relative: true })}`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate mb-2">{contact.primaryEmail}</p>
                        {contact.nextTouchpointMessage && (
                          <p className="text-xs text-gray-700 bg-white/80 rounded px-2 py-1.5 line-clamp-2">
                            {contact.nextTouchpointMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-gray-200 mb-6"></div>
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
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="block bg-gray-50 rounded-lg p-3 lg:p-4 hover:bg-gray-100 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-start lg:items-center gap-3">
                  {/* Avatar */}
                  <div className="shrink-0">
                    <div className="w-10 h-10 lg:w-10 lg:h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                      {getInitials(contact)}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm lg:text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {getDisplayName(contact)}
                    </h3>
                    <p className="text-xs lg:text-sm text-gray-500 truncate mb-1">{contact.primaryEmail}</p>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {contact.lastEmailDate != null && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <svg
                            className="w-3 h-3 shrink-0"
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
                          <span className="truncate">Last email: {formatContactDate(contact.lastEmailDate, { relative: true })}</span>
                        </p>
                      )}
                      {contact.updatedAt != null && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <svg
                            className="w-3 h-3 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          <span className="truncate">Updated: {formatContactDate(contact.updatedAt, { relative: true })}</span>
                        </p>
                      )}
                    </div>

                    {/* Tags - Mobile: show below, Desktop: show on right */}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 lg:hidden">
                        {contact.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 3 && (
                          <span className="px-2 py-0.5 text-xs font-medium text-gray-500">
                            +{contact.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tags - Desktop only */}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="hidden lg:flex flex-wrap gap-1 shrink-0 max-w-[200px] justify-end">
                      {contact.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span className="px-2 py-1 text-xs font-medium text-gray-500">
                          +{contact.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Arrow Icon - Desktop only */}
                  <div className="hidden lg:block shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
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
