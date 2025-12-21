"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { CalendarEvent } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import Select from "@/components/Select";
import Input from "@/components/Input";
import Checkbox from "@/components/Checkbox";

export interface CalendarFilters {
  segment?: string | null;
  tags?: string[];
  onlyLinked?: boolean;
  onlyTouchpoints?: boolean;
  search?: string;
}

interface CalendarFilterBarProps {
  events: CalendarEvent[];
  filters: CalendarFilters;
  onFiltersChange: (filters: CalendarFilters) => void;
  disabled?: boolean; // Disable inputs when loading or no events
}

export default function CalendarFilterBar({
  events,
  filters,
  onFiltersChange,
  disabled = false,
}: CalendarFilterBarProps) {
  const [tagSearch, setTagSearch] = useState<string>("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };

    if (showTagDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTagDropdown]);

  // Extract unique segments and tags from events' contactSnapshots
  const uniqueSegments = useMemo(() => {
    const segments = events
      .map((e) => e.contactSnapshot?.segment)
      .filter((s): s is string => !!s);
    return Array.from(new Set(segments)).sort();
  }, [events]);

  const uniqueTags = useMemo(() => {
    const allTags = events.flatMap((e) => e.contactSnapshot?.tags || []);
    return Array.from(new Set(allTags)).sort();
  }, [events]);

  const toggleTag = (tag: string) => {
    const currentTags = filters.tags || [];
    if (currentTags.includes(tag)) {
      onFiltersChange({
        ...filters,
        tags: currentTags.filter((t) => t !== tag),
      });
    } else {
      onFiltersChange({
        ...filters,
        tags: [...currentTags, tag],
      });
    }
  };

  const hasActiveFilters =
    filters.segment ||
    (filters.tags && filters.tags.length > 0) ||
    filters.onlyLinked ||
    filters.onlyTouchpoints ||
    (filters.search && filters.search.trim().length > 0);

  const handleClearFilters = () => {
    onFiltersChange({
      segment: undefined,
      tags: undefined,
      onlyLinked: false,
      onlyTouchpoints: false,
      search: undefined,
    });
  };

  // Always render - no early return

  const filteredTags = uniqueTags.filter((tag) =>
    tag.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-theme-darkest">Filters & Search</h2>
        {hasActiveFilters && !disabled && (
          <Button
            onClick={handleClearFilters}
            variant="link"
            size="sm"
            className="text-sm"
          >
            Clear all filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        {/* Segment Filter */}
        <div>
          <label htmlFor="segment-filter" className="block text-sm font-medium text-theme-darker mb-2">
            Segment
          </label>
          <Select
            id="segment-filter"
            value={filters.segment || ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                segment: e.target.value || undefined,
              })
            }
            disabled={disabled || events.length === 0}
          >
            <option value="">All Segments</option>
            {uniqueSegments.map((segment) => (
              <option key={segment} value={segment}>
                {segment}
              </option>
            ))}
          </Select>
        </div>

        {/* Tags Filter */}
        <div className="relative" ref={tagDropdownRef}>
          <label className="block text-sm font-medium text-theme-darker mb-2">
            Tags
          </label>
          <div className="relative">
            <Input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              onFocus={() => setShowTagDropdown(true)}
              placeholder="Search tags..."
              className="pr-10"
              disabled={disabled || events.length === 0}
            />
            {showTagDropdown && filteredTags.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredTags.map((tag) => (
                  <div
                    key={tag}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      toggleTag(tag);
                      setTagSearch("");
                    }}
                  >
                    <Checkbox
                      checked={(filters.tags || []).includes(tag)}
                      onChange={() => {
                        toggleTag(tag);
                        setTagSearch("");
                      }}
                      label={tag}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Selected tags display */}
          {filters.tags && filters.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {filters.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {tag}
                  <button
                    onClick={() => toggleTag(tag)}
                    className="hover:text-blue-900"
                    aria-label={`Remove ${tag} filter`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div>
          <label htmlFor="event-search" className="block text-sm font-medium text-theme-darker mb-2">
            Search Events
          </label>
          <Input
            id="event-search"
            type="text"
            value={filters.search || ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                search: e.target.value,
              })
            }
            placeholder="Search by title or contact name..."
            disabled={disabled || events.length === 0}
          />
        </div>
      </div>

      {/* Toggles Row */}
      <div className="flex flex-wrap gap-4">
        <Checkbox
          checked={filters.onlyLinked || false}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              onlyLinked: e.target.checked,
            })
          }
          label="Only Linked Events"
          disabled={disabled || events.length === 0}
        />
        <Checkbox
          checked={filters.onlyTouchpoints || false}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              onlyTouchpoints: e.target.checked,
            })
          }
          label="Only Touchpoints"
          disabled={disabled || events.length === 0}
        />
      </div>
    </Card>
  );
}

