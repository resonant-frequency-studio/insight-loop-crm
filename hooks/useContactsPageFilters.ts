import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useFilterContacts } from "./useFilterContacts";
import { Contact } from "@/types/firestore";

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
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
  setSelectedSegment: (segment: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setEmailSearch: (email: string) => void;
  setFirstNameSearch: (firstName: string) => void;
  setLastNameSearch: (lastName: string) => void;
  setCompanySearch: (company: string) => void;
  setCustomFilter: (filter: "at-risk" | "warm" | null) => void;
  onClearFilters: () => void;
  
  // Filter change handlers (for ContactsFilter component)
  onSegmentChange: (segment: string) => void;
  onTagsChange: (tags: string[]) => void;
  onEmailSearchChange: (email: string) => void;
  onFirstNameSearchChange: (firstName: string) => void;
  onLastNameSearchChange: (lastName: string) => void;
  onCompanySearchChange: (company: string) => void;
  onShowArchivedChange: (show: boolean) => void;
  onCustomFilterChange: (filter: "at-risk" | "warm" | null) => void;
  
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
  customFilter?: "at-risk" | "warm" | null;
}

const DEFAULT_ITEMS_PER_PAGE = 20;

export function useContactsPageFilters({
  contacts,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
}: UseContactsPageFiltersOptions): UseContactsPageFiltersReturn {
  const searchParams = useSearchParams();
  const urlParamsInitializedRef = useRef(false);
  
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
    setShowArchived,
    setSelectedSegment,
    setSelectedTags,
    setCustomFilter,
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
    customFilter,
  } = filterContacts;

  // Initialize filters from URL search params on mount
  useEffect(() => {
    if (urlParamsInitializedRef.current) return; // Only initialize once
    
    const segment = searchParams.get("segment");
    const tags = searchParams.get("tags");
    const filter = searchParams.get("filter");
    
    if (segment) {
      setSelectedSegment(decodeURIComponent(segment));
    }
    
    if (tags) {
      const tagArray = decodeURIComponent(tags).split(",").filter(Boolean);
      if (tagArray.length > 0) {
        setSelectedTags(tagArray);
      }
    }
    
    // Handle custom filter types from AI Insights
    if (filter === "at-risk" || filter === "warm") {
      setCustomFilter(filter as "at-risk" | "warm");
    }
    
    urlParamsInitializedRef.current = true;
  }, [searchParams, setSelectedSegment, setSelectedTags, setCustomFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    // Use setTimeout to defer the state update and avoid synchronous setState in effect
    setTimeout(() => {
      setCurrentPage(1);
    }, 0);
  }, [
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
    customFilter,
    showArchived,
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
      // Use setTimeout to defer the state update and avoid synchronous setState in effect
      setTimeout(() => {
        setSelectedContactIds(new Set());
      }, 0);
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
    setShowArchived,
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
    onCustomFilterChange: setCustomFilter,
    
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

