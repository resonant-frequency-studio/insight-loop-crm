import { render, screen, fireEvent } from "@testing-library/react";
import ExportContactsButton from "../ExportContactsButton";
import { createMockContact } from "@/components/__tests__/test-utils";

// Mock papaparse
jest.mock("papaparse", () => ({
  __esModule: true,
  default: {
    unparse: jest.fn((data: unknown[]) => {
      if (!Array.isArray(data) || data.length === 0) return "";
      const firstItem = data[0] as Record<string, string>;
      if (!firstItem || typeof firstItem !== "object") return "";
      const headers = Object.keys(firstItem).join(",");
      const rows = (data as Array<Record<string, string>>).map((row) => Object.values(row).join(","));
      return `${headers}\n${rows.join("\n")}`;
    }),
  },
}));

import Papa from "papaparse";

const mockUnparse = Papa.unparse as jest.MockedFunction<typeof Papa.unparse>;

beforeEach(() => {
  global.alert = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// Mock ExportToGoogleModal
jest.mock("../ExportToGoogleModal", () => ({
  __esModule: true,
  default: ({ isOpen, onClose, contacts }: { isOpen: boolean; onClose: () => void; contacts: unknown[] }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="export-to-google-modal">
        <button onClick={onClose}>Close Modal</button>
        <div>Exporting {contacts.length} contacts</div>
      </div>
    );
  },
}));

describe("ExportContactsButton", () => {
  const mockContacts = [
    createMockContact({
      id: "1",
      primaryEmail: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      tags: ["VIP", "Priority"],
      segment: "Enterprise",
      engagementScore: 75,
    }),
    createMockContact({
      id: "2",
      primaryEmail: "jane@example.com",
      firstName: "Jane",
      lastName: "Smith",
      tags: [],
      segment: "SMB",
    }),
  ];

  it("renders Download Contacts button with contact count", () => {
    render(<ExportContactsButton contacts={mockContacts} />);
    const button = screen.getByRole("button", { name: /download contacts/i });
    expect(button).toBeInTheDocument();
    // Both buttons show the count, so check that at least one exists
    const counts = screen.getAllByText("(2)");
    expect(counts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Export to Google button with contact count", () => {
    render(<ExportContactsButton contacts={mockContacts} />);
    const button = screen.getByRole("button", { name: /export to google/i });
    expect(button).toBeInTheDocument();
  });

  it("renders buttons without count when no contacts", () => {
    render(<ExportContactsButton contacts={[]} />);
    const downloadButton = screen.getByRole("button", { name: /download contacts/i });
    const exportButton = screen.getByRole("button", { name: /export to google/i });
    expect(downloadButton).toBeInTheDocument();
    expect(exportButton).toBeInTheDocument();
    // Count spans should not be rendered when contacts.length === 0
    const countSpans = screen.queryAllByText(/^\(\d+\)$/);
    expect(countSpans).toHaveLength(0);
  });

  it("disables buttons when no contacts", () => {
    render(<ExportContactsButton contacts={[]} />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      if (button.textContent?.includes("Download") || button.textContent?.includes("Export")) {
        expect(button).toBeDisabled();
      }
    });
  });

  it("disables buttons when disabled prop is true", () => {
    render(<ExportContactsButton contacts={mockContacts} disabled />);
    const downloadButton = screen.getByRole("button", { name: /download contacts/i });
    const exportButton = screen.getByRole("button", { name: /export to google/i });
    expect(downloadButton).toBeDisabled();
    expect(exportButton).toBeDisabled();
  });

  it("opens ExportToGoogleModal when Export to Google button is clicked", () => {
    render(<ExportContactsButton contacts={mockContacts} />);
    const exportButton = screen.getByRole("button", { name: /export to google/i });
    
    expect(screen.queryByTestId("export-to-google-modal")).not.toBeInTheDocument();
    
    fireEvent.click(exportButton);
    
    expect(screen.getByTestId("export-to-google-modal")).toBeInTheDocument();
  });


  it("generates CSV data with correct structure", () => {
    render(<ExportContactsButton contacts={mockContacts} />);
    const button = screen.getByRole("button", { name: /download contacts/i });
    
    // Mock Blob and URL methods
    global.Blob = jest.fn().mockImplementation((content) => ({ content })) as unknown as typeof Blob;
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = jest.fn();
    
    // Create a real anchor element for testing
    const link = document.createElement("a");
    link.click = jest.fn();
    jest.spyOn(document, "createElement").mockReturnValue(link);
    jest.spyOn(document.body, "appendChild").mockImplementation(() => link);
    jest.spyOn(document.body, "removeChild").mockImplementation(() => link);

    fireEvent.click(button);

    // Verify mockUnparse was called with correct data structure
    expect(mockUnparse).toHaveBeenCalled();
    const csvData = mockUnparse.mock.calls[0][0] as Array<Record<string, string>>;
    expect(csvData).toHaveLength(2);
    expect(csvData[0]).toHaveProperty("Email", "john@example.com");
    expect(csvData[0]).toHaveProperty("FirstName", "John");
    
    jest.restoreAllMocks();
  });

  it("formats tags as comma-separated string", () => {
    render(<ExportContactsButton contacts={mockContacts} />);
    const button = screen.getByRole("button", { name: /download contacts/i });
    fireEvent.click(button);

    expect(mockUnparse).toHaveBeenCalled();
    const csvData = mockUnparse.mock.calls[0][0] as Array<Record<string, string>>;
    expect(csvData[0].Tags).toBe("VIP, Priority");
    expect(csvData[1].Tags).toBe("");
  });

  it("formats dates correctly", () => {
    const contactWithDate = createMockContact({
      id: "3",
      nextTouchpointDate: new Date("2024-01-15").toISOString(),
    });
    render(<ExportContactsButton contacts={[contactWithDate]} />);
    const button = screen.getByRole("button", { name: /download contacts/i });
    fireEvent.click(button);

    const csvData = mockUnparse.mock.calls[0][0] as Array<Record<string, string>>;
    expect(csvData[0].NextTouchpointDate).toBe("2024-01-15");
  });
});

