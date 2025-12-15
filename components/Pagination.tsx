"use client";

import { Button } from "./Button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemLabel: string; // e.g., "contact" or "action item"
  onPageChange: (page: number) => void;
  className?: string;
  hideItemCount?: boolean; // If true, hide the "Showing x to y of z" text
}

/**
 * Reusable Pagination component
 * Displays pagination controls with Previous/Next buttons and item count
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  itemLabel,
  onPageChange,
  className = "",
  hideItemCount = false,
}: PaginationProps) {
  // Don't render if there's only one page
  if (totalPages <= 1) return null;

  // Simple pluralization: add 's' to the end (works for most cases)
  const itemLabelPlural = `${itemLabel}s`;
  const itemText = totalItems === 1 ? itemLabel : itemLabelPlural;

  return (
    <div className={`flex flex-col sm:flex-row items-center ${hideItemCount ? 'justify-end' : 'justify-between'} gap-4 ${hideItemCount ? 'pb-4 mb-4 border-b border-gray-200' : 'border-t border-gray-200 pt-4 mt-4'} ${className}`}>
      {!hideItemCount && (
        <div className="text-sm text-theme-darker">
          Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of{" "}
          {totalItems} {itemText}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          variant="outline"
          size="sm"
        >
          Previous
        </Button>
        <span className="flex items-center px-4 text-sm text-theme-darker">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          variant="outline"
          size="sm"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

