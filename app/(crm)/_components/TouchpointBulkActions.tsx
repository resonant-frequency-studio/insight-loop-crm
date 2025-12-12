"use client";

import BulkActionsBar from "@/components/BulkActionsBar";

interface TouchpointBulkActionsProps {
  selectedCount: number;
  onMarkAsContacted: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export default function TouchpointBulkActions({
  selectedCount,
  onMarkAsContacted,
  onSkip,
  isLoading = false,
}: TouchpointBulkActionsProps) {
  return (
    <BulkActionsBar
      selectedCount={selectedCount}
      itemLabel="touchpoint"
      actions={[
        {
          label: "Mark as Contacted",
          labelMobile: "Mark Contacted",
          onClick: onMarkAsContacted,
          variant: "success",
          disabled: isLoading,
          loading: isLoading,
          showCount: true,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
        },
        {
          label: "Skip Touchpoint",
          labelMobile: "Skip",
          onClick: onSkip,
          variant: "outline",
          disabled: isLoading,
          loading: isLoading,
          showCount: true,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
        },
      ]}
    />
  );
}

