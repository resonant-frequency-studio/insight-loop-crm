"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useContact } from "@/hooks/useContact";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import InfoPopover from "@/components/InfoPopover";
import { Button } from "@/components/Button";
import { formatContactDate } from "@/util/contact-utils";
import { extractErrorMessage, ErrorMessage } from "@/components/ErrorMessage";
import { reportException } from "@/lib/error-reporting";
import { isOwnerContact } from "@/lib/contacts/owner-utils";
import type { Contact } from "@/types/firestore";

interface ContactInsightsCardProps {
  contactId: string;
  userId: string;
  initialContact?: Contact;
}

export default function ContactInsightsCard({
  contactId,
  userId,
  initialContact,
}: ContactInsightsCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const displayContact = contact || initialContact;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncGmailError, setSyncGmailError] = useState<string | null>(null);
  const [syncGmailSuccess, setSyncGmailSuccess] = useState(false);

  // Check if this is the owner contact
  const isOwner = displayContact?.primaryEmail && user?.email
    ? isOwnerContact(user.email, displayContact.primaryEmail)
    : false;

  const handleRegenerateSummary = async () => {
    setRegenerating(true);
    setRegenerateError(null);

    try {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(contactId)}/regenerate-summary`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        let errorMessage = `Regeneration failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.ok) {
        const errorMsg = data.error || "Failed to regenerate summary. Please try again.";
        throw new Error(errorMsg);
      }

      // Invalidate React Query cache to trigger a refetch of contact data
      queryClient.invalidateQueries({ queryKey: ["contact", userId, contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts", userId] });
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      setRegenerateError(errorMessage);
      reportException(error, {
        context: "Regenerating contact summary in ContactInsightsCard",
        tags: { component: "ContactInsightsCard", contactId },
      });
    } finally {
      setRegenerating(false);
    }
  };

  const handleSyncGmail = async () => {
    if (!displayContact?.primaryEmail) {
      setSyncGmailError("Contact does not have an email address");
      return;
    }

    setSyncingGmail(true);
    setSyncGmailError(null);
    setSyncGmailSuccess(false);

    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}/sync-gmail`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        let errorMessage = `Sync failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.ok) {
        const errorMsg = data.error || "Gmail sync failed. Please try again.";
        throw new Error(errorMsg);
      }

      // Invalidate React Query cache to trigger a refetch of contact data
      queryClient.invalidateQueries({ queryKey: ["contact", userId, contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts", userId] });

      // Show success message
      setSyncGmailSuccess(true);
      // Clear success message after 5 seconds to allow reading
      setTimeout(() => setSyncGmailSuccess(false), 5000);
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      setSyncGmailError(errorMessage);
      reportException(error, {
        context: "Syncing Gmail for contact in ContactInsightsCard",
        tags: { component: "ContactInsightsCard", contactId },
      });
    } finally {
      setSyncingGmail(false);
    }
  };

  // Check if there are any insights to display
  const hasInsights = !!(
    displayContact?.summary ||
    displayContact?.sentiment ||
    displayContact?.painPoints ||
    displayContact?.coachingThemes ||
    displayContact?.relationshipInsights ||
    (displayContact?.engagementScore !== null && displayContact?.engagementScore !== undefined) ||
    displayContact?.threadCount ||
    displayContact?.lastEmailDate
  );

  if (!displayContact) {
    return (
      <Card padding="md">
        <Skeleton height="h-96" width="w-full" />
      </Card>
    );
  }

  // Show owner message instead of insights
  if (isOwner) {
    return (
      <Card padding="md">
        <h2 className="text-xl font-semibold text-theme-darkest mb-6">Contact Insights</h2>
        <div className="text-center py-8 px-4">
          <svg
            className="w-12 h-12 text-theme-medium mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <h3 className="text-lg font-medium text-theme-darkest mb-2">
            Owner Contact
          </h3>
          <p className="text-sm text-theme-medium max-w-sm mx-auto">
            Contact insights are not available for the owner contact.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h2 className="text-xl font-semibold text-theme-darkest mb-6">Contact Insights</h2>
      
      {/* Empty State - Show when no insights exist */}
      {!hasInsights && (
        <div className="text-center py-8 px-4">
          <svg
            className="w-12 h-12 text-theme-medium mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-theme-darkest mb-2">
            No Contact Insights Yet
          </h3>
          <p className="text-sm text-theme-medium mb-4 max-w-sm mx-auto">
            Sync Gmail for this contact to generate AI-powered insights including summary, sentiment, engagement score, and more.
          </p>
          {displayContact?.primaryEmail ? (
            <>
              <Button
                onClick={handleSyncGmail}
                disabled={syncingGmail}
                loading={syncingGmail}
                variant="primary"
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                }
              >
                {syncingGmail ? "Syncing Gmail..." : "Sync Gmail"}
              </Button>
            </>
          ) : (
            <p className="text-xs text-theme-medium">
              This contact needs an email address to sync Gmail.
            </p>
          )}
        </div>
      )}

      {/* Insights Content */}
      {hasInsights && (
        <div className="space-y-6">
        {/* AI Summary Section */}
        {displayContact.summary && (
          <div className="border-l-4 border-indigo-500 pl-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  AI Summary
                </h3>
              </div>
              <button
                onClick={handleRegenerateSummary}
                disabled={regenerating}
                className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                title="Regenerate AI summary"
              >
                {regenerating ? (
                  <>
                    <svg
                      className="w-3 h-3 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Regenerating...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3 h-3"
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
                    Regenerate
                  </>
                )}
              </button>
            </div>
            {regenerateError && (
              <ErrorMessage
                message={regenerateError}
                dismissible
                onDismiss={() => setRegenerateError(null)}
                className="mb-2"
              />
            )}
            <p className="text-sm text-theme-darkest whitespace-pre-wrap leading-relaxed">
              {displayContact.summary}
            </p>
          </div>
        )}

        {/* Engagement Score Section */}
        {(() => {
          const engagementScore = Number(displayContact.engagementScore);
          const isValidScore =
            !isNaN(engagementScore) &&
            engagementScore !== null &&
            engagementScore !== undefined;
          return isValidScore ? (
            <div className="border-l-4 border-teal-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-teal-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Engagement Score
                </h3>
                <InfoPopover content="A numerical score (0-100) that measures how actively engaged this contact is with your communications. Higher scores indicate more frequent interactions, email opens, responses, and overall engagement with your content." />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-teal-600 h-2 rounded-full"
                    style={{ width: `${Math.min(engagementScore, 100)}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold text-theme-darkest">
                  {Math.round(engagementScore)}
                </span>
              </div>
            </div>
          ) : null;
        })()}

        {/* Email Threads Section */}
        {displayContact.threadCount && displayContact.threadCount > 0 && (
          <div className="border-l-4 border-cyan-500 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-cyan-600"
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
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Email Threads
              </h3>
            </div>
            <p className="text-sm font-semibold text-theme-darkest">
              {displayContact.threadCount}
            </p>
          </div>
        )}

        {/* Last Email Date Section */}
        {displayContact.lastEmailDate != null && (
          <div className="border-l-4 border-blue-500 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-blue-600"
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
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Last Email Date
              </h3>
            </div>
            <p className="text-sm font-semibold text-theme-darkest">
              {formatContactDate(displayContact.lastEmailDate, { relative: true })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatContactDate(displayContact.lastEmailDate, { includeTime: true })}
            </p>
          </div>
        )}

        {/* Pain Points Section */}
        {displayContact.painPoints && (
          <div className="border-l-4 border-red-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Pain Points
              </h3>
            </div>
            <p className="text-sm text-theme-darkest whitespace-pre-wrap leading-relaxed">
              {displayContact.painPoints}
            </p>
          </div>
        )}

        {displayContact.sentiment && (
          <div className="border-l-4 border-purple-500 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Sentiment
              </h3>
            </div>
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                displayContact.sentiment.toLowerCase().includes("positive")
                  ? "bg-green-100 text-green-800"
                  : displayContact.sentiment.toLowerCase().includes("negative")
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-theme-darker"
              }`}
            >
              {displayContact.sentiment}
            </span>
          </div>
        )}
        </div>
      )}

      {/* Sync Gmail Loading State - Persistent while generating insights */}
      {syncingGmail && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 flex items-start gap-3 shadow-lg">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 shrink-0 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-blue-800">Generating Contact Insights</p>
              <p className="text-sm text-blue-700 mt-1">
                Syncing email threads and generating AI insights. You can continue using the app—the page will update automatically when complete.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sync Gmail Error Message */}
      {syncGmailError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <ErrorMessage
            message={syncGmailError}
            dismissible
            onDismiss={() => setSyncGmailError(null)}
          />
        </div>
      )}

      {/* Sync Gmail Success Message */}
      {syncGmailSuccess && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div className="bg-green-50 border border-green-200 rounded-sm p-4 flex items-start gap-3 shadow-lg">
            <svg
              className="w-5 h-5 text-green-600 mt-0.5 shrink-0"
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
            <div className="flex-1 min-w-0">
              <p className="font-medium text-green-800">Contact Insights Generated</p>
              <p className="text-sm text-green-700 mt-1">
                Email threads synced and contact insights generated. The contact page has been updated automatically.
              </p>
            </div>
            <button
              onClick={() => setSyncGmailSuccess(false)}
              className="text-green-600 hover:text-green-800 shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

