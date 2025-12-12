"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { reportException } from "@/lib/error-reporting";

export default function ExtractNamesPage() {
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
      extracted?: { firstName: string | null; lastName: string | null };
      current?: { firstName?: string | null; lastName?: string | null };
      new?: { firstName?: string | null; lastName?: string | null };
      error?: string;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleExtract = async () => {
    if (!dryRun && !confirm(
      "This will update firstName and lastName fields for all contacts based on their email addresses. " +
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
      const response = await fetch("/api/admin/extract-names-from-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user.uid,
          dryRun,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Extraction failed");
      }

      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      reportException(err, {
        context: "Extracting names from emails",
        tags: { component: "ExtractNamesPage" },
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
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Extract Names from Emails</h1>
        <p className="text-theme-dark text-lg">
          Batch process all contacts to extract first and last names from email addresses
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
              <li><strong>dorothy.adams@yahoo.com</strong> → firstName: &quot;Dorothy&quot;, lastName: &quot;Adams&quot;</li>
              <li><strong>dorothy@gmail.com</strong> → firstName: &quot;Dorothy&quot;, lastName: null</li>
              <li><strong>Only processes contacts with NO company name</strong></li>
              <li>Extracts and capitalizes first name and last name from email addresses</li>
              <li>Only updates contacts that are missing firstName or lastName</li>
              <li>Preserves existing names if they already exist</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-theme-darkest mb-2">What this does:</h2>
            <ul className="list-disc list-inside space-y-1 text-theme-darker">
              <li>Processes contacts that have <strong>NO company name</strong></li>
              <li>Extracts first name and last name from email addresses</li>
              <li>Capitalizes the extracted names (e.g., &quot;dorothy&quot; → &quot;Dorothy&quot;)</li>
              <li>Only updates contacts missing firstName or lastName</li>
              <li>Does not overwrite existing names</li>
              <li>Skips contacts that already have a company name</li>
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
            onClick={handleExtract}
            disabled={running}
            loading={running}
            variant={dryRun ? "primary" : "danger"}
            size="lg"
            fullWidth
          >
            {dryRun ? "Preview Changes" : "Extract Names and Update Contacts"}
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
                        </div>
                        {detail.action === "updated" && (
                          <div className="text-theme-dark space-y-0.5">
                            <div>
                              Current: {detail.current?.firstName || "—"} {detail.current?.lastName || "—"}
                            </div>
                            <div>
                              → New: {detail.new?.firstName || "—"} {detail.new?.lastName || "—"}
                            </div>
                          </div>
                        )}
                        {detail.action === "skipped" && (
                          <div className="text-theme-dark">
                            Already has: {detail.current?.firstName || "—"} {detail.current?.lastName || "—"}
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
          <div>
            <h3 className="text-sm font-semibold text-yellow-900 mb-1">After Running</h3>
            <p className="text-xs text-yellow-800">
              Once you&apos;ve successfully run this script, please delete these files:
            </p>
            <ul className="text-xs text-yellow-800 list-disc list-inside mt-2 space-y-1 font-mono">
              <li>app/api/admin/extract-names-from-emails/route.ts</li>
              <li>app/(crm)/admin/extract-names/page.tsx</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

