"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loading from "@/components/Loading";
import Card from "@/components/Card";

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
        throw new Error(data.error || "Migration failed");
      }

      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Migration error:", err);
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Migrate Action Items</h1>
        <p className="text-gray-600 text-lg">
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Migration Options</h2>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={running}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="dryRun" className="text-sm font-medium text-gray-700 cursor-pointer">
              Dry run (preview changes without migrating)
            </label>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="clearOldField"
              checked={clearOldField}
              onChange={(e) => setClearOldField(e.target.checked)}
              disabled={running || dryRun}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="clearOldField" className="text-sm font-medium text-gray-700 cursor-pointer">
              Clear old actionItems field after migration (only when not in dry run mode)
            </label>
          </div>

          <button
            onClick={handleMigrate}
            disabled={running}
            className={`w-full px-6 py-3 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              dryRun
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-linear-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white"
            }`}
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
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
                {dryRun ? "Running preview..." : "Migrating..."}
              </span>
            ) : (
              dryRun ? "Preview Migration" : "Run Migration"
            )}
          </button>
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

            <div className="bg-white rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Processed</p>
                  <p className="text-lg font-bold text-gray-900">{result.processed}</p>
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
                  <p className="text-xs font-medium text-gray-700 mb-2">
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
                        <div className="font-medium text-gray-900 mb-1">
                          {detail.email}
                        </div>
                        {detail.action === "migrated" && (
                          <div className="text-gray-600">
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
                          <div className="text-gray-600">{detail.error}</div>
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

