"use client";

import { useState, useMemo } from "react";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "./Button";

interface ContactWithId extends Contact {
  id: string;
}

interface ContactsFilterProps {
  contacts: ContactWithId[];
  selectedSegment: string;
  selectedTags: string[];
  emailSearch: string;
  firstNameSearch: string;
  lastNameSearch: string;
  showArchived: boolean;
  onSegmentChange: (segment: string) => void;
  onTagsChange: (tags: string[]) => void;
  onEmailSearchChange: (email: string) => void;
  onFirstNameSearchChange: (firstName: string) => void;
  onLastNameSearchChange: (lastName: string) => void;
  onShowArchivedChange: (show: boolean) => void;
  onClearFilters: () => void;
}

export default function ContactsFilter({
  contacts,
  selectedSegment,
  selectedTags,
  emailSearch,
  firstNameSearch,
  lastNameSearch,
  showArchived,
  onSegmentChange,
  onTagsChange,
  onEmailSearchChange,
  onFirstNameSearchChange,
  onLastNameSearchChange,
  onShowArchivedChange,
  onClearFilters,
}: ContactsFilterProps) {
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

  const hasActiveFilters = selectedSegment || selectedTags.length > 0 || emailSearch.trim() || firstNameSearch.trim() || lastNameSearch.trim();

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Filters & Search</h2>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Email Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search by Email
          </label>
          <input
            type="text"
            value={emailSearch}
            onChange={(e) => onEmailSearchChange(e.target.value)}
            placeholder="Enter email address..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Last Name Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search by Last Name
          </label>
          <input
            type="text"
            value={lastNameSearch}
            onChange={(e) => onLastNameSearchChange(e.target.value)}
            placeholder="Enter last name..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* First Name Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search by First Name
          </label>
          <input
            type="text"
            value={firstNameSearch}
            onChange={(e) => onFirstNameSearchChange(e.target.value)}
            placeholder="Enter first name..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Segment Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Segment
          </label>
          <select
            value={selectedSegment}
            onChange={(e) => onSegmentChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Segments</option>
            {uniqueSegments.map(segment => (
              <option key={segment} value={segment}>{segment}</option>
            ))}
          </select>
        </div>

        {/* Show Archived Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            View Archived
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onShowArchivedChange(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {showArchived ? "Showing archived contacts" : "Show archived contacts"}
            </span>
          </label>
        </div>

        {/* Tags Filter - Searchable Multi-Select */}
        {uniqueTags.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Tags
            </label>
            
            {/* Selected Tags Display */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
                  >
                    {tag}
                    <Button
                      onClick={() => toggleTag(tag)}
                      variant="ghost"
                      size="sm"
                      className="p-0 w-auto h-auto hover:text-blue-900"
                      title="Remove tag"
                      icon={
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* Searchable Tag Dropdown */}
            <div className="relative">
              <input
                type="text"
                value={tagSearch}
                onChange={(e) => {
                  setTagSearch(e.target.value);
                  setShowTagDropdown(true);
                }}
                onFocus={() => setShowTagDropdown(true)}
                placeholder="Search and select tags..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              
              {/* Dropdown */}
              {showTagDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowTagDropdown(false)}
                  />
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 justify-start"
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
            
            {selectedTags.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {selectedTags.length} {selectedTags.length === 1 ? "tag" : "tags"} selected
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

