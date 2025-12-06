"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { SyncJob } from "@/types/firestore";

export default function SyncStatusPage() {
  const { user, loading: authLoading } = useAuth();
  const { lastSync, syncHistory, loading: syncLoading, error } = useSyncStatus(user?.uid || null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncError(null);

    try {
      const response = await fetch("/api/gmail/sync?type=auto");
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || "Sync failed");
      }

      // Status will update automatically via real-time listener
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start sync";
      setSyncError(errorMessage);
      console.error("Manual sync error:", error);
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
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  if (authLoading || syncLoading) {
    return <Loading />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Gmail Sync Status</h1>
          <p className="text-gray-600 text-lg">
            Monitor your email synchronization status and history
          </p>
        </div>
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="px-6 py-3 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {syncing ? (
            <>
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
              Syncing...
            </>
          ) : (
            <>
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
              Sync Now
            </>
          )}
        </button>
      </div>

      {syncError && (
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
            <p className="text-red-800 font-medium">{syncError}</p>
          </div>
        </Card>
      )}

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

      {/* Last Sync Status */}
      {lastSync && (
        <Card padding="md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Last Sync</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                  lastSync.status
                )}`}
              >
                {lastSync.status.charAt(0).toUpperCase() + lastSync.status.slice(1)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Started At</p>
              <p className="text-gray-900">{formatDate(lastSync.startedAt)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Type</p>
              <p className="text-gray-900 capitalize">{lastSync.type || "auto"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Threads Processed</p>
              <p className="text-2xl font-bold text-gray-900">{lastSync.processedThreads || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Messages Processed</p>
              <p className="text-2xl font-bold text-gray-900">{lastSync.processedMessages || 0}</p>
            </div>
            {lastSync.finishedAt && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Finished At</p>
                <p className="text-gray-900">{formatDate(lastSync.finishedAt)}</p>
              </div>
            )}
          </div>
          {lastSync.errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {lastSync.errorMessage}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Sync History */}
      <Card padding="md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sync History</h2>
        {syncHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No sync history available yet</p>
        ) : (
          <div className="space-y-3">
            {syncHistory.map((job) => (
              <div
                key={job.syncJobId}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Started</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(job.startedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Threads</p>
                    <p className="text-sm font-medium text-gray-900">
                      {job.processedThreads || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Messages</p>
                    <p className="text-sm font-medium text-gray-900">
                      {job.processedMessages || 0}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

