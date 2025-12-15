"use client";

import { Button } from "@/components/Button";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveButtonWithIndicatorProps {
  saveStatus: SaveStatus;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  className?: string;
}

export default function SaveButtonWithIndicator({
  saveStatus,
  hasUnsavedChanges,
  onSave,
  className = "",
}: SaveButtonWithIndicatorProps) {
  return (
    <div 
      data-testid="saving-indicator" 
      data-status={saveStatus}
      className={`flex items-center gap-2 ${className}`}
    >
      {saveStatus === "saving" && (
        <span className="text-xs text-blue-600 font-medium">Saving...</span>
      )}
      <Button
        variant="secondary"
        size="xs"
        onClick={onSave}
        disabled={!hasUnsavedChanges || saveStatus === "saving"}
      >
        Save
      </Button>
    </div>
  );
}

