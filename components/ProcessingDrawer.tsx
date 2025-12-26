"use client";

import { ReactNode } from "react";

export type ProcessingStatus = "pending" | "running" | "complete" | "error";

export interface ProcessingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  status: ProcessingStatus;
  title: string;
  message?: string;
  errorMessage?: string | null;
  progress?: {
    current: number;
    total: number;
    label?: string;
  };
  details?: ReactNode;
  showBackdrop?: boolean;
  allowCloseWhileRunning?: boolean;
}

export default function ProcessingDrawer({
  isOpen,
  onClose,
  status,
  title,
  message,
  errorMessage,
  progress,
  details,
  showBackdrop = true,
  allowCloseWhileRunning = true,
}: ProcessingDrawerProps) {
  if (!isOpen) return null;

  // Determine styles based on status
  const getStatusStyles = () => {
    switch (status) {
      case "error":
        return {
          bg: "bg-red-50 dark:bg-red-900/20",
          border: "border-red-200 dark:border-red-800",
          text: "text-red-800 dark:text-red-200",
          iconColor: "text-red-600 dark:text-red-400",
        };
      case "complete":
        return {
          bg: "bg-green-50 dark:bg-green-900/20",
          border: "border-green-200 dark:border-green-800",
          text: "text-green-800 dark:text-green-200",
          iconColor: "text-green-600 dark:text-green-400",
        };
      case "running":
      case "pending":
        return {
          bg: "bg-blue-50 dark:bg-blue-900/20",
          border: "border-blue-200 dark:border-blue-800",
          text: "text-blue-800 dark:text-blue-200",
          iconColor: "text-blue-600 dark:text-blue-400",
        };
      default:
        return {
          bg: "bg-white dark:bg-gray-800",
          border: "border-gray-200 dark:border-gray-700",
          text: "text-theme-darkest",
          iconColor: "text-theme-darkest",
        };
    }
  };

  const statusStyles = getStatusStyles();
  const isRunning = status === "running" || status === "pending";
  const canClose = allowCloseWhileRunning || !isRunning;

  const handleClose = () => {
    if (canClose) {
      onClose();
    }
  };

  const progressPercentage =
    progress && progress.total > 0
      ? Math.min(100, (progress.current / progress.total) * 100)
      : 0;

  return (
    <>
      {/* Backdrop */}
      {showBackdrop && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div className="fixed bottom-4 right-4 z-50 max-w-md w-full mx-4">
        <div
          className={`${statusStyles.bg} ${statusStyles.border} border rounded-sm p-4 shadow-lg ${statusStyles.text}`}
        >
          {/* Header with dismiss button */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            {canClose && (
              <button
                onClick={handleClose}
                className="shrink-0 hover:opacity-70 transition-opacity"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Status Icon and Message */}
            <div className="flex items-start gap-2">
              {isRunning && (
                <svg
                  className={`w-5 h-5 ${statusStyles.iconColor} shrink-0 mt-0.5 animate-spin`}
                  fill="none"
                  stroke="currentColor"
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
              )}
              {status === "complete" && (
                <svg
                  className={`w-5 h-5 ${statusStyles.iconColor} shrink-0 mt-0.5`}
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
              )}
              {status === "error" && (
                <svg
                  className={`w-5 h-5 ${statusStyles.iconColor} shrink-0 mt-0.5`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <div className="flex-1 min-w-0">
                {message && (
                  <p className="text-sm font-medium mb-1">{message}</p>
                )}
                {errorMessage && status === "error" && (
                  <p className="text-xs opacity-80 mt-1">{errorMessage}</p>
                )}
                {!message && !errorMessage && status === "complete" && (
                  <p className="text-xs opacity-80">Operation completed successfully</p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {isRunning && progress && (
              <div className="space-y-2">
                {progress.label && (
                  <p className="text-xs opacity-80">{progress.label}</p>
                )}
                <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-current h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                {progress.total > 0 && (
                  <p className="text-xs opacity-70">
                    {progress.current} / {progress.total}
                  </p>
                )}
              </div>
            )}

            {/* Additional Details */}
            {details && <div className="text-sm">{details}</div>}

            {/* Background processing note */}
            {isRunning && (
              <p className="text-xs opacity-70 italic">
                You can navigate away - processing will continue in the background
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

