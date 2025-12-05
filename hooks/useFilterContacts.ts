import { useState, useMemo } from "react";
import { Contact } from "@/types/firestore";

interface ContactWithId extends Contact {
  id: string;
}

interface FilterState {
  selectedSegment: string;
  selectedTags: string[];
  emailSearch: string;
  firstNameSearch: string;
  lastNameSearch: string;
}

interface UseFilterContactsReturn {
  filteredContacts: ContactWithId[];
  filters: FilterState;
  selectedSegment: string;
  selectedTags: string[];
  emailSearch: string;
  firstNameSearch: string;
  lastNameSearch: string;
  setSelectedSegment: (segment: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setEmailSearch: (email: string) => void;
  setFirstNameSearch: (firstName: string) => void;
  setLastNameSearch: (lastName: string) => void;
  onSegmentChange: (segment: string) => void;
  onTagsChange: (tags: string[]) => void;
  onEmailSearchChange: (email: string) => void;
  onFirstNameSearchChange: (firstName: string) => void;
  onLastNameSearchChange: (lastName: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useFilterContacts(
  contacts: ContactWithId[]
): UseFilterContactsReturn {
  // Filter states
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [emailSearch, setEmailSearch] = useState<string>("");
  const [firstNameSearch, setFirstNameSearch] = useState<string>("");
  const [lastNameSearch, setLastNameSearch] = useState<string>("");

  const filters: FilterState = {
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
  };

  const filteredContacts = useMemo(() => {
    let filtered = [...contacts];

    // Filter by segment
    if (filters.selectedSegment) {
      filtered = filtered.filter(c => c.segment === filters.selectedSegment);
    }

    // Filter by tags
    if (filters.selectedTags.length > 0) {
      filtered = filtered.filter(c => 
        c.tags && filters.selectedTags.some(tag => c.tags!.includes(tag))
      );
    }

    // Search by email
    if (filters.emailSearch.trim()) {
      const searchLower = filters.emailSearch.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.primaryEmail?.toLowerCase().includes(searchLower)
      );
    }

    // Search by first name
    if (filters.firstNameSearch.trim()) {
      const searchLower = filters.firstNameSearch.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.firstName?.toLowerCase().includes(searchLower)
      );
    }

    // Search by last name
    if (filters.lastNameSearch.trim()) {
      const searchLower = filters.lastNameSearch.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.lastName?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [contacts, filters.selectedSegment, filters.selectedTags, filters.emailSearch, filters.firstNameSearch, filters.lastNameSearch]);

  const clearFilters = () => {
    setSelectedSegment("");
    setSelectedTags([]);
    setEmailSearch("");
    setFirstNameSearch("");
    setLastNameSearch("");
  };

  const hasActiveFilters = 
    selectedSegment || 
    selectedTags.length > 0 || 
    emailSearch.trim() || 
    firstNameSearch.trim() || 
    lastNameSearch.trim();

  return {
    filteredContacts,
    filters,
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    setSelectedSegment,
    setSelectedTags,
    setEmailSearch,
    setFirstNameSearch,
    setLastNameSearch,
    onSegmentChange: setSelectedSegment,
    onTagsChange: setSelectedTags,
    onEmailSearchChange: setEmailSearch,
    onFirstNameSearchChange: setFirstNameSearch,
    onLastNameSearchChange: setLastNameSearch,
    onClearFilters: clearFilters,
    hasActiveFilters,
  };
}

