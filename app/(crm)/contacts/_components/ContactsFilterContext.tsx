"use client";

import { createContext, useContext, ReactNode } from "react";
import { useContactsPageFilters } from "@/hooks/useContactsPageFilters";
import { Contact } from "@/types/firestore";

interface ContactWithId extends Contact {
  id: string;
}

interface ContactsFilterContextValue {
  // Filter state
  filteredContacts: ContactWithId[];
  totalContactsCount: number;
  isLoading?: boolean;
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
  
  // Filter change handlers (for ContactsFilter component)
  onSegmentChange: (segment: string) => void;
  onTagsChange: (tags: string[]) => void;
  onEmailSearchChange: (email: string) => void;
  onFirstNameSearchChange: (firstName: string) => void;
  onLastNameSearchChange: (lastName: string) => void;
  onCompanySearchChange: (company: string) => void;
  onShowArchivedChange: (show: boolean) => void;
  onCustomFilterChange: (filter: "at-risk" | "warm" | null) => void;
}

const ContactsFilterContext = createContext<ContactsFilterContextValue | undefined>(undefined);

interface ContactsFilterProviderProps {
  children: ReactNode;
  contacts: ContactWithId[];
  itemsPerPage?: number;
  isLoading?: boolean;
}

export function ContactsFilterProvider({
  children,
  contacts,
  itemsPerPage = 20,
  isLoading = false,
}: ContactsFilterProviderProps) {
  const filterState = useContactsPageFilters({
    contacts,
    itemsPerPage,
  });

  return (
    <ContactsFilterContext.Provider value={{
      ...filterState,
      totalContactsCount: contacts.length,
      isLoading,
    }}>
      {children}
    </ContactsFilterContext.Provider>
  );
}

export function useContactsFilter() {
  const context = useContext(ContactsFilterContext);
  if (context === undefined) {
    throw new Error("useContactsFilter must be used within a ContactsFilterProvider");
  }
  return context;
}

