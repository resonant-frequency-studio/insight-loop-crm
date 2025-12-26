"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { reportException } from "@/lib/error-reporting";

export default function EnrichContactsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<{
    message: string;
    dryRun: boolean;
    processed: number;
    updated: number;
    skipped: number;
    errors: number;
    details?: Array<{
      contactId: string;
      email: string;
      action: "updated" | "skipped" | "error";
      enriched?: { firstName: string | null; lastName: string | null; company: string | null; photoUrl: string | null; source?: string };
      current?: { firstName?: string | null; lastName?: string | null; company?: string | null; photoUrl?: string | null };
      new?: { firstName?: string | null; lastName?: string | null; company?: string | null; photoUrl?: string | null };
      error?: string;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleEnrich = async () => {
    if (!dryRun && !confirm(
      "This will enrich contacts with first name, last name, company, and profile photo from Google People API. " +
      "This action will modify your data. Continue?"
    )) {
      return;
    }

    if (!user?.uid) {
      setError("User not authenticated");
      return;
    }

    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/enrich-contacts-with-people-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user.uid,
          dryRun,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Enrichment failed");
      }

      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      reportException(err, {
        context: "Enriching contacts with People API",
        tags: { component: "EnrichContactsPage" },
      });
    } finally {
      setRunning(false);
    }
  };

  if (authLoading) {
    return <Loading />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Enrich Contacts with People API</h1>
        <p className="text-theme-dark text-lg">
          Batch process all contacts to enrich them with first name, last name, company, and profile photo from Google People API
        </p>
      </div>

      <Card padding="md" className="bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-blue-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">How it works</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Uses Google People API to search your contacts for matching email addresses</li>
              <li>Extracts first name, last name, company, and profile photo from Google Contacts</li>
              <li>Falls back to email-based name extraction if People API doesn&apos;t find the contact</li>
              <li>Only updates contacts that are missing firstName, lastName, company, or photoUrl</li>
              <li>Preserves existing well-formed data (doesn&apos;t overwrite)</li>
              <li>Processes in batches with rate limiting to respect API quotas</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-theme-darkest mb-2">What this does:</h2>
            <ul className="list-disc list-inside space-y-1 text-theme-darker">
              <li>Searches Google People API for contact information by email address</li>
              <li>Enriches contacts with first name, last name, company name, and profile photo</li>
              <li>Falls back to email-based extraction if People API doesn&apos;t have the contact</li>
              <li>Only updates missing or non-well-formed fields</li>
              <li>Does not overwrite existing well-formed data</li>
              <li>Requires Google account to be linked with People API scope</li>
            </ul>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-sm">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={running}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="dryRun" className="text-sm font-medium text-theme-darker cursor-pointer">
              Dry run (preview changes without updating)
            </label>
          </div>

          <Button
            onClick={handleEnrich}
            disabled={running}
            loading={running}
            variant={dryRun ? "primary" : "danger"}
            size="lg"
            fullWidth
          >
            {dryRun ? "Preview Changes" : "Enrich Contacts and Update"}
          </Button>
        </div>
      </Card>

      {error && (
        <Card padding="md" className="bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-600"
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
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </Card>
      )}

      {result && (
        <Card padding="md" className="bg-green-50 border-green-200">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-green-900">
                {result.message}
              </h3>
            </div>

            <div className="bg-[#EEEEEC] rounded-sm p-4 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Processed</p>
                  <p className="text-lg font-bold text-theme-darkest">{result.processed}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Updated</p>
                  <p className="text-lg font-bold text-green-600">{result.updated}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Skipped</p>
                  <p className="text-lg font-bold text-yellow-600">{result.skipped}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Errors</p>
                  <p className="text-lg font-bold text-red-600">{result.errors}</p>
                </div>
              </div>

              {result.details && result.details.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-medium text-theme-darker mb-2">
                    Sample Results (showing first 20):
                  </p>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {result.details.slice(0, 20).map((detail, idx) => (
                      <div
                        key={idx}
                        className={`text-xs p-2 rounded ${
                          detail.action === "updated"
                            ? "bg-green-50 border border-green-200"
                            : detail.action === "skipped"
                            ? "bg-yellow-50 border border-yellow-200"
                            : "bg-red-50 border border-red-200"
                        }`}
                      >
                        <div className="font-medium text-theme-darkest mb-1">
                          {detail.email}
                          {detail.enriched?.source && (
                            <span className="ml-2 text-xs text-gray-500">
                              (source: {detail.enriched.source === "people_api" ? "People API" : "Email extraction"})
                            </span>
                          )}
                        </div>
                        {detail.action === "updated" && (
                          <div className="text-theme-dark space-y-0.5">
                            <div>
                              Current: {detail.current?.firstName || "—"} {detail.current?.lastName || "—"} 
                              {detail.current?.company && ` (${detail.current.company})`}
                            </div>
                            <div>
                              → New: {detail.new?.firstName || "—"} {detail.new?.lastName || "—"}
                              {detail.new?.company && ` (${detail.new.company})`}
                            </div>
                          </div>
                        )}
                        {detail.action === "skipped" && (
                          <div className="text-theme-dark">
                            Already has: {detail.current?.firstName || "—"} {detail.current?.lastName || "—"}
                            {detail.current?.company && ` (${detail.current.company})`}
                            {detail.error && <span className="text-gray-500"> - {detail.error}</span>}
                          </div>
                        )}
                        {detail.action === "error" && (
                          <div className="text-red-600">{detail.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {result.details.length > 20 && (
                    <p className="text-xs text-gray-500 mt-2">
                      ... and {result.details.length - 20} more results
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card padding="md" className="bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-900 mb-1">Requirements</h3>
            <p className="text-xs text-yellow-800">
              For this to work, you need to:
            </p>
            <ul className="text-xs text-yellow-800 list-disc list-inside mt-2 space-y-1">
              <li>Have your Google account linked to the CRM</li>
              <li>Have granted the contacts.readonly scope (may require re-authentication)</li>
              <li>Have contacts in your Google Contacts that match the email addresses in the CRM</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

