"use client";

import { useState } from "react";
import ThemedSuspense from "@/components/ThemedSuspense";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/hooks/useAuth";
import { useContactsSyncJob } from "@/hooks/useContactsSyncJob";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { ErrorMessage, extractErrorMessage } from "@/components/ErrorMessage";
import { reportException } from "@/lib/error-reporting";
import { SyncJob } from "@/types/firestore";
import EmptyState from "@/components/dashboard/EmptyState";
import Modal from "@/components/Modal";

interface SyncPageClientProps {
  userId: string;
  initialLastSync: SyncJob | null;
  initialSyncHistory: SyncJob[];
}

export default function SyncPageClient({
  userId,
  initialLastSync,
  initialSyncHistory,
}: SyncPageClientProps) {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.uid || "";
  // Use real-time hook for updates
  const { lastSync: realtimeLastSync, syncHistory: realtimeSyncHistory, error, loading: syncLoading } = useSyncStatus(userId);
  const { data: contacts = [], isLoading: contactsLoading } = useContacts(effectiveUserId);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [calendarSyncError, setCalendarSyncError] = useState<string | null>(null);
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [contactsSyncError, setContactsSyncError] = useState<string | null>(null);
  const [currentContactsSyncJobId, setCurrentContactsSyncJobId] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Track the current contacts sync job if one is running
  const { syncJob: contactsSyncJob } = useContactsSyncJob(
    userId || null,
    currentContactsSyncJobId
  );

  // Use real-time data if available, otherwise fall back to initial data
  const lastSync = realtimeLastSync || initialLastSync;
  const syncHistory = realtimeSyncHistory.length > 0 ? realtimeSyncHistory : initialSyncHistory;
  
  // Show loading state if either is loading (suspense mode)
  if (contactsLoading || syncLoading) {
    return <ThemedSuspense isLoading={true} variant="sync" />;
  }
  
  // Show empty state only after loading completes AND there's no data
  if (!contactsLoading && !syncLoading && contacts.length === 0) {
    return <EmptyState wrapInCard={true} size="lg" />;
  }

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncError(null);

    try {
      const response = await fetch("/api/gmail/sync?type=auto");
      
      // Check if response is OK before parsing JSON
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Sync failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Parse JSON response with error handling
      let data;
      try {
        const text = await response.text();
        if (!text || text.trim() === "") {
          throw new Error("Empty response from server");
        }
        data = JSON.parse(text);
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          throw new Error("Invalid response from server. Please try again.");
        }
        throw parseError;
      }

      if (!data.ok) {
        const errorMessage = data.error || "Sync failed";
        throw new Error(errorMessage);
      }

      // Status will update automatically via real-time listener
      setSyncError(null);
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      setSyncError(errorMessage);
      reportException(error, {
        context: "Manual sync error",
        tags: { component: "SyncPageClient" },
      });
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (date: unknown): string => {
    if (!date) return "N/A";
    
    if (date instanceof Date) {
      return date.toLocaleString();
    }
    
    if (typeof date === "object" && "toDate" in date) {
      return (date as { toDate: () => Date }).toDate().toLocaleString();
    }
    
    if (typeof date === "string" || typeof date === "number") {
      return new Date(date).toLocaleString();
    }
    
    return "Invalid date";
  };

  const handleClearHistory = async () => {
    setClearingHistory(true);
    setClearError(null);
    setShowClearConfirm(false);

    try {
      const response = await fetch("/api/sync-jobs/clear", {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to clear sync history");
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to clear sync history");
      }

      // History will update automatically via real-time listener
      setClearError(null);
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      setClearError(errorMessage);
      reportException(error, {
        context: "Clear sync history error",
        tags: { component: "SyncPageClient" },
      });
    } finally {
      setClearingHistory(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "text-green-600 bg-green-50 border-green-200";
      case "running":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "error":
        return "text-red-600 bg-red-50 border-red-200";
      case "pending":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default:
        return "text-theme-dark bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* Clear History Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Sync History"
        closeOnBackdropClick={!clearingHistory}
      >
        <p className="text-theme-dark mb-6">
          Are you sure you want to clear sync history? This will keep only the most recent sync job. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => setShowClearConfirm(false)}
            disabled={clearingHistory}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleClearHistory}
            disabled={clearingHistory}
            loading={clearingHistory}
            variant="danger"
            size="sm"
            error={clearError}
          >
            Clear History
          </Button>
        </div>
      </Modal>

      {/* Sync Gmail Button - Static, renders immediately */}
      <Card padding="md" className="bg-sync-blue-bg border-sync-blue-border">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-sync-blue-text-primary mb-1">Sync Gmail</h3>
            <div className="text-xs text-sync-blue-text-secondary mb-3">
              <p className="mb-1">Fetches new email threads from your Gmail account and links them to your contacts. This will:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Download recent email threads (or all threads if this is your first sync)</li>
                <li>Match emails to existing contacts by email address</li>
                <li>Store email messages and thread metadata in your CRM</li>
                <li>Update contact last email dates and thread counts</li>
              </ul>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              onClick={handleManualSync}
              disabled={syncing}
              loading={syncing}
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              icon={
                <svg
                  className="w-5 h-5"
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
              }
            >
              Sync Gmail
            </Button>
          </div>
        </div>
        {syncError && (
          <ErrorMessage
            message={syncError}
            dismissible
            onDismiss={() => setSyncError(null)}
            className="mt-3"
          />
        )}
      </Card>

      {/* Sync Calendar Button - Static, renders immediately */}
      <Card padding="md" className="bg-sync-purple-bg border-sync-purple-border">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-sync-purple-text-primary mb-1">Sync Calendar</h3>
            <div className="text-xs text-sync-purple-text-secondary mb-3">
              <p className="mb-1">Imports calendar events from your Google Calendar and links them to your contacts. This will:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Fetch calendar events from the past 30-180 days (depending on sync type)</li>
                <li>Match events to contacts by email addresses in attendee lists</li>
                <li>Create calendar event records linked to your contacts</li>
                <li>Extract meeting insights and action items from event descriptions</li>
              </ul>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              onClick={async () => {
                setSyncingCalendar(true);
                setCalendarSyncError(null);
                try {
                  const response = await fetch('/api/calendar/sync', { 
                    method: 'POST',
                    credentials: 'include',
                  });
                  const data = await response.json();
                  if (!data.ok) {
                    setCalendarSyncError(data.error || 'Failed to sync calendar');
                  }
                } catch (err) {
                  setCalendarSyncError(err instanceof Error ? err.message : 'Failed to sync calendar');
                } finally {
                  setSyncingCalendar(false);
                }
              }}
              disabled={syncingCalendar}
              loading={syncingCalendar}
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            }
          >
            Sync Calendar
          </Button>
          </div>
        </div>
        {calendarSyncError && (
          <ErrorMessage
            message={calendarSyncError}
            dismissible
            onDismiss={() => setCalendarSyncError(null)}
            className="mt-3"
          />
        )}
      </Card>

      {/* Import Contacts Button - Static, renders immediately */}
      <Card padding="md" className="bg-sync-green-bg border-sync-green-border">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-sync-green-text-primary mb-1">Sync Contacts</h3>
            <div className="text-xs text-sync-green-text-secondary mb-3">
              <p className="mb-1">Imports contacts from your Google Contacts account. This will:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Fetch all contacts from your Google Contacts</li>
                <li>Create new contact records for contacts not already in your CRM</li>
                <li>Skip contacts that already exist or were previously imported and deleted</li>
                <li>Import contact names, email addresses, company names, and profile photos</li>
                <li>Only add new contacts—never overwrites or modifies existing contacts</li>
              </ul>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              onClick={async () => {
                setSyncingContacts(true);
                setContactsSyncError(null);
                setCurrentContactsSyncJobId(null);

                try {
                  const response = await fetch("/api/contacts/sync");

                  // Check if response is OK before parsing JSON
                  if (!response.ok) {
                    // Try to get error message from response
                    let errorMessage = `Import failed with status ${response.status}`;
                    try {
                      const errorData = await response.json();
                      errorMessage = errorData.error || errorMessage;
                    } catch {
                      // If response is not JSON, use status text
                      errorMessage = response.statusText || errorMessage;
                    }
                    throw new Error(errorMessage);
                  }

                  // Parse JSON response with error handling
                  let data;
                  try {
                    const text = await response.text();
                    if (!text || text.trim() === "") {
                      throw new Error("Empty response from server");
                    }
                    data = JSON.parse(text);
                  } catch (parseError) {
                    if (parseError instanceof SyntaxError) {
                      throw new Error("Invalid response from server. Please try again.");
                    }
                    throw parseError;
                  }

                  if (!data.ok) {
                    const errorMessage = data.error || "Import failed";
                    throw new Error(errorMessage);
                  }

                  // Success - start tracking the sync job
                  setCurrentContactsSyncJobId(data.syncJobId);
                  setSyncingContacts(false); // Button is no longer "loading" since job runs in background
                } catch (error) {
                  const errorMessage = extractErrorMessage(error);
                  setContactsSyncError(errorMessage);
                  reportException(error, {
                    context: "Manual contacts import error",
                    tags: { component: "SyncPageClient" },
                  });
                  setSyncingContacts(false);
                }
              }}
              disabled={syncingContacts || (contactsSyncJob?.status === "running")}
              loading={syncingContacts}
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              icon={
                <svg
                  className="w-5 h-5"
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
              }
            >
              Sync Contacts
            </Button>
          </div>
        </div>
        {contactsSyncError && (
          <ErrorMessage
            message={contactsSyncError}
            dismissible
            onDismiss={() => setContactsSyncError(null)}
            className="mt-3"
          />
        )}
        {contactsSyncJob && contactsSyncJob.status === "running" && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-theme-darker">
                {contactsSyncJob.currentStep === "importing" && "Importing contacts from Google..."}
                {contactsSyncJob.currentStep === "syncing_gmail" && "Syncing Gmail threads..."}
                {contactsSyncJob.currentStep === "generating_insights" && "Generating contact insights..."}
                {!contactsSyncJob.currentStep && "Processing contacts..."}
              </span>
              {contactsSyncJob.totalContacts && contactsSyncJob.processedContacts !== undefined && (
                <span className="text-sm text-theme-dark">
                  {contactsSyncJob.processedContacts + (contactsSyncJob.skippedContacts || 0)} / {contactsSyncJob.totalContacts}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: contactsSyncJob.totalContacts && contactsSyncJob.processedContacts !== undefined
                    ? `${((contactsSyncJob.processedContacts + (contactsSyncJob.skippedContacts || 0)) / contactsSyncJob.totalContacts) * 100}%`
                    : "0%",
                }}
              ></div>
            </div>
            <p className="text-xs text-theme-dark mt-2">
              {contactsSyncJob.processedContacts || 0} imported, {contactsSyncJob.skippedContacts || 0} skipped
              {contactsSyncJob.currentStep === "syncing_gmail" || contactsSyncJob.currentStep === "generating_insights"
                ? " • Syncing Gmail and generating insights for imported contacts..."
                : ""}
            </p>
          </div>
        )}
        {contactsSyncJob && contactsSyncJob.status === "complete" && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-sm">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0"
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
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Sync completed successfully
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {contactsSyncJob.processedContacts || 0} contacts imported, {contactsSyncJob.skippedContacts || 0} skipped
                </p>
              </div>
            </div>
          </div>
        )}
        {contactsSyncJob && contactsSyncJob.status === "error" && (
          <ErrorMessage
            message={contactsSyncJob.errorMessage || "Sync failed"}
            dismissible
            onDismiss={() => setCurrentContactsSyncJobId(null)}
            className="mt-3"
          />
        )}
      </Card>


      {error && (
        <Card padding="md" className="bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-yellow-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Sync Data - Only dynamic data is suspended */}
      <ThemedSuspense
        fallback={
          <div className="space-y-8">
            <Card padding="md" className="animate-pulse">
              <div className="h-6 bg-theme-light rounded w-32 mb-4" />
              <div className="h-32 bg-theme-light rounded" />
            </Card>
            <Card padding="md" className="animate-pulse">
              <div className="h-6 bg-theme-light rounded w-32 mb-4" />
              <div className="h-64 bg-theme-light rounded" />
            </Card>
          </div>
        }
      >
        {/* Last Sync Status - Show Gmail, Calendar, and Contacts */}
        {(() => {
          const lastGmailSync = syncHistory.find(job => job.service === "gmail" || !job.service) || lastSync;
          const lastCalendarSync = syncHistory.find(job => job.service === "calendar");
          const lastContactsSync = syncHistory.find(job => job.service === "contacts");
          
          return (
            <>
              {lastGmailSync && (
                <Card padding="md">
                  <h2 className="text-xl font-semibold text-theme-darkest mb-4">Last Gmail Sync</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Status</p>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                          lastGmailSync.status
                        )}`}
                      >
                        {lastGmailSync.status.charAt(0).toUpperCase() + lastGmailSync.status.slice(1)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Started At</p>
                      <p className="text-theme-darkest">{formatDate(lastGmailSync.startedAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Type</p>
                      <p className="text-theme-darkest capitalize">{lastGmailSync.type || "auto"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Threads Processed</p>
                      <p className="text-2xl font-bold text-theme-darkest">{lastGmailSync.processedThreads || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Messages Processed</p>
                      <p className="text-2xl font-bold text-theme-darkest">{lastGmailSync.processedMessages || 0}</p>
                    </div>
                    {lastGmailSync.finishedAt != null && (
                      <div>
                        <p className="text-sm font-medium text-theme-medium mb-1">Finished At</p>
                        <p className="text-theme-darkest">{formatDate(lastGmailSync.finishedAt)}</p>
                      </div>
                    )}
                  </div>
                  {lastGmailSync.errorMessage && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm">
                      <p className="text-sm text-red-800 mb-2">
                        <strong>Error:</strong> {extractErrorMessage(lastGmailSync.errorMessage)}
                      </p>
                    </div>
                  )}
                </Card>
              )}

              {lastCalendarSync && (
                <Card padding="md">
                  <h2 className="text-xl font-semibold text-theme-darkest mb-4">Last Calendar Sync</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Status</p>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                          lastCalendarSync.status
                        )}`}
                      >
                        {lastCalendarSync.status.charAt(0).toUpperCase() + lastCalendarSync.status.slice(1)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Started At</p>
                      <p className="text-theme-darkest">{formatDate(lastCalendarSync.startedAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Type</p>
                      <p className="text-theme-darkest capitalize">{lastCalendarSync.type || "initial"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Events Processed</p>
                      <p className="text-2xl font-bold text-theme-darkest">{lastCalendarSync.processedEvents || 0}</p>
                    </div>
                    {lastCalendarSync.finishedAt != null && (
                      <div>
                        <p className="text-sm font-medium text-theme-medium mb-1">Finished At</p>
                        <p className="text-theme-darkest">{formatDate(lastCalendarSync.finishedAt)}</p>
                      </div>
                    )}
                  </div>
                  {lastCalendarSync.errorMessage && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm">
                      <p className="text-sm text-red-800 mb-2">
                        <strong>Error:</strong> {extractErrorMessage(lastCalendarSync.errorMessage)}
                      </p>
                    </div>
                  )}
                </Card>
              )}

              {lastContactsSync && (
                <Card padding="md">
                  <h2 className="text-xl font-semibold text-theme-darkest mb-4">Last Contacts Import</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Status</p>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                          lastContactsSync.status
                        )}`}
                      >
                        {lastContactsSync.status.charAt(0).toUpperCase() + lastContactsSync.status.slice(1)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Started At</p>
                      <p className="text-theme-darkest">{formatDate(lastContactsSync.startedAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Type</p>
                      <p className="text-theme-darkest capitalize">{lastContactsSync.type || "initial"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Contacts Imported</p>
                      <p className="text-2xl font-bold text-theme-darkest">{lastContactsSync.processedContacts || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-theme-medium mb-1">Contacts Skipped</p>
                      <p className="text-2xl font-bold text-theme-darkest">{lastContactsSync.skippedContacts || 0}</p>
                    </div>
                    {lastContactsSync.finishedAt != null && (
                      <div>
                        <p className="text-sm font-medium text-theme-medium mb-1">Finished At</p>
                        <p className="text-theme-darkest">{formatDate(lastContactsSync.finishedAt)}</p>
                      </div>
                    )}
                  </div>
                  {lastContactsSync.errorMessage && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm">
                      <p className="text-sm text-red-800 mb-2">
                        <strong>Error:</strong> {extractErrorMessage(lastContactsSync.errorMessage)}
                      </p>
                    </div>
                  )}
                </Card>
              )}
            </>
          );
        })()}

        {/* Sync History */}
        <Card padding="md">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-theme-darkest mb-1">Sync History</h2>
              <p className="text-xs sm:text-sm text-theme-medium">
                View past sync operations for Gmail, Calendar, and Contacts. Each entry shows what was synced, when it started, and the results.
              </p>
            </div>
            {syncHistory.length > 1 && (
              <div className="shrink-0 sm:ml-4">
                <Button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={clearingHistory}
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
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
                  title="Removes all sync history except the most recent sync job for each service. This action cannot be undone."
                >
                  Clear History
                </Button>
              </div>
            )}
          </div>
          
          {clearError && (
            <ErrorMessage
              message={clearError}
              dismissible
              onDismiss={() => setClearError(null)}
              className="mb-4"
            />
          )}

          {syncHistory.length === 0 ? (
            <p className="text-theme-medium text-center py-8">No sync history available yet</p>
          ) : (
            <div className="space-y-3">
              {syncHistory.map((job) => {
                const isGmail = job.service === "gmail" || !job.service;
                const isCalendar = job.service === "calendar";
                const isContacts = job.service === "contacts";
                
                return (
                  <div
                    key={job.syncJobId}
                    className="flex items-center justify-between p-4 bg-card-highlight-light rounded-sm"
                  >
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-xs text-theme-medium mb-1">Service</p>
                        <p className="text-sm font-medium text-theme-darkest capitalize">
                          {isGmail ? "Gmail" : isCalendar ? "Calendar" : isContacts ? "Contacts" : "Unknown"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-theme-medium mb-1">Started</p>
                        <p className="text-sm font-medium text-theme-darkest">
                          {formatDate(job.startedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-theme-medium mb-1">Status</p>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </div>
                      {isGmail ? (
                        <>
                          <div>
                            <p className="text-xs text-theme-medium mb-1">Threads</p>
                            <p className="text-sm font-medium text-theme-darkest">
                              {job.processedThreads || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-theme-medium mb-1">Messages</p>
                            <p className="text-sm font-medium text-theme-darkest">
                              {job.processedMessages || 0}
                            </p>
                          </div>
                        </>
                      ) : isCalendar ? (
                        <div>
                          <p className="text-xs text-theme-medium mb-1">Events</p>
                          <p className="text-sm font-medium text-theme-darkest">
                            {job.processedEvents || 0}
                          </p>
                        </div>
                      ) : isContacts ? (
                        <>
                          <div>
                            <p className="text-xs text-theme-medium mb-1">Imported</p>
                            <p className="text-sm font-medium text-theme-darkest">
                              {job.processedContacts || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-theme-medium mb-1">Skipped</p>
                            <p className="text-sm font-medium text-theme-darkest">
                              {job.skippedContacts || 0}
                            </p>
                          </div>
                        </>
                      ) : null}
                    </div>
                    {job.errorMessage && (
                      <div className="ml-4 text-xs text-red-600 max-w-xs">
                        {extractErrorMessage(job.errorMessage)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </ThemedSuspense>
    </div>
  );
}

