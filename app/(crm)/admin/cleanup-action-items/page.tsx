"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { reportException } from "@/lib/error-reporting";

export default function CleanupActionItemsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      totalContactsChecked: number;
      contactsWithOldEmails: number;
      totalActionItemsDeleted: number;
      contactsProcessed: number;
      errors: number;
      errorsDetails?: string[];
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleCleanup = async () => {
    if (
      !confirm(
        "This will DELETE ALL action items from contacts whose last email was more than 90 days ago. " +
          "This action cannot be undone. Continue?"
      )
    ) {
      return;
    }

    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/cleanup-action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Cleanup failed");
      }

      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      reportException(err, {
        context: "Cleaning up action items from old contacts",
        tags: { component: "CleanupActionItemsPage" },
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-theme-darkest mb-2">
          Cleanup Action Items
        </h1>
        <p className="text-theme-dark">
          Delete all action items from contacts whose last email was more than 90 days ago
        </p>
      </div>

      <Card padding="lg">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-theme-darkest mb-4">
              What this script does:
            </h2>
            <ul className="list-disc list-inside space-y-2 text-theme-darker">
              <li>Finds all contacts where <code className="bg-gray-100 px-1 rounded">lastEmailDate</code> is more than 90 days old</li>
              <li>Deletes ALL action items for those contacts</li>
              <li>This action cannot be undone</li>
            </ul>
          </div>

          <div className="border-t pt-6">
            <Button
              onClick={handleCleanup}
              disabled={running}
              loading={running}
              variant="danger"
              fullWidth
            >
              {running ? "Running cleanup..." : "Run Cleanup"}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-sm">
              <p className="text-red-800 font-semibold">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-4">
              <div
                className={`p-4 rounded-sm border ${
                  result.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <p
                  className={`font-semibold ${
                    result.success ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {result.success ? "Success" : "Failed"}
                </p>
                <p
                  className={result.success ? "text-green-700" : "text-red-700"}
                >
                  {result.message}
                </p>
              </div>

              {result.stats && (
                <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
                  <h3 className="font-semibold text-theme-darkest mb-3">Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-theme-dark">Contacts Checked</p>
                      <p className="text-2xl font-bold text-theme-darkest">
                        {result.stats.totalContactsChecked}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-theme-dark">
                        Contacts with Old Emails
                      </p>
                      <p className="text-2xl font-bold text-amber-600">
                        {result.stats.contactsWithOldEmails}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-theme-dark">
                        Action Items Deleted
                      </p>
                      <p className="text-2xl font-bold text-red-600">
                        {result.stats.totalActionItemsDeleted}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-theme-dark">
                        Contacts Processed
                      </p>
                      <p className="text-2xl font-bold text-blue-600">
                        {result.stats.contactsProcessed}
                      </p>
                    </div>
                    {result.stats.errors > 0 && (
                      <div className="col-span-2">
                        <p className="text-sm text-theme-dark">Errors</p>
                        <p className="text-2xl font-bold text-red-600">
                          {result.stats.errors}
                        </p>
                        {result.stats.errorsDetails &&
                          result.stats.errorsDetails.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">
                                Error details (first 10):
                              </p>
                              <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
                                {result.stats.errorsDetails.map((err, idx) => (
                                  <li key={idx}>{err}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

