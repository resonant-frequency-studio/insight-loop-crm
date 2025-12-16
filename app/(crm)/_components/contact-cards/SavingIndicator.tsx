"use client";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SavingIndicatorProps {
  status: SaveStatus;
}

export default function SavingIndicator({ status }: SavingIndicatorProps) {
  if (status === "idle") {
    return null;
  }

  if (status === "saving") {
    return (
      <div className="flex items-center gap-1.5 text-blue-600">
        <svg
          className="w-4 h-4 animate-spin"
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
        <span className="text-xs font-medium">Saving...</span>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <div className="flex items-center gap-1.5 text-green-600">
        <svg
          className="w-4 h-4"
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
        <span className="text-xs font-medium">Saved</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5 text-red-600">
        <svg
          className="w-4 h-4"
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
        <span className="text-xs font-medium">Error</span>
      </div>
    );
  }

  return null;
}

