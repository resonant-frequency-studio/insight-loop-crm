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
  upcomingTouchpoints: boolean;
  showArchived: boolean;
}

interface UseFilterContactsReturn {
  filteredContacts: ContactWithId[];
  filters: FilterState;
  selectedSegment: string;
  selectedTags: string[];
  emailSearch: string;
  firstNameSearch: string;
  lastNameSearch: string;
  upcomingTouchpoints: boolean;
  showArchived: boolean;
  setSelectedSegment: (segment: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setEmailSearch: (email: string) => void;
  setFirstNameSearch: (firstName: string) => void;
  setLastNameSearch: (lastName: string) => void;
  setUpcomingTouchpoints: (value: boolean) => void;
  setShowArchived: (value: boolean) => void;
  onSegmentChange: (segment: string) => void;
  onTagsChange: (tags: string[]) => void;
  onEmailSearchChange: (email: string) => void;
  onFirstNameSearchChange: (firstName: string) => void;
  onLastNameSearchChange: (lastName: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useFilterContacts(
  contacts: ContactWithId[],
  initialUpcomingTouchpoints: boolean = false
): UseFilterContactsReturn {
  // Filter states
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [emailSearch, setEmailSearch] = useState<string>("");
  const [firstNameSearch, setFirstNameSearch] = useState<string>("");
  const [lastNameSearch, setLastNameSearch] = useState<string>("");
  const [upcomingTouchpoints, setUpcomingTouchpoints] = useState<boolean>(initialUpcomingTouchpoints);
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const filters: FilterState = {
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    upcomingTouchpoints,
    showArchived,
  };

  const filteredContacts = useMemo(() => {
    let filtered = [...contacts];

    // Filter by archived status (default: hide archived, unless showArchived is true)
    if (!filters.showArchived) {
      filtered = filtered.filter(c => !c.archived);
    } else {
      // If showing archived, only show archived contacts
      filtered = filtered.filter(c => c.archived === true);
    }

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

    // Filter by upcoming touchpoints
    if (filters.upcomingTouchpoints) {
      const now = new Date();
      filtered = filtered.filter((contact) => {
        if (!contact.nextTouchpointDate) return false;
        // Handle Firestore Timestamp or Date string
        const touchpointDate =
          contact.nextTouchpointDate instanceof Date
            ? contact.nextTouchpointDate
            : typeof contact.nextTouchpointDate === "string"
            ? new Date(contact.nextTouchpointDate)
            : typeof contact.nextTouchpointDate === "object" && "toDate" in contact.nextTouchpointDate
            ? (contact.nextTouchpointDate as { toDate: () => Date }).toDate()
            : null;
        return touchpointDate && touchpointDate > now;
      });
    }

    return filtered;
  }, [contacts, filters.selectedSegment, filters.selectedTags, filters.emailSearch, filters.firstNameSearch, filters.lastNameSearch, filters.upcomingTouchpoints, filters.showArchived]);

  const clearFilters = () => {
    setSelectedSegment("");
    setSelectedTags([]);
    setEmailSearch("");
    setFirstNameSearch("");
    setLastNameSearch("");
    setUpcomingTouchpoints(false);
    setShowArchived(false);
  };

  const hasActiveFilters = 
    selectedSegment || 
    selectedTags.length > 0 || 
    emailSearch.trim() || 
    firstNameSearch.trim() || 
    lastNameSearch.trim() ||
    upcomingTouchpoints ||
    showArchived;

  return {
    filteredContacts,
    filters,
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    upcomingTouchpoints,
    showArchived,
    setSelectedSegment,
    setSelectedTags,
    setEmailSearch,
    setFirstNameSearch,
    setLastNameSearch,
    setUpcomingTouchpoints,
    setShowArchived,
    onSegmentChange: setSelectedSegment,
    onTagsChange: setSelectedTags,
    onEmailSearchChange: setEmailSearch,
    onFirstNameSearchChange: setFirstNameSearch,
    onLastNameSearchChange: setLastNameSearch,
    onClearFilters: clearFilters,
    hasActiveFilters,
  };
}

