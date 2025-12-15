"use client";

import { useEffect } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Button } from "@/components/Button";
import { reportException } from "@/lib/error-reporting";

export default function CrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service (Sentry if configured)
    reportException(error, {
      context: "CRM Error Boundary",
      tags: {
        component: "CrmError",
        ...(error.digest && { digest: error.digest }),
      },
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <div className="bg-background border border-red-200 rounded-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h2>
          <ErrorMessage
            message={error.message || "An unexpected error occurred"}
            dismissible={false}
          />
          <div className="mt-4 flex gap-2">
            <Button onClick={reset} variant="secondary" size="sm">
              Try again
            </Button>
            <Button
              onClick={() => (window.location.href = "/")}
              size="sm"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

