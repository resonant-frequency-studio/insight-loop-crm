import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContactsFilter from "../ContactsFilter";
import { createMockContact } from "@/components/__tests__/test-utils";
import { useContactsFilter } from "../../contacts/_components/ContactsFilterContext";

// Mock the context hook
jest.mock("../../contacts/_components/ContactsFilterContext");
const mockUseContactsFilter = useContactsFilter as jest.MockedFunction<typeof useContactsFilter>;

describe("ContactsFilter", () => {
  const mockContacts = [
    createMockContact({
      id: "1",
      primaryEmail: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      segment: "Enterprise",
      tags: ["VIP", "Priority"],
    }),
    createMockContact({
      id: "2",
      primaryEmail: "jane@example.com",
      firstName: "Jane",
      lastName: "Smith",
      segment: "SMB",
      tags: ["VIP"],
    }),
    createMockContact({
      id: "3",
      primaryEmail: "bob@example.com",
      firstName: "Bob",
      lastName: "Johnson",
      segment: "Enterprise",
      tags: ["Priority", "Follow-up"],
    }),
  ];

  const mockHandlers = {
    onSegmentChange: jest.fn(),
    onTagsChange: jest.fn(),
    onEmailSearchChange: jest.fn(),
    onFirstNameSearchChange: jest.fn(),
    onLastNameSearchChange: jest.fn(),
    onCompanySearchChange: jest.fn(),
    onShowArchivedChange: jest.fn(),
    onCustomFilterChange: jest.fn(),
    onClearFilters: jest.fn(),
  };

  // Default date range: last 12 months
  const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    return { start, end };
  };

  const createMockContextValue = (overrides = {}) => ({
    filteredContacts: mockContacts,
    totalContactsCount: mockContacts.length,
    hasActiveFilters: false,
    showArchived: false,
    setShowArchived: jest.fn(),
    setSelectedSegment: jest.fn(),
    setSelectedTags: jest.fn(),
    setEmailSearch: jest.fn(),
    setFirstNameSearch: jest.fn(),
    setLastNameSearch: jest.fn(),
    setCompanySearch: jest.fn(),
    setCustomFilter: jest.fn(),
    lastEmailDateRange: getDefaultDateRange(),
    setLastEmailDateRange: jest.fn(),
    onLastEmailDateRangeChange: jest.fn(),
    onClearFilters: mockHandlers.onClearFilters,
    currentPage: 1,
    setCurrentPage: jest.fn(),
    totalPages: 1,
    paginatedContacts: mockContacts,
    startIndex: 1,
    endIndex: mockContacts.length,
    selectedContactIds: new Set<string>(),
    setSelectedContactIds: jest.fn(),
    allFilteredSelected: false,
    toggleContactSelection: jest.fn(),
    toggleSelectAll: jest.fn(),
    selectedSegment: "",
    selectedTags: [],
    emailSearch: "",
    firstNameSearch: "",
    lastNameSearch: "",
    companySearch: "",
    customFilter: null,
    onSegmentChange: mockHandlers.onSegmentChange,
    onTagsChange: mockHandlers.onTagsChange,
    onEmailSearchChange: mockHandlers.onEmailSearchChange,
    onFirstNameSearchChange: mockHandlers.onFirstNameSearchChange,
    onLastNameSearchChange: mockHandlers.onLastNameSearchChange,
    onCompanySearchChange: mockHandlers.onCompanySearchChange,
    onShowArchivedChange: mockHandlers.onShowArchivedChange,
    onCustomFilterChange: mockHandlers.onCustomFilterChange,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseContactsFilter.mockReturnValue(createMockContextValue());
  });

  describe("Rendering", () => {
    it("renders all filter inputs", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      expect(screen.getByPlaceholderText("Enter email address...")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter last name...")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter first name...")).toBeInTheDocument();
      expect(screen.getByText(/Filter by Segment/i)).toBeInTheDocument();
      // Select components now use buttons with listbox role instead of combobox
      const selectButtons = screen.getAllByRole("button", { name: /Select|All Segments|None/i });
      expect(selectButtons.length).toBeGreaterThan(0);
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });
  });

  describe("Search Inputs", () => {
    it("email search updates on change", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const emailInput = screen.getByPlaceholderText("Enter email address...");
      fireEvent.change(emailInput, { target: { value: "john" } });
      expect(mockHandlers.onEmailSearchChange).toHaveBeenCalledWith("john");
    });

    it("first name search updates on change", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const firstNameInput = screen.getByPlaceholderText("Enter first name...");
      fireEvent.change(firstNameInput, { target: { value: "John" } });
      expect(mockHandlers.onFirstNameSearchChange).toHaveBeenCalledWith("John");
    });

    it("last name search updates on change", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const lastNameInput = screen.getByPlaceholderText("Enter last name...");
      fireEvent.change(lastNameInput, { target: { value: "Doe" } });
      expect(mockHandlers.onLastNameSearchChange).toHaveBeenCalledWith("Doe");
    });
  });

  describe("Segment Filter", () => {
    it("segment filter updates on change", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      // Find the segment select button and click it to open dropdown
      const segmentSelectButton = screen.getByRole("button", { name: /All Segments/i });
      fireEvent.click(segmentSelectButton);
      
      // Click on Enterprise option
      const enterpriseOption = screen.getByRole("option", { name: "Enterprise" });
      fireEvent.click(enterpriseOption);
      expect(mockHandlers.onSegmentChange).toHaveBeenCalledWith("Enterprise");
    });

    it("shows unique segments from contacts", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      // Open the segment select dropdown
      const segmentSelectButton = screen.getByRole("button", { name: /All Segments/i });
      fireEvent.click(segmentSelectButton);
      
      // Check that options are available
      expect(screen.getByRole("option", { name: "All Segments" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Enterprise" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "SMB" })).toBeInTheDocument();
    });
  });

  describe("Show Archived Toggle", () => {
    it("show archived toggle updates on change", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const checkbox = screen.getByLabelText(/Show archived contacts/i);
      fireEvent.click(checkbox);
      expect(mockHandlers.onShowArchivedChange).toHaveBeenCalledWith(true);
    });

    it("shows correct label when archived is shown", () => {
      mockUseContactsFilter.mockReturnValue(createMockContextValue({ showArchived: true }));
      render(<ContactsFilter contacts={mockContacts} />);
      expect(screen.getByText("Showing archived contacts")).toBeInTheDocument();
    });
  });

  describe("Tag Selection", () => {
    it("tag selection adds tag to selectedTags", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const tagInput = screen.getByPlaceholderText("Search and select tags...");
      fireEvent.focus(tagInput);
      
      // Click on a tag in the dropdown
      const tagButton = screen.getByText("VIP");
      fireEvent.click(tagButton);
      
      expect(mockHandlers.onTagsChange).toHaveBeenCalledWith(["VIP"]);
    });

    it("tag removal removes tag from selectedTags", () => {
      mockUseContactsFilter.mockReturnValue(createMockContextValue({ selectedTags: ["VIP", "Priority"] }));
      render(<ContactsFilter contacts={mockContacts} />);
      // Find the remove button for VIP tag
      const vipChip = screen.getByText("VIP").closest("span");
      const removeButton = vipChip?.querySelector("button");
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(mockHandlers.onTagsChange).toHaveBeenCalledWith(["Priority"]);
      }
    });

    it("tag search filters available tags", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const tagInput = screen.getByPlaceholderText("Search and select tags...");
      fireEvent.focus(tagInput);
      fireEvent.change(tagInput, { target: { value: "VIP" } });
      
      // Should show VIP in dropdown
      expect(screen.getByText("VIP")).toBeInTheDocument();
      // Should not show tags that don't match
      const dropdown = screen.getByText("VIP").closest(".absolute");
      if (dropdown) {
        expect(dropdown.textContent).not.toContain("Follow-up");
      }
    });

    it("tag dropdown shows filtered results", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const tagInput = screen.getByPlaceholderText("Search and select tags...");
      fireEvent.focus(tagInput);
      fireEvent.change(tagInput, { target: { value: "Pri" } });
      
      // Should show Priority
      expect(screen.getByText("Priority")).toBeInTheDocument();
    });

    it("tag dropdown closes on outside click", async () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const tagInput = screen.getByPlaceholderText("Search and select tags...");
      fireEvent.focus(tagInput);
      
      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByText("VIP")).toBeInTheDocument();
      });
      
      // Click outside (on the backdrop)
      const backdrop = document.querySelector(".fixed.inset-0");
      if (backdrop) {
        fireEvent.click(backdrop);
      } else {
        fireEvent.click(document.body);
      }
      
      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText("VIP")).not.toBeInTheDocument();
      });
    });

    it("selected tags display as chips", () => {
      mockUseContactsFilter.mockReturnValue(createMockContextValue({ selectedTags: ["VIP", "Priority"] }));
      render(<ContactsFilter contacts={mockContacts} />);
      expect(screen.getByText("VIP")).toBeInTheDocument();
      expect(screen.getByText("Priority")).toBeInTheDocument();
    });

    it("tag count displays correctly", () => {
      mockUseContactsFilter.mockReturnValue(createMockContextValue({ selectedTags: ["VIP", "Priority"] }));
      render(<ContactsFilter contacts={mockContacts} />);
      expect(screen.getByText("2 tags selected")).toBeInTheDocument();
    });

    it("shows singular 'tag' for one tag", () => {
      mockUseContactsFilter.mockReturnValue(createMockContextValue({ selectedTags: ["VIP"] }));
      render(<ContactsFilter contacts={mockContacts} />);
      expect(screen.getByText("1 tag selected")).toBeInTheDocument();
    });
  });

  describe("Clear Filters", () => {
    it("clear filters button appears when filters are active", () => {
      mockUseContactsFilter.mockReturnValue(createMockContextValue({
        selectedSegment: "Enterprise",
        selectedTags: ["VIP"],
        emailSearch: "john",
        hasActiveFilters: true,
      }));
      render(<ContactsFilter contacts={mockContacts} />);
      expect(screen.getByText("Clear all filters")).toBeInTheDocument();
    });

    it("clear filters button does not appear when no filters are active", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      expect(screen.queryByText("Clear all filters")).not.toBeInTheDocument();
    });

    it("clear filters button calls onClearFilters", () => {
      mockUseContactsFilter.mockReturnValue(createMockContextValue({
        selectedSegment: "Enterprise",
        hasActiveFilters: true,
      }));
      render(<ContactsFilter contacts={mockContacts} />);
      const clearButton = screen.getByText("Clear all filters");
      fireEvent.click(clearButton);
      expect(mockHandlers.onClearFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe("Unique Segments and Tags", () => {
    it("extracts unique segments from contacts", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      // Open the segment select dropdown
      const segmentSelectButton = screen.getByRole("button", { name: /All Segments/i });
      fireEvent.click(segmentSelectButton);
      
      // Check that options are available
      expect(screen.getByRole("option", { name: "Enterprise" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "SMB" })).toBeInTheDocument();
    });

    it("extracts unique tags from contacts", () => {
      render(<ContactsFilter contacts={mockContacts} />);
      const tagInput = screen.getByPlaceholderText("Search and select tags...");
      fireEvent.focus(tagInput);
      
      // Should show all unique tags: VIP, Priority, Follow-up
      expect(screen.getByText("VIP")).toBeInTheDocument();
      expect(screen.getByText("Priority")).toBeInTheDocument();
      expect(screen.getByText("Follow-up")).toBeInTheDocument();
    });
  });
});
