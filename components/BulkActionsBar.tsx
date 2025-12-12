"use client";

import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { ReactNode } from "react";

interface BulkAction {
  label: string;
  labelMobile?: string; // Optional shorter label for mobile
  onClick: () => void;
  variant?: "gradient-green" | "gradient-gray" | "gradient-blue" | "gradient-emerald" | "primary" | "secondary" | "danger" | "success" | "outline" | "ghost";
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  showCount?: boolean; // Whether to show count in button label
}

interface BulkActionsBarProps {
  selectedCount: number;
  itemLabel: string; // e.g., "contact", "touchpoint", "action item"
  actions: BulkAction[];
  className?: string;
}

export default function BulkActionsBar({
  selectedCount,
  itemLabel,
  actions,
  className = "",
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card padding="md" className={`bg-blue-50 border-blue-200 mb-4 ${className}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center">
          <span className="text-sm font-medium text-theme-darkest whitespace-nowrap">
            {selectedCount} {itemLabel}{selectedCount !== 1 ? "s" : ""} selected
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              disabled={action.disabled}
              loading={action.loading}
              variant={action.variant}
              size="sm"
              fullWidth
              className="sm:w-auto whitespace-nowrap shrink-0"
              icon={action.icon}
            >
              <span className="hidden sm:inline">{action.label}</span>
              <span className="sm:hidden">{action.labelMobile || action.label}</span>
              {action.showCount && <span className="ml-1 font-semibold">({selectedCount})</span>}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}

