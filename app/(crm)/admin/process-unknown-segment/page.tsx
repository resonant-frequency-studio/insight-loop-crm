"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { reportException } from "@/lib/error-reporting";
import { useAdminJob } from "@/hooks/useAdminJob";
import { extractErrorMessage } from "@/components/ErrorMessage";


export default function ProcessUnknownSegmentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [segment, setSegment] = useState<string>("Unknown");
  const [limit, setLimit] = useState<string>("10");
  const [error, setError] = useState<string | null>(null);
  
  // Track job progress
  const { adminJob } = useAdminJob(user?.uid || null, jobId);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleProcess = async () => {
    if (!segment || !segment.trim()) {
      setError("Please specify a segment to process");
      return;
    }

    if (!dryRun && !confirm(
      `This will process all '${segment}' segment contacts to:\n` +
      "1. Sync their Gmail threads\n" +
      "2. Generate contact insights using Gemini\n" +
      "3. Generate 3-4 tags based on email threads\n\n" +
      "This action will modify your data. Continue?"
    )) {
      return;
    }

    if (!user?.uid) {
      setError("User not authenticated");
      return;
    }

    setStarting(true);
    setError(null);
    setJobId(null);

    try {
      const response = await fetch("/api/admin/process-unknown-segment-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          segment: segment.trim(),
          limit: limit ? parseInt(limit, 10) : 10000,
          batchSize: 5,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start processing");
      }

      setJobId(data.jobId);
    } catch (err) {
      const errorMessage = extractErrorMessage(err);
      setError(errorMessage);
      reportException(err, {
        context: "Starting process unknown segment job",
        tags: { component: "ProcessUnknownSegmentPage" },
      });
    } finally {
      setStarting(false);
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
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Process Segment Contacts</h1>
        <p className="text-theme-dark text-lg">
          Process contacts in a specific segment that don&apos;t have Gmail threads or insights yet. This will sync Gmail threads, generate contact insights, and create tags.
        </p>
      </div>

      <Card padding="lg">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-theme-darkest mb-4">Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="segment" className="block text-sm font-medium text-theme-darker mb-2">
                  Segment
                </label>
                <input
                  type="text"
                  id="segment"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  disabled={starting || (adminJob?.status === "running")}
                  placeholder="e.g., Unknown, Enterprise, SMB"
                  className="w-full px-3 py-2 border border-theme-light rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-theme-dark mt-1">
                  Enter the segment name to process. All contacts with this segment will be processed.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="dry-run"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  disabled={starting || (adminJob?.status === "running")}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="dry-run" className="text-theme-darkest cursor-pointer">
                  Dry run (preview only, no changes)
                </label>
              </div>

              <div>
                <label htmlFor="limit" className="block text-sm font-medium text-theme-darker mb-2">
                  Contact Limit (leave empty for unlimited)
                </label>
                <input
                  type="number"
                  id="limit"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  disabled={starting || (adminJob?.status === "running")}
                  min="1"
                  placeholder="10"
                  className="w-full px-3 py-2 border border-theme-light rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-theme-dark mt-1">
                  Process up to this many contacts. Leave empty to process all contacts in the selected segment.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-theme-lighter">
            <Button
              onClick={handleProcess}
              disabled={starting || (adminJob?.status === "running")}
              loading={starting}
              variant="primary"
              size="md"
            >
              {dryRun ? "Preview Processing" : "Process Contacts"}
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card padding="md" className="border-red-300 bg-red-50 dark:bg-red-900/20">
          <div className="text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error}
          </div>
        </Card>
      )}

      {/* Progress Tracking */}
      {adminJob && (
        <Card padding="lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-theme-darkest">Processing Status</h2>
              <span
                className={`px-3 py-1 text-sm font-semibold rounded-sm ${
                  adminJob.status === "running"
                    ? "bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100"
                    : adminJob.status === "complete"
                    ? "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100"
                    : adminJob.status === "error"
                    ? "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                }`}
              >
                {adminJob.status.toUpperCase()}
              </span>
            </div>

            {adminJob.currentStep && (
              <div className="text-theme-dark">
                <strong>Current Step:</strong> {adminJob.currentStep}
              </div>
            )}

            {adminJob.status === "running" && adminJob.total && adminJob.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-theme-dark">
                  <span>
                    Processed: {adminJob.processed || 0} / {adminJob.total}
                  </span>
                  <span>
                    {Math.round(((adminJob.processed || 0) / adminJob.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-theme-light rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        ((adminJob.processed || 0) / adminJob.total) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-sm">
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {adminJob.total || 0}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Total Contacts</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-sm">
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {adminJob.processed || 0}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">Processed</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-sm">
                <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {adminJob.skipped || 0}
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">Skipped</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-sm">
                <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {adminJob.errors || 0}
                </div>
                <div className="text-sm text-red-700 dark:text-red-300">Errors</div>
              </div>
            </div>

            {adminJob.dryRun && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 p-4 rounded-sm">
                <p className="text-yellow-800 dark:text-yellow-200">
                  <strong>Dry Run Mode:</strong> No changes were made. Run without dry run to process contacts.
                </p>
              </div>
            )}

            {adminJob.status === "error" && adminJob.errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-4 rounded-sm">
                <p className="text-red-800 dark:text-red-200">
                  <strong>Error:</strong> {adminJob.errorMessage}
                </p>
              </div>
            )}

            {adminJob.status === "complete" && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 p-4 rounded-sm">
                <p className="text-green-800 dark:text-green-200">
                  <strong>Processing Complete!</strong> All contacts have been processed.
                </p>
              </div>
            )}

            {adminJob.details && adminJob.details.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-theme-darkest mb-3">Details</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {adminJob.details.map((detail, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-sm border ${
                        detail.action === "processed"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                          : detail.action === "error"
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                          : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-theme-darkest">
                            {detail.contactName} ({detail.contactEmail})
                          </div>
                          <div className="text-sm text-theme-dark mt-1">
                            {detail.action === "processed" && (
                              <>
                                {detail.threadsSynced !== undefined && (
                                  <span>Threads synced: {detail.threadsSynced} | </span>
                                )}
                                {detail.threadsSummarized !== undefined && (
                                  <span>Summarized: {detail.threadsSummarized} | </span>
                                )}
                                {detail.insightsGenerated && <span>Insights: ✅ | </span>}
                                {detail.tagsGenerated && detail.tagsGenerated.length > 0 && (
                                  <span>Tags: {detail.tagsGenerated.join(", ")}</span>
                                )}
                              </>
                            )}
                            {detail.action === "skipped" && "Skipped (no email address)"}
                            {detail.action === "error" && detail.error && `Error: ${detail.error}`}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-sm ${
                            detail.action === "processed"
                              ? "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100"
                              : detail.action === "error"
                              ? "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100"
                              : "bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100"
                          }`}
                        >
                          {detail.action.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

