"use client";

import { useState, useMemo, useEffect } from "react";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import Select from "@/components/Select";
import Input from "@/components/Input";
import Checkbox from "@/components/Checkbox";
import { useContactsFilter } from "../contacts/_components/ContactsFilterContext";

interface ContactWithId extends Contact {
  id: string;
}

interface ContactsFilterProps {
  contacts: ContactWithId[];
  disabled?: boolean; // Disable inputs when loading or no contacts
}

export default function ContactsFilter({ contacts, disabled = false }: ContactsFilterProps) {
  const {
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
    showArchived,
    includeNewContacts,
    customFilter,
    lastEmailDateRange,
    onSegmentChange,
    onTagsChange,
    onEmailSearchChange,
    onFirstNameSearchChange,
    onLastNameSearchChange,
    onCompanySearchChange,
    onShowArchivedChange,
    onIncludeNewContactsChange,
    onCustomFilterChange,
    onLastEmailDateRangeChange,
    onClearFilters,
  } = useContactsFilter();
  
  // Auto-expand "More Filters" if any of those filters are active
  // Note: includeNewContacts is in the date filter section, not "More Filters", so it's excluded
  const hasMoreFiltersActive = selectedSegment || selectedTags.length > 0 || emailSearch.trim() || firstNameSearch.trim() || lastNameSearch.trim() || companySearch.trim() || !!customFilter || showArchived;
  const [showMoreFilters, setShowMoreFilters] = useState(hasMoreFiltersActive);
  
  // Reset date filter to default on mount (page load/refresh)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    onLastEmailDateRangeChange({ start, end });
    onIncludeNewContactsChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update showMoreFilters when filters become active
  useEffect(() => {
    if (hasMoreFiltersActive && !showMoreFilters) {
      setShowMoreFilters(true);
    }
  }, [hasMoreFiltersActive, showMoreFilters]);
  const [tagSearch, setTagSearch] = useState<string>("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Get unique segments and tags from contacts
  const uniqueSegments = useMemo(() => 
    Array.from(new Set(contacts.map(c => c.segment).filter(Boolean) as string[])).sort(),
    [contacts]
  );
  const uniqueTags = useMemo(() => {
    const allTags = contacts.flatMap(c => c.tags || []);
    return Array.from(new Set(allTags)).sort();
  }, [contacts]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Parse date from input
  const parseDateFromInput = (dateString: string): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const startDate = parseDateFromInput(e.target.value);
    onLastEmailDateRangeChange({
      start: startDate,
      end: lastEmailDateRange.end,
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const endDate = parseDateFromInput(e.target.value);
    onLastEmailDateRangeChange({
      start: lastEmailDateRange.start,
      end: endDate,
    });
  };

  // Check if date range is default (last 12 months)
  const isDefaultDateRange = useMemo(() => {
    if (!lastEmailDateRange.start || !lastEmailDateRange.end) return true;
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    
    // Normalize dates to start of day for comparison
    const normalizeDate = (date: Date) => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized.getTime();
    };
    
    return (
      normalizeDate(lastEmailDateRange.start) === normalizeDate(start) &&
      normalizeDate(lastEmailDateRange.end) === normalizeDate(end)
    );
  }, [lastEmailDateRange]);

  const hasActiveFilters = selectedSegment || selectedTags.length > 0 || emailSearch.trim() || firstNameSearch.trim() || lastNameSearch.trim() || companySearch.trim() || !!customFilter || !isDefaultDateRange;

  const handleClearDateFilter = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    onLastEmailDateRangeChange({ start, end });
    onIncludeNewContactsChange(true);
  };

  const handleClearMoreFilters = () => {
    onSegmentChange("");
    onTagsChange([]);
    onEmailSearchChange("");
    onFirstNameSearchChange("");
    onLastNameSearchChange("");
    onCompanySearchChange("");
    onCustomFilterChange(null);
    onShowArchivedChange(false);
    onIncludeNewContactsChange(true);
    setTagSearch("");
  };

  // Always render - no early return

  return (
    <Card padding="md">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-theme-darkest">Filters</h2>
      </div>

      {/* Primary Filter: Date Range */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-theme-darker">
            Filter by Last Email Date
          </label>
          {!disabled && (
            <button
              onClick={handleClearDateFilter}
              className="text-sm text-blue-600 hover:text-blue-700 underline cursor-pointer"
            >
             Reset date filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-xs font-medium text-theme-darker mb-1">
              From Date
            </label>
            <Input
              id="start-date"
              type="date"
              value={formatDateForInput(lastEmailDateRange.start)}
              onChange={handleStartDateChange}
              disabled={disabled || contacts.length === 0}
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-xs font-medium text-theme-darker mb-1">
              To Date
            </label>
            <Input
              id="end-date"
              type="date"
              value={formatDateForInput(lastEmailDateRange.end)}
              onChange={handleEndDateChange}
              disabled={disabled || contacts.length === 0}
            />
          </div>
        </div>
        {!isDefaultDateRange && (
          <p className="mt-2 text-xs text-gray-500">
            Showing contacts with last email date between {formatDateForInput(lastEmailDateRange.start)} and {formatDateForInput(lastEmailDateRange.end)}
          </p>
        )}
        <div className="mt-3" style={{ pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', display: 'inline-block' }}>
            <Checkbox
              checked={includeNewContacts}
              onChange={(e) => {
                e.stopPropagation();
                onIncludeNewContactsChange(e.target.checked);
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              label="Include new contacts (no email history)"
              disabled={disabled || contacts.length === 0}
              labelClassName="cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* More Filters - Expandable Section */}
      <div>
        <button
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          className="flex items-center justify-between w-full text-left cursor-pointer py-3 px-2 -mx-2"
          disabled={disabled}
        >
          <span className="text-sm font-medium text-theme-darker">
            More Filters
            {hasMoreFiltersActive && (
              <span className="ml-2 text-xs text-blue-600">({[
                selectedSegment && "Segment",
                selectedTags.length > 0 && `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`,
                emailSearch.trim() && "Email",
                firstNameSearch.trim() && "First Name",
                lastNameSearch.trim() && "Last Name",
                companySearch.trim() && "Company",
                customFilter && "Quick Filter",
                showArchived && "Archived"
              ].filter(Boolean).join(", ")})</span>
            )}
          </span>
          <svg
            className={`w-5 h-5 text-theme-darker transition-transform ${showMoreFilters ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMoreFilters && (
          <div className="space-y-4">
            {/* Clear More Filters Button */}
            {hasMoreFiltersActive && !disabled && (
              <div className="flex justify-end pb-2 border-b border-gray-200">
                <Button
                  onClick={handleClearMoreFilters}
                  variant="link"
                  size="sm"
                  className="text-sm"
                >
                  Clear all filters
                </Button>
              </div>
            )}

            {/* Search Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Email Search */}
              <div>
                <label htmlFor="email-search" className="block text-sm font-medium text-theme-darker mb-2">
                  Search by Email
                </label>
                <Input
                  id="email-search"
                  type="text"
                  value={emailSearch}
                  onChange={(e) => onEmailSearchChange(e.target.value)}
                  placeholder="Enter email address..."
                  disabled={disabled || contacts.length === 0}
                />
              </div>

              {/* Last Name Search */}
              <div>
                <label htmlFor="last-name-search" className="block text-sm font-medium text-theme-darker mb-2">
                  Search by Last Name
                </label>
                <Input
                  id="last-name-search"
                  type="text"
                  value={lastNameSearch}
                  onChange={(e) => onLastNameSearchChange(e.target.value)}
                  placeholder="Enter last name..."
                  disabled={disabled || contacts.length === 0}
                />
              </div>

              {/* First Name Search */}
              <div>
                <label htmlFor="first-name-search" className="block text-sm font-medium text-theme-darker mb-2">
                  Search by First Name
                </label>
                <Input
                  id="first-name-search"
                  type="text"
                  value={firstNameSearch}
                  onChange={(e) => onFirstNameSearchChange(e.target.value)}
                  placeholder="Enter first name..."
                  disabled={disabled || contacts.length === 0}
                />
              </div>

              {/* Company Search */}
              <div>
                <label htmlFor="company-search" className="block text-sm font-medium text-theme-darker mb-2">
                  Search by Company
                </label>
                <Input
                  id="company-search"
                  type="text"
                  value={companySearch}
                  onChange={(e) => onCompanySearchChange(e.target.value)}
                  placeholder="Enter company name..."
                  disabled={disabled || contacts.length === 0}
                />
              </div>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Segment Filter */}
              <div>
                <label htmlFor="segment-filter" className="block text-sm font-medium text-theme-darker mb-2">
                  Filter by Segment
                </label>
                <Select
                  id="segment-filter"
                  value={selectedSegment}
                  onChange={(e) => onSegmentChange(e.target.value)}
                  disabled={disabled || contacts.length === 0}
                >
                  <option value="">All Segments</option>
                  {uniqueSegments.map(segment => (
                    <option key={segment} value={segment}>{segment}</option>
                  ))}
                </Select>
              </div>

              {/* Custom Filters (At-Risk, Warm) */}
              {onCustomFilterChange && (
                <div>
                  <label htmlFor="quick-filters" className="block text-sm font-medium text-theme-darker mb-2">
                    Quick Filters
                  </label>
                  <Select
                    id="quick-filters"
                    value={customFilter || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      onCustomFilterChange(value === "" ? null : (value as "at-risk" | "warm"));
                    }}
                    disabled={disabled || contacts.length === 0}
                  >
                    <option value="">None</option>
                    <option value="at-risk">At-Risk (14+ days no reply)</option>
                    <option value="warm">Warm Leads (50-70 engagement)</option>
                  </Select>
                </div>
              )}

              {/* Tags Filter */}
              <div className={customFilter !== undefined ? "md:col-span-1" : "md:col-span-2"}>
                {/* Tags Filter - Searchable Multi-Select */}
                {uniqueTags.length > 0 && (
                  <div>
                    <label htmlFor="tag-search" className="block text-sm font-medium text-theme-darker mb-2">
                      Filter by Tags
                    </label>
                    
                    {/* Searchable Tag Dropdown */}
                    <div className="relative">
                      <Input
                        id="tag-search"
                        type="text"
                        value={tagSearch}
                        onChange={(e) => {
                          setTagSearch(e.target.value);
                          setShowTagDropdown(true);
                        }}
                        onFocus={() => setShowTagDropdown(true)}
                        placeholder="Search and select tags..."
                        aria-expanded={showTagDropdown}
                        aria-haspopup="listbox"
                        disabled={disabled || contacts.length === 0}
                      />
                      
                      {/* Dropdown - positioned absolutely to prevent layout shift */}
                      {showTagDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowTagDropdown(false)}
                            aria-hidden="true"
                          />
                          <div 
                            className="absolute z-20 w-full top-full mt-1 bg-card-highlight-light border border-gray-200 rounded-sm shadow-lg max-h-60 overflow-y-auto"
                            role="listbox"
                          >
                            {uniqueTags
                              .filter(tag => 
                                !selectedTags.includes(tag) &&
                                tag.toLowerCase().includes(tagSearch.toLowerCase())
                              )
                              .slice(0, 20)
                              .map(tag => (
                                <Button
                                  key={tag}
                                  onClick={() => {
                                    toggleTag(tag);
                                    setTagSearch("");
                                  }}
                                  variant="link"
                                  size="sm"
                                  className="w-full text-left px-4 py-2 no-underline! hover:bg-selected-active hover:text-selected-foreground text-sm text-foreground justify-start"
                                  role="option"
                                  aria-selected="false"
                                >
                                  {tag}
                                </Button>
                              ))}
                            {uniqueTags.filter(tag => 
                              !selectedTags.includes(tag) &&
                              tag.toLowerCase().includes(tagSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-4 py-2 text-sm text-gray-500">
                                No tags found
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Selected Tags Display - Below input */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {selectedTags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-sm text-sm font-medium"
                          >
                            {tag}
                            <Button
                              onClick={() => toggleTag(tag)}
                              variant="link"
                              size="sm"
                              className="p-0 w-auto h-auto hover:text-blue-900"
                              aria-label={`Remove ${tag} tag`}
                              icon={
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              }
                            >
                              <span className="sr-only">Remove {tag}</span>
                            </Button>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {selectedTags.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        {selectedTags.length} {selectedTags.length === 1 ? "tag" : "tags"} selected
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Show Archived Row */}
            <div style={{ pointerEvents: 'none' }}>
              <div style={{ pointerEvents: 'auto', display: 'inline-block' }}>
                <Checkbox
                  checked={showArchived}
                  onChange={(e) => {
                    e.stopPropagation();
                    onShowArchivedChange(e.target.checked);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  label={showArchived ? "Showing archived contacts" : "Show archived contacts"}
                  disabled={disabled || contacts.length === 0}
                  labelClassName="cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

