"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { reportException } from "@/lib/error-reporting";

export default function MigrateActionItemsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [clearOldField, setClearOldField] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    dryRun: boolean;
    clearOldField: boolean;
    processed: number;
    migrated: number;
    skipped: number;
    errors: number;
    quotaLimitReached?: boolean;
    contactsProcessedSoFar?: number;
    summary?: {
      totalContactsFetched?: number;
      totalContacts?: number;
      contactsWithActionItemsField: number;
      contactsWithNonEmptyActionItems: number;
      contactsProcessed: number;
    };
    details?: Array<{
      contactId: string;
      email: string;
      action: "migrated" | "skipped" | "error";
      itemsCreated?: number;
      oldActionItems?: string;
      error?: string;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleMigrate = async () => {
    if (!dryRun && !confirm(
      "This will migrate action items from the old string format to the new subcollection format. " +
      "This action will modify your data. Continue?"
    )) {
      return;
    }

    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/migrate-action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          dryRun,
          clearOldField,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If it's a quota error, set it as result so we can show the special UI
        if (response.status === 429 || data.quotaLimitReached) {
          setResult({
            ...data,
            processed: data.processed || 0,
            migrated: data.migrated || 0,
            skipped: data.skipped || 0,
            errors: data.errors || 0,
          });
          return;
        }
        throw new Error(data.error || data.message || "Migration failed");
      }

      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      reportException(err, {
        context: "Migrating action items",
        tags: { component: "MigrateActionItemsPage" },
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
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Migrate Action Items</h1>
        <p className="text-theme-dark text-lg">
          Migrate action items from old string format to new subcollection format
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
            <h3 className="text-lg font-semibold text-blue-900 mb-2">What this does</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Finds contacts with action items in the old string format</li>
              <li>Migrates them to the new subcollection format (one action item per document)</li>
              <li>Optionally removes the old string field after migration</li>
              <li>Skips contacts that already have action items in the new format</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-theme-darkest mb-2">Migration Options</h2>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={running}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="dryRun" className="text-sm font-medium text-theme-darker cursor-pointer">
              Dry run (preview changes without migrating)
            </label>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
            <input
              type="checkbox"
              id="clearOldField"
              checked={clearOldField}
              onChange={(e) => setClearOldField(e.target.checked)}
              disabled={running || dryRun}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="clearOldField" className="text-sm font-medium text-theme-darker cursor-pointer">
              Clear old actionItems field after migration (only when not in dry run mode)
            </label>
          </div>

          <Button
            onClick={handleMigrate}
            disabled={running}
            loading={running}
            variant={dryRun ? "primary" : "danger"}
            size="lg"
            fullWidth
          >
            {dryRun ? "Preview Migration" : "Run Migration"}
          </Button>
        </div>
      </Card>

      {error && (
        <Card padding="md" className="bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
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
            <div>
              <p className="text-red-800 font-medium mb-2">{error}</p>
              {error.includes("quota") || error.includes("Quota") ? (
                <div className="text-sm text-red-700 space-y-1">
                  <p>Firestore free tier limits:</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>50,000 reads per day</li>
                    <li>20,000 writes per day</li>
                  </ul>
                  <p className="mt-2">Quotas reset daily. You can:</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Wait a few hours for the quota to reset</li>
                    <li>Upgrade your Firebase plan for higher limits</li>
                    <li>Run the migration in smaller chunks (it now processes max 200 contacts per run)</li>
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      )}

      {result?.quotaLimitReached && (
        <Card padding="md" className="bg-orange-50 border-orange-200">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-orange-600 shrink-0 mt-0.5"
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
            <div>
              <h3 className="text-orange-900 font-semibold mb-2">Firestore Quota Exceeded</h3>
              <p className="text-sm text-orange-800 mb-2">
                {result.message}
              </p>
              {result.contactsProcessedSoFar !== undefined && (
                <p className="text-sm text-orange-700">
                  Processed {result.contactsProcessedSoFar} contacts before hitting the limit.
                </p>
              )}
              <div className="mt-3 text-sm text-orange-800">
                <p className="font-medium mb-1">Your options:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Wait a few hours for daily quota to reset (resets at midnight Pacific Time)</li>
                  <li>Upgrade to Firebase Blaze plan for higher limits</li>
                  <li>Run migration again later - it will continue from where it left off</li>
                </ul>
              </div>
            </div>
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

            <div className="bg-[#EEEEEC] rounded-md p-4 space-y-2">
              {result.summary && (
                <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                  <p className="text-xs font-medium text-blue-900 mb-2">Database Summary:</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-blue-700">Total Contacts:</span>{" "}
                      <span className="font-semibold">{result.summary.totalContacts}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">With actionItems Field:</span>{" "}
                      <span className="font-semibold">{result.summary.contactsWithActionItemsField}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">With Non-Empty Action Items:</span>{" "}
                      <span className="font-semibold">{result.summary.contactsWithNonEmptyActionItems}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Processed</p>
                  <p className="text-lg font-bold text-theme-darkest">{result.processed}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Migrated</p>
                  <p className="text-lg font-bold text-green-600">{result.migrated}</p>
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
                          detail.action === "migrated"
                            ? "bg-green-50 border border-green-200"
                            : detail.action === "skipped"
                            ? "bg-yellow-50 border border-yellow-200"
                            : "bg-red-50 border border-red-200"
                        }`}
                      >
                        <div className="font-medium text-theme-darkest mb-1">
                          {detail.email}
                        </div>
                        {detail.action === "migrated" && (
                          <div className="text-theme-dark">
                            Created {detail.itemsCreated} action item(s)
                            {detail.oldActionItems && (
                              <div className="mt-1 text-xs text-gray-500 italic">
                                Old: {detail.oldActionItems.substring(0, 100)}
                                {detail.oldActionItems.length > 100 ? "..." : ""}
                              </div>
                            )}
                          </div>
                        )}
                        {detail.action === "skipped" && (
                          <div className="text-theme-dark">{detail.error}</div>
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
              Once you&apos;ve successfully run this migration, please delete these files:
            </p>
            <ul className="text-xs text-yellow-800 list-disc list-inside mt-2 space-y-1 font-mono">
              <li>app/api/admin/migrate-action-items/route.ts</li>
              <li>app/(crm)/admin/migrate-action-items/page.tsx</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

