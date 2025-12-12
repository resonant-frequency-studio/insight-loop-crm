"use client";

import { useState, useMemo } from "react";
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
}

export default function ContactsFilter({ contacts }: ContactsFilterProps) {
  const {
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
    showArchived,
    customFilter,
    onSegmentChange,
    onTagsChange,
    onEmailSearchChange,
    onFirstNameSearchChange,
    onLastNameSearchChange,
    onCompanySearchChange,
    onShowArchivedChange,
    onCustomFilterChange,
    onClearFilters,
  } = useContactsFilter();
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

  const hasActiveFilters = selectedSegment || selectedTags.length > 0 || emailSearch.trim() || firstNameSearch.trim() || lastNameSearch.trim() || companySearch.trim() || !!customFilter;

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-theme-darkest">Filters & Search</h2>
        {hasActiveFilters && (
          <Button
            onClick={onClearFilters}
            variant="link"
            size="sm"
            className="text-sm"
          >
            Clear all filters
          </Button>
        )}
      </div>

      {/* Search Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
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
                            variant="ghost"
                            size="sm"
                            className="w-full text-left px-4 py-2 hover:bg-theme-darker hover:text-theme-lightest text-sm text-theme-darker justify-start"
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
                        variant="ghost"
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
      <div className="mt-4">
        <Checkbox
          checked={showArchived}
          onChange={(e) => onShowArchivedChange(e.target.checked)}
          label={showArchived ? "Showing archived contacts" : "Show archived contacts"}
        />
      </div>
    </Card>
  );
}

