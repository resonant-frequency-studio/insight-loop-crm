"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { reportException } from "@/lib/error-reporting";

interface TagUsage {
  tag: string;
  count: number;
}

export default function CleanupTagsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [tags, setTags] = useState<TagUsage[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    dryRun: boolean;
    processed: number;
    updated: number;
    skipped: number;
    errors: number;
    errorDetails?: string[];
    details?: Array<{
      contactId: string;
      email: string;
      action: "updated" | "skipped" | "error";
      tagsRemoved?: string[];
      error?: string;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load tags on mount
  useEffect(() => {
    if (user) {
      loadTags();
    }
  }, [user]);

  const loadTags = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/cleanup-tags");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load tags");
      }

      setTags(data.tags || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      reportException(err, {
        context: "Loading tag usage",
        tags: { component: "CleanupTagsPage" },
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const selectUnusedTags = () => {
    const unusedTags = tags.filter((t) => t.count === 0).map((t) => t.tag);
    setSelectedTags(new Set(unusedTags));
  };

  const handleCleanup = async () => {
    if (selectedTags.size === 0) {
      alert("Please select at least one tag to remove");
      return;
    }

    if (!dryRun && !confirm(
      `This will remove ${selectedTags.size} tag(s) from all contacts. ` +
      "This action cannot be undone. Continue?"
    )) {
      return;
    }

    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/cleanup-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagsToRemove: Array.from(selectedTags),
          dryRun,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Cleanup failed");
      }

      setResult(data);
      
      // Reload tags after cleanup (if not dry run)
      if (!dryRun) {
        setTimeout(() => {
          loadTags();
          setSelectedTags(new Set());
        }, 1000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      reportException(err, {
        context: "Cleaning up tags",
        tags: { component: "CleanupTagsPage" },
      });
    } finally {
      setRunning(false);
    }
  };

  if (authLoading || loading) {
    return <Loading />;
  }

  if (!user) {
    return null;
  }

  const unusedTags = tags.filter((t) => t.count === 0);
  const usedTags = tags.filter((t) => t.count > 0);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Tag Cleanup</h1>
        <p className="text-theme-dark text-lg">
          View tag usage and remove tags from all contacts
        </p>
      </div>

      <Card padding="md" className="bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5"
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
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">Warning</h3>
            <p className="text-sm text-yellow-800">
              Removing tags will permanently delete them from all contacts. This action cannot be undone.
              Use dry run mode first to preview changes.
            </p>
          </div>
        </div>
      </Card>

      {/* Tag Statistics */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-theme-darkest">Tag Usage Statistics</h2>
          <Button
            onClick={loadTags}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-sm">
            <div className="text-2xl font-bold text-theme-darkest">{tags.length}</div>
            <div className="text-sm text-theme-dark">Total Tags</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-sm">
            <div className="text-2xl font-bold text-blue-900">{usedTags.length}</div>
            <div className="text-sm text-blue-600">In Use</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-sm">
            <div className="text-2xl font-bold text-red-900">{unusedTags.length}</div>
            <div className="text-sm text-red-600">Unused</div>
          </div>
        </div>

        {/* Tag Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-theme-darkest">
              Select Tags to Remove ({selectedTags.size} selected)
            </h3>
            <div className="flex gap-2">
              {unusedTags.length > 0 && (
                <Button
                  onClick={selectUnusedTags}
                  variant="outline"
                  size="sm"
                >
                  Select All Unused
                </Button>
              )}
              <Button
                onClick={() => setSelectedTags(new Set())}
                variant="outline"
                size="sm"
              >
                Clear Selection
              </Button>
            </div>
          </div>

          {/* Unused Tags Section */}
          {unusedTags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-theme-darker mb-2">
                Unused Tags ({unusedTags.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {unusedTags.map((tagUsage) => (
                  <button
                    key={tagUsage.tag}
                    onClick={() => toggleTag(tagUsage.tag)}
                    className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                      selectedTags.has(tagUsage.tag)
                        ? "bg-red-100 text-red-800 border-2 border-red-300"
                        : "bg-gray-100 text-theme-darker border-2 border-transparent hover:bg-gray-200"
                    }`}
                  >
                    {tagUsage.tag} (0)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Used Tags Section */}
          {usedTags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-theme-darker mb-2">
                Tags in Use ({usedTags.length})
              </h4>
              <div className="flex flex-wrap gap-2 max-h-96 overflow-y-auto">
                {usedTags.map((tagUsage) => (
                  <button
                    key={tagUsage.tag}
                    onClick={() => toggleTag(tagUsage.tag)}
                    className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                      selectedTags.has(tagUsage.tag)
                        ? "bg-red-100 text-red-800 border-2 border-red-300"
                        : "bg-blue-50 text-blue-700 border-2 border-transparent hover:bg-blue-100"
                    }`}
                  >
                    {tagUsage.tag} ({tagUsage.count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {tags.length === 0 && (
            <p className="text-gray-500 text-center py-8">No tags found</p>
          )}
        </div>
      </Card>

      {/* Actions */}
      <Card padding="md">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="dryRun" className="text-sm font-medium text-theme-darkest">
              Dry run mode (preview changes without applying them)
            </label>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleCleanup}
              disabled={running || selectedTags.size === 0}
              loading={running}
              variant="gradient-blue"
              size="md"
            >
              {dryRun ? "Preview Changes" : "Remove Selected Tags"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Error Display */}
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
              <h3 className="text-lg font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Results Display */}
      {result && (
        <Card padding="md" className={result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <svg
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  result.success ? "text-green-600" : "text-red-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={result.success
                    ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"}
                />
              </svg>
              <div className="flex-1">
                <h3 className={`text-lg font-semibold mb-1 ${
                  result.success ? "text-green-900" : "text-red-900"
                }`}>
                  {result.dryRun ? "Dry Run Results" : "Cleanup Complete"}
                </h3>
                <p className={`text-sm mb-4 ${
                  result.success ? "text-green-800" : "text-red-800"
                }`}>
                  {result.message}
                </p>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-2xl font-bold text-theme-darkest">{result.processed}</div>
                    <div className="text-xs text-theme-dark">Processed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">{result.updated}</div>
                    <div className="text-xs text-green-600">Updated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-theme-darkest">{result.skipped}</div>
                    <div className="text-xs text-theme-dark">Skipped</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-900">{result.errors}</div>
                    <div className="text-xs text-red-600">Errors</div>
                  </div>
                </div>

                {result.errorDetails && result.errorDetails.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-red-900 mb-2">Error Details:</h4>
                    <ul className="list-disc list-inside text-xs text-red-800 space-y-1">
                      {result.errorDetails.slice(0, 10).map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                      {result.errorDetails.length > 10 && (
                        <li>... and {result.errorDetails.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

