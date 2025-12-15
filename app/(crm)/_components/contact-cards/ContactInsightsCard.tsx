"use client";

import { useContact } from "@/hooks/useContact";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import InfoPopover from "@/components/InfoPopover";
import { formatContactDate } from "@/util/contact-utils";
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

  if (!displayContact) {
    return (
      <Card padding="md">
        <Skeleton height="h-96" width="w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h2 className="text-xl font-semibold text-theme-darkest mb-6">Contact Insights</h2>
      <div className="space-y-6">
        {/* AI Summary Section */}
        {displayContact.summary && (
          <div className="border-l-4 border-indigo-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
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
    </Card>
  );
}

