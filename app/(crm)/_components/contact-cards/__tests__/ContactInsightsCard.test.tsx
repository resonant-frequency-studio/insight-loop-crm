import { render, screen } from "@testing-library/react";
import ContactInsightsCard from "../ContactInsightsCard";
import { useContact } from "@/hooks/useContact";
import { formatContactDate } from "@/util/contact-utils";
import { createMockContact, createMockUseQueryResult } from "@/components/__tests__/test-utils";
import { Timestamp } from "firebase/firestore";
import type { Contact } from "@/types/firestore";

jest.mock("@/hooks/useContact");
jest.mock("@/util/contact-utils", () => ({
  formatContactDate: jest.fn((date, options) => {
    if (options?.includeTime) {
      return "2024-01-15 10:30 AM";
    }
    return "2024-01-15";
  }),
  getDisplayName: jest.fn((contact) => {
    if (contact.firstName || contact.lastName) {
      return `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
    }
    if (contact.company) {
      return contact.company;
    }
    return contact.primaryEmail.split("@")[0];
  }),
}));
jest.mock("@/components/InfoPopover", () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="info-popover">{content}</div>,
}));

const mockUseContact = useContact as jest.MockedFunction<typeof useContact>;
const mockFormatContactDate = formatContactDate as jest.MockedFunction<typeof formatContactDate>;

describe("ContactInsightsCard", () => {
  const mockUserId = "user-123";
  const mockContactId = "contact-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading state when contact is not loaded", () => {
      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(undefined, true, null)
      );

      const { container } = render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("AI Summary", () => {
    it("displays AI Summary when available", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        summary: "This is an AI-generated summary of the contact.",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("AI Summary")).toBeInTheDocument();
      expect(screen.getByText("This is an AI-generated summary of the contact.")).toBeInTheDocument();
    });

    it("does not display AI Summary section when summary is null", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        summary: null,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.queryByText("AI Summary")).not.toBeInTheDocument();
    });
  });

  describe("Engagement Score", () => {
    it("displays Engagement Score", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        engagementScore: 75,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Engagement Score")).toBeInTheDocument();
      expect(screen.getByText("75")).toBeInTheDocument();
    });

    it("displays Engagement Score section even when engagement score is null (renders as 0)", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        engagementScore: null,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      // Component converts null to 0 via Number(null), so section is displayed
      expect(screen.getByText("Engagement Score")).toBeInTheDocument();
    });
  });

  describe("Email Threads", () => {
    it("displays Email Threads count", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        threadCount: 5,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Email Threads")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("does not display Email Threads when threadCount is 0 or null", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        threadCount: 0,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.queryByText("Email Threads")).not.toBeInTheDocument();
    });
  });

  describe("Pain Points", () => {
    it("displays Pain Points when available", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        painPoints: "Budget constraints, Time limitations",
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Pain Points")).toBeInTheDocument();
      expect(screen.getByText("Budget constraints, Time limitations")).toBeInTheDocument();
    });

    it("does not display Pain Points section when painPoints is null", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        painPoints: null,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.queryByText("Pain Points")).not.toBeInTheDocument();
    });
  });

  describe("Last Email Date", () => {
    it("displays Last Email Date when available", () => {
      const mockDate = Timestamp.fromDate(new Date("2024-01-15"));
      const mockContact = createMockContact({
        contactId: mockContactId,
        lastEmailDate: mockDate,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("Last Email Date")).toBeInTheDocument();
      expect(mockFormatContactDate).toHaveBeenCalledWith(mockDate, { includeTime: true });
    });

    it("does not display Last Email Date section when lastEmailDate is null", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        lastEmailDate: null,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.queryByText("Last Email Date")).not.toBeInTheDocument();
    });
  });

  describe("Conditional Rendering", () => {
    it("conditionally renders sections based on data availability", () => {
      const mockContact = createMockContact({
        contactId: mockContactId,
        summary: "Summary",
        engagementScore: 75,
        threadCount: 3,
        painPoints: null,
        lastEmailDate: null,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("AI Summary")).toBeInTheDocument();
      expect(screen.getByText("Engagement Score")).toBeInTheDocument();
      expect(screen.getByText("Email Threads")).toBeInTheDocument();
      expect(screen.queryByText("Pain Points")).not.toBeInTheDocument();
      expect(screen.queryByText("Last Email Date")).not.toBeInTheDocument();
    });

    it("renders all sections when all data is available", () => {
      const mockDate = Timestamp.fromDate(new Date("2024-01-15"));
      const mockContact = createMockContact({
        contactId: mockContactId,
        summary: "Summary",
        engagementScore: 75,
        threadCount: 3,
        painPoints: "Pain 1",
        lastEmailDate: mockDate,
      });

      mockUseContact.mockReturnValue(
        createMockUseQueryResult<Contact | null, Error>(mockContact, false, null)
      );

      render(<ContactInsightsCard contactId={mockContactId} userId={mockUserId} />);
      
      expect(screen.getByText("AI Summary")).toBeInTheDocument();
      expect(screen.getByText("Engagement Score")).toBeInTheDocument();
      expect(screen.getByText("Email Threads")).toBeInTheDocument();
      expect(screen.getByText("Pain Points")).toBeInTheDocument();
      expect(screen.getByText("Last Email Date")).toBeInTheDocument();
    });
  });
});

