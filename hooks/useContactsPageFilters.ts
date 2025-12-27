import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useFilterContacts } from "./useFilterContacts";
import { Contact } from "@/types/firestore";

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface ContactWithId extends Contact {
  id: string;
}

interface UseContactsPageFiltersOptions {
  contacts: ContactWithId[];
  itemsPerPage?: number;
}

interface UseContactsPageFiltersReturn {
  // Filter state
  filteredContacts: ContactWithId[];
  hasActiveFilters: boolean;
  lastEmailDateRange: DateRange;
  includeNewContacts: boolean;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
  setIncludeNewContacts: (value: boolean) => void;
  setSelectedSegment: (segment: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setEmailSearch: (email: string) => void;
  setFirstNameSearch: (firstName: string) => void;
  setLastNameSearch: (lastName: string) => void;
  setCompanySearch: (company: string) => void;
  setCustomFilter: (filter: "at-risk" | "warm" | "needs-attention" | null) => void;
  setLastEmailDateRange: (range: DateRange) => void;
  onClearFilters: () => void;
  
  // Filter change handlers (for ContactsFilter component)
  onSegmentChange: (segment: string) => void;
  onTagsChange: (tags: string[]) => void;
  onEmailSearchChange: (email: string) => void;
  onFirstNameSearchChange: (firstName: string) => void;
  onLastNameSearchChange: (lastName: string) => void;
  onCompanySearchChange: (company: string) => void;
  onShowArchivedChange: (show: boolean) => void;
  onIncludeNewContactsChange: (include: boolean) => void;
  onCustomFilterChange: (filter: "at-risk" | "warm" | "needs-attention" | null) => void;
  onLastEmailDateRangeChange: (range: DateRange) => void;
  
  // Pagination
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  totalPages: number;
  paginatedContacts: ContactWithId[];
  startIndex: number;
  endIndex: number;
  
  // Selection management
  selectedContactIds: Set<string>;
  setSelectedContactIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  allFilteredSelected: boolean;
  toggleContactSelection: (contactId: string) => void;
  toggleSelectAll: () => void;
  
  // Filter values (for accessing current filter state)
  selectedSegment: string;
  selectedTags: string[];
  emailSearch: string;
  firstNameSearch: string;
  lastNameSearch: string;
  companySearch: string;
  customFilter?: "at-risk" | "warm" | "needs-attention" | null;
}

const DEFAULT_ITEMS_PER_PAGE = 20;

export function useContactsPageFilters({
  contacts,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
}: UseContactsPageFiltersOptions): UseContactsPageFiltersReturn {
  const searchParams = useSearchParams();
  const prevUrlParamsRef = useRef<string>("");
  
  // Selection state
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Use filtering hook
  const filterContacts = useFilterContacts(contacts);
  const {
    filteredContacts,
    hasActiveFilters,
    onClearFilters,
    showArchived,
    includeNewContacts,
    setShowArchived,
    setIncludeNewContacts,
    setSelectedSegment,
    setSelectedTags,
    setCustomFilter,
    setLeadSourceMissing,
    setEngagementLevel,
    setLastEmailRecent,
    setSentimentNegative,
    setTagsMissing,
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
    customFilter,
    lastEmailDateRange,
    setLastEmailDateRange,
  } = filterContacts;

  // Initialize and update filters from URL search params when they change
  useEffect(() => {
    const segment = searchParams.get("segment");
    const tags = searchParams.get("tags");
    const filter = searchParams.get("filter");
    const leadSource = searchParams.get("leadSource");
    const engagement = searchParams.get("engagement");
    const lastEmail = searchParams.get("lastEmail");
    const sentiment = searchParams.get("sentiment");
    const tagsMissing = searchParams.get("tagsMissing");
    
    // Create a string representation of URL params to detect changes
    const currentUrlParams = JSON.stringify({
      segment,
      tags,
      filter,
      leadSource,
      engagement,
      lastEmail,
      sentiment,
      tagsMissing,
    });
    
    // Only process if URL params have changed
    if (currentUrlParams === prevUrlParamsRef.current) {
      return;
    }
    prevUrlParamsRef.current = currentUrlParams;
    
    // Check if any URL filter parameters are present
    const hasUrlFilters = !!(
      segment ||
      tags ||
      filter ||
      leadSource ||
      engagement ||
      lastEmail ||
      sentiment ||
      tagsMissing
    );
    
    // If URL filters are present, set date range to last 90 days to match insights page
    // This ensures consistency: insights page shows contacts from last 90 days,
    // so the filtered contacts page should show the same scope
    if (hasUrlFilters) {
      queueMicrotask(() => {
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        setLastEmailDateRange({ start: ninetyDaysAgo, end: now });
        setIncludeNewContacts(false); // Exclude contacts without email history to match insights
      });
    }
    
    // Update filters based on URL params
    queueMicrotask(() => {
      if (segment) {
        setSelectedSegment(decodeURIComponent(segment));
      } else {
        setSelectedSegment("");
      }
      
      if (tags) {
        const tagArray = decodeURIComponent(tags).split(",").filter(Boolean);
        if (tagArray.length > 0) {
          setSelectedTags(tagArray);
        } else {
          setSelectedTags([]);
        }
      } else {
        setSelectedTags([]);
      }
      
      // Handle custom filter types from AI Insights
      if (filter === "at-risk" || filter === "warm" || filter === "needs-attention") {
        setCustomFilter(filter as "at-risk" | "warm" | "needs-attention");
      } else {
        setCustomFilter(null);
      }
      
      // Handle lead source filter
      if (leadSource === "missing") {
        setLeadSourceMissing(true);
      } else {
        setLeadSourceMissing(false);
      }
      
      // Handle engagement level filter
      if (engagement === "low" || engagement === "high") {
        setEngagementLevel(engagement);
      } else {
        setEngagementLevel(null);
      }
      
      // Handle recent last email filter
      if (lastEmail === "recent") {
        setLastEmailRecent(true);
      } else {
        setLastEmailRecent(false);
      }
      
      // Handle sentiment filter
      if (sentiment === "negative") {
        setSentimentNegative(true);
      } else {
        setSentimentNegative(false);
      }
      
      // Handle missing tag filter
      if (tagsMissing) {
        setTagsMissing(decodeURIComponent(tagsMissing));
      } else {
        setTagsMissing(null);
      }
    });
  }, [searchParams, setSelectedSegment, setSelectedTags, setCustomFilter, setLeadSourceMissing, setEngagementLevel, setLastEmailRecent, setSentimentNegative, setTagsMissing, setLastEmailDateRange, setIncludeNewContacts]);

  // Reset to page 1 when filters change
  useEffect(() => {
    // Defer state update to avoid synchronous setState in effect
    queueMicrotask(() => {
      setCurrentPage(1);
    });
  }, [
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
    customFilter,
    showArchived,
    includeNewContacts,
    lastEmailDateRange,
    filterContacts.leadSourceMissing,
    filterContacts.engagementLevel,
    filterContacts.lastEmailRecent,
    filterContacts.sentimentNegative,
    filterContacts.tagsMissing,
  ]);

  // Paginate filtered contacts
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // Check if all filtered contacts are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredContacts.length === 0) return false;
    return filteredContacts.every((contact) => selectedContactIds.has(contact.id));
  }, [filteredContacts, selectedContactIds]);

  // Clear selection when filters change
  const prevFiltersRef = useRef({
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
  });

  useEffect(() => {
    const currentFilters = {
      selectedSegment,
      selectedTags,
      emailSearch,
      firstNameSearch,
      lastNameSearch,
      companySearch,
    };

    const filtersChanged =
      prevFiltersRef.current.selectedSegment !== currentFilters.selectedSegment ||
      JSON.stringify(prevFiltersRef.current.selectedTags) !== JSON.stringify(currentFilters.selectedTags) ||
      prevFiltersRef.current.emailSearch !== currentFilters.emailSearch ||
      prevFiltersRef.current.firstNameSearch !== currentFilters.firstNameSearch ||
      prevFiltersRef.current.lastNameSearch !== currentFilters.lastNameSearch ||
      prevFiltersRef.current.companySearch !== currentFilters.companySearch;

    if (filtersChanged) {
      prevFiltersRef.current = currentFilters;
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setSelectedContactIds(new Set());
      });
    }
  }, [
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
  ]);

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  return {
    // Filter state
    filteredContacts,
    hasActiveFilters,
    showArchived,
    includeNewContacts,
    setShowArchived,
    setIncludeNewContacts,
    setSelectedSegment,
    setSelectedTags,
    setEmailSearch: filterContacts.setEmailSearch,
    setFirstNameSearch: filterContacts.setFirstNameSearch,
    setLastNameSearch: filterContacts.setLastNameSearch,
    setCompanySearch: filterContacts.setCompanySearch,
    setCustomFilter,
    onClearFilters,
    
    // Filter change handlers (for ContactsFilter component)
    onSegmentChange: setSelectedSegment,
    onTagsChange: setSelectedTags,
    onEmailSearchChange: filterContacts.setEmailSearch,
    onFirstNameSearchChange: filterContacts.setFirstNameSearch,
    onLastNameSearchChange: filterContacts.setLastNameSearch,
    onCompanySearchChange: filterContacts.setCompanySearch,
    onShowArchivedChange: setShowArchived,
    onIncludeNewContactsChange: setIncludeNewContacts,
    onCustomFilterChange: setCustomFilter,
    lastEmailDateRange,
    setLastEmailDateRange,
    onLastEmailDateRangeChange: setLastEmailDateRange,
    
    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedContacts,
    startIndex,
    endIndex,
    
    // Selection management
    selectedContactIds,
    setSelectedContactIds,
    allFilteredSelected,
    toggleContactSelection,
    toggleSelectAll,
    
    // Filter values
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
    customFilter,
  };
}

