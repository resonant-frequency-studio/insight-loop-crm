import { useState, useMemo, useEffect } from "react";
import { Contact } from "@/types/firestore";

interface ContactWithId extends Contact {
  id: string;
}

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface FilterState {
  selectedSegment: string;
  selectedTags: string[];
  emailSearch: string;
  firstNameSearch: string;
  lastNameSearch: string;
  companySearch: string;
  upcomingTouchpoints: boolean;
  showArchived: boolean;
  customFilter?: "at-risk" | "warm" | null;
  lastEmailDateRange: DateRange;
  includeNewContacts: boolean;
}

interface UseFilterContactsReturn {
  filteredContacts: ContactWithId[];
  filters: FilterState;
  selectedSegment: string;
  selectedTags: string[];
  emailSearch: string;
  firstNameSearch: string;
  lastNameSearch: string;
  companySearch: string;
  upcomingTouchpoints: boolean;
  showArchived: boolean;
  customFilter?: "at-risk" | "warm" | null;
  lastEmailDateRange: DateRange;
  includeNewContacts: boolean;
  setSelectedSegment: (segment: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setEmailSearch: (email: string) => void;
  setFirstNameSearch: (firstName: string) => void;
  setLastNameSearch: (lastName: string) => void;
  setCompanySearch: (company: string) => void;
  setUpcomingTouchpoints: (value: boolean) => void;
  setShowArchived: (value: boolean) => void;
  setCustomFilter: (filter: "at-risk" | "warm" | null) => void;
  setLastEmailDateRange: (range: DateRange) => void;
  setIncludeNewContacts: (value: boolean) => void;
  onSegmentChange: (segment: string) => void;
  onTagsChange: (tags: string[]) => void;
  onEmailSearchChange: (email: string) => void;
  onFirstNameSearchChange: (firstName: string) => void;
  onLastNameSearchChange: (lastName: string) => void;
  onCompanySearchChange: (company: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useFilterContacts(
  contacts: ContactWithId[],
  initialUpcomingTouchpoints: boolean = false
): UseFilterContactsReturn {
  // Filter states (immediate updates for UI responsiveness)
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [emailSearch, setEmailSearch] = useState<string>("");
  const [firstNameSearch, setFirstNameSearch] = useState<string>("");
  const [lastNameSearch, setLastNameSearch] = useState<string>("");
  const [companySearch, setCompanySearch] = useState<string>("");
  const [upcomingTouchpoints, setUpcomingTouchpoints] = useState<boolean>(initialUpcomingTouchpoints);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [customFilter, setCustomFilter] = useState<"at-risk" | "warm" | null>(null);
  
  // Default date range: last 12 months
  const getDefaultDateRange = (): DateRange => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    return { start, end };
  };
  const [lastEmailDateRange, setLastEmailDateRange] = useState<DateRange>(getDefaultDateRange());
  const [includeNewContacts, setIncludeNewContacts] = useState<boolean>(true); // Default to true to show new contacts

  // Debounced search values (for filtering performance)
  const [debouncedEmailSearch, setDebouncedEmailSearch] = useState<string>("");
  const [debouncedFirstNameSearch, setDebouncedFirstNameSearch] = useState<string>("");
  const [debouncedLastNameSearch, setDebouncedLastNameSearch] = useState<string>("");
  const [debouncedCompanySearch, setDebouncedCompanySearch] = useState<string>("");

  // Debounce search inputs (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmailSearch(emailSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [emailSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFirstNameSearch(firstNameSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [firstNameSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLastNameSearch(lastNameSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [lastNameSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCompanySearch(companySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [companySearch]);

  const filters: FilterState = {
    selectedSegment,
    selectedTags,
    emailSearch: debouncedEmailSearch,
    firstNameSearch: debouncedFirstNameSearch,
    lastNameSearch: debouncedLastNameSearch,
    companySearch: debouncedCompanySearch,
    upcomingTouchpoints,
    showArchived,
    customFilter,
    lastEmailDateRange,
    includeNewContacts,
  };

  const filteredContacts = useMemo(() => {
    let filtered = [...contacts];

    // Filter by archived status (default: hide archived, unless showArchived is true)
    // Note: undefined archived field is treated as not archived (should pass filter)
    if (!filters.showArchived) {
      filtered = filtered.filter(c => c.archived !== true); // Show if archived is false, null, or undefined
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

    // Search by email (primary and secondary)
    if (filters.emailSearch.trim()) {
      const searchLower = filters.emailSearch.toLowerCase().trim();
      filtered = filtered.filter(c => {
        const primaryMatch = c.primaryEmail?.toLowerCase().includes(searchLower);
        const secondaryMatch = c.secondaryEmails?.some(email => 
          email.toLowerCase().includes(searchLower)
        );
        return primaryMatch || secondaryMatch;
      });
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

    // Search by company
    if (filters.companySearch.trim()) {
      const searchLower = filters.companySearch.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.company?.toLowerCase().includes(searchLower)
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

    // Custom filters from AI Insights
    if (filters.customFilter === "at-risk") {
      const now = new Date();
      filtered = filtered.filter((contact) => {
        if (!contact.lastEmailDate) return true; // No email history is at-risk
        // Handle Firestore Timestamp or Date string
        const lastEmailDate =
          contact.lastEmailDate instanceof Date
            ? contact.lastEmailDate
            : typeof contact.lastEmailDate === "string"
            ? new Date(contact.lastEmailDate)
            : typeof contact.lastEmailDate === "object" && "toDate" in contact.lastEmailDate
            ? (contact.lastEmailDate as { toDate: () => Date }).toDate()
            : null;
        if (!lastEmailDate) return true;
        const daysSinceReply = (now.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceReply >= 14;
      });
    } else if (filters.customFilter === "warm") {
      filtered = filtered.filter((contact) => {
        const score = contact.engagementScore || 0;
        return score >= 50 && score < 70; // Medium-high engagement
      });
    }

    // Filter by last email date range
    if (filters.lastEmailDateRange.start && filters.lastEmailDateRange.end) {
      filtered = filtered.filter((contact) => {
        // If contact has no lastEmailDate, include it only if includeNewContacts is true
        if (!contact.lastEmailDate) {
          return filters.includeNewContacts;
        }
        
        // Handle Firestore Timestamp or Date string
        const lastEmailDate =
          contact.lastEmailDate instanceof Date
            ? contact.lastEmailDate
            : typeof contact.lastEmailDate === "string"
            ? new Date(contact.lastEmailDate)
            : typeof contact.lastEmailDate === "object" && "toDate" in contact.lastEmailDate
            ? (contact.lastEmailDate as { toDate: () => Date }).toDate()
            : null;
        
        if (!lastEmailDate) {
          // If date parsing failed, include only if includeNewContacts is true
          return filters.includeNewContacts;
        }
        
        // Set time to start/end of day for proper range checking
        const dateStartOfDay = new Date(lastEmailDate);
        dateStartOfDay.setHours(0, 0, 0, 0);
        
        const rangeStart = new Date(filters.lastEmailDateRange.start!);
        rangeStart.setHours(0, 0, 0, 0);
        
        const rangeEnd = new Date(filters.lastEmailDateRange.end!);
        rangeEnd.setHours(23, 59, 59, 999);
        
        return dateStartOfDay.getTime() >= rangeStart.getTime() && 
               dateStartOfDay.getTime() <= rangeEnd.getTime();
      });
    }

    return filtered;
  }, [contacts, filters.selectedSegment, filters.selectedTags, filters.emailSearch, filters.firstNameSearch, filters.lastNameSearch, filters.companySearch, filters.upcomingTouchpoints, filters.showArchived, filters.customFilter, filters.lastEmailDateRange, filters.includeNewContacts]);

  const clearFilters = () => {
    setSelectedSegment("");
    setSelectedTags([]);
    setEmailSearch("");
    setFirstNameSearch("");
    setLastNameSearch("");
    setCompanySearch("");
    setUpcomingTouchpoints(false);
    setShowArchived(false);
    setCustomFilter(null);
    setLastEmailDateRange(getDefaultDateRange());
    setIncludeNewContacts(true);
  };

  // Check if date range is different from default (12 months)
  const isDefaultDateRange = useMemo(() => {
    if (!lastEmailDateRange.start || !lastEmailDateRange.end) return true;
    const defaultRange = getDefaultDateRange();
    if (!defaultRange.start || !defaultRange.end) return true;
    
    // Compare dates normalized to start of day
    const normalizeDate = (date: Date) => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized.getTime();
    };
    
    return (
      normalizeDate(lastEmailDateRange.start) === normalizeDate(defaultRange.start) &&
      normalizeDate(lastEmailDateRange.end) === normalizeDate(defaultRange.end)
    );
  }, [lastEmailDateRange]);

  const hasActiveFilters = 
    !!selectedSegment || 
    selectedTags.length > 0 || 
    !!emailSearch.trim() || 
    !!firstNameSearch.trim() || 
    !!lastNameSearch.trim() ||
    !!companySearch.trim() ||
    upcomingTouchpoints ||
    showArchived ||
    !!customFilter ||
    !isDefaultDateRange;

  return {
    filteredContacts,
    filters,
    selectedSegment,
    selectedTags,
    emailSearch,
    firstNameSearch,
    lastNameSearch,
    companySearch,
    upcomingTouchpoints,
    showArchived,
    customFilter,
    lastEmailDateRange,
    includeNewContacts,
    setSelectedSegment,
    setSelectedTags,
    setEmailSearch,
    setFirstNameSearch,
    setLastNameSearch,
    setCompanySearch,
    setUpcomingTouchpoints,
    setShowArchived,
    setCustomFilter,
    setLastEmailDateRange,
    setIncludeNewContacts,
    onSegmentChange: setSelectedSegment,
    onTagsChange: setSelectedTags,
    onEmailSearchChange: setEmailSearch,
    onFirstNameSearchChange: setFirstNameSearch,
    onLastNameSearchChange: setLastNameSearch,
    onCompanySearchChange: setCompanySearch,
    onClearFilters: clearFilters,
    hasActiveFilters,
  };
}

