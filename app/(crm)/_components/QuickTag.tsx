"use client";

import { useState, useRef, useEffect } from "react";
import { useUpdateContact } from "@/hooks/useContactMutations";
import Input from "@/components/Input";

interface QuickTagProps {
  contactId: string;
  userId: string;
  existingTags?: string[];
  onTagAdded?: () => void;
}

export default function QuickTag({
  contactId,
  userId,
  existingTags = [],
  onTagAdded,
}: QuickTagProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tagValue, setTagValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateContact = useUpdateContact(userId);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handlePlusClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(true);
    setError(null);
  };

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsExpanded(false);
    setTagValue("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const trimmedTag = tagValue.trim();

    // Validate: empty tag
    if (!trimmedTag) {
      setError("Tag cannot be empty");
      return;
    }

    // Validate: duplicate tag (case-insensitive)
    const normalizedExisting = existingTags.map((tag) => tag.toLowerCase().trim());
    if (normalizedExisting.includes(trimmedTag.toLowerCase())) {
      setError("Tag already exists");
      return;
    }

    setError(null);

    // Prepare updated tags array - add new tag to the beginning
    const updatedTags = [trimmedTag, ...existingTags];

    try {
      await updateContact.mutateAsync({
        contactId,
        updates: {
          tags: updatedTags,
        },
      });

      // Success - reset and close
      setTagValue("");
      setIsExpanded(false);
      onTagAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={handlePlusClick}
        className="cursor-pointer px-2 py-1 text-xs font-medium border border-card-tag text-card-tag-text rounded-sm hover:bg-card-tag/10 transition-colors flex items-center justify-center shrink-0"
        aria-label="Add tag"
        title="Add tag"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-1 shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="text"
          value={tagValue}
          onChange={(e) => {
            setTagValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Tag name"
          className="w-24 h-7 px-2 py-1 text-xs"
          disabled={updateContact.isPending}
        />
        <button
          type="submit"
          disabled={updateContact.isPending || !tagValue.trim()}
          className="cursor-pointer px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Add tag"
        >
          {updateContact.isPending ? (
            <svg
              className="animate-spin h-3 w-3"
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={updateContact.isPending}
          className="cursor-pointer px-2 py-1 text-xs font-medium border border-gray-300 text-gray-200 rounded-sm hover:bg-gray-50/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Cancel"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      {error && (
        <span className="text-xs text-red-600 whitespace-nowrap" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

