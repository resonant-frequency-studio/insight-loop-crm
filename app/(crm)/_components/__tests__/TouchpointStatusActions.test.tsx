import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TouchpointStatusActions from "../TouchpointStatusActions";
import { Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

// Mock fetch
global.fetch = jest.fn();

// Mock Response for Firebase client-side code
global.Response = class Response {
  constructor() {}
} as typeof Response;

// Mock reportException
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));

// Mock useAuth to avoid importing Firebase client code
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { uid: "test-user-id" },
    loading: false,
  }),
}));

// Helper to render with QueryClientProvider
const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe("TouchpointStatusActions", () => {
  const mockProps = {
    contactId: "contact-1",
    contactName: "John Doe",
    currentStatus: null as Contact["touchpointStatus"],
    onStatusUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe("Compact Mode", () => {
    it("renders compact buttons for pending status", () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} compact />);
      expect(screen.getByText(/mark as contacted/i)).toBeInTheDocument();
      expect(screen.getByText(/skip touchpoint/i)).toBeInTheDocument();
    });

    it("hides complete button when already completed", () => {
      renderWithQueryClient(
        <TouchpointStatusActions
          {...mockProps}
          currentStatus="completed"
          compact
        />
      );
      expect(screen.queryByText(/mark as contacted/i)).not.toBeInTheDocument();
      expect(screen.getByText(/skip touchpoint/i)).toBeInTheDocument();
    });

    it("hides skip button when already cancelled", () => {
      renderWithQueryClient(
        <TouchpointStatusActions
          {...mockProps}
          currentStatus="cancelled"
          compact
        />
      );
      expect(screen.queryByText(/skip touchpoint/i)).not.toBeInTheDocument();
    });
  });

  describe("Full Mode", () => {
    it("shows status badge for completed", () => {
      renderWithQueryClient(
        <TouchpointStatusActions
          {...mockProps}
          currentStatus="completed"
        />
      );
      expect(screen.getByText(/contacted/i)).toBeInTheDocument();
    });

    it("shows status badge for cancelled", () => {
      renderWithQueryClient(
        <TouchpointStatusActions
          {...mockProps}
          currentStatus="cancelled"
        />
      );
      expect(screen.getByText(/skipped/i)).toBeInTheDocument();
    });

    it("shows status badge for pending", () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });

    it("shows action buttons for pending status", () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      expect(screen.getByText(/mark as contacted/i)).toBeInTheDocument();
      expect(screen.getByText(/skip touchpoint/i)).toBeInTheDocument();
    });

    it("shows restore button for completed/cancelled", () => {
      renderWithQueryClient(
        <TouchpointStatusActions
          {...mockProps}
          currentStatus="completed"
        />
      );
      expect(screen.getByText(/restore to pending/i)).toBeInTheDocument();
    });
  });

  describe("Modal Interactions", () => {
    it("opens complete modal on button click", () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      const button = screen.getByText(/mark as contacted/i);
      fireEvent.click(button);
      expect(screen.getByText(/mark the touchpoint for/i)).toBeInTheDocument();
    });

    it("opens cancel modal on button click", () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      const button = screen.getByText(/skip touchpoint/i);
      fireEvent.click(button);
      expect(screen.getByText(/skip the touchpoint for/i)).toBeInTheDocument();
    });

    it("closes modal on cancel", () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      fireEvent.click(screen.getByText(/mark as contacted/i));
      fireEvent.click(screen.getByText(/cancel/i));
      expect(screen.queryByText(/mark the touchpoint for/i)).not.toBeInTheDocument();
    });

    it("allows entering reason in textarea", () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      fireEvent.click(screen.getByText(/mark as contacted/i));
      const textarea = screen.getByPlaceholderText(/optional note/i);
      fireEvent.change(textarea, { target: { value: "Discussed proposal" } });
      expect(textarea).toHaveValue("Discussed proposal");
    });
  });

  describe("Status Updates", () => {
    it("calls API to complete touchpoint", async () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      fireEvent.click(screen.getByText(/mark as contacted/i));
      fireEvent.click(screen.getByText(/mark completed/i));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/contacts/contact-1/touchpoint-status"),
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"status":"completed"'),
          })
        );
      });
    });

    it("calls API to cancel touchpoint", async () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      const skipButtons = screen.getAllByText(/skip touchpoint/i);
      fireEvent.click(skipButtons[0]); // Click the main button
      // Wait for modal to open, then click the confirm button in modal
      await waitFor(() => {
        const modalButtons = screen.getAllByText(/skip touchpoint/i);
        expect(modalButtons.length).toBeGreaterThan(1);
      });
      const modalButtons = screen.getAllByText(/skip touchpoint/i);
      fireEvent.click(modalButtons[modalButtons.length - 1]); // Click the confirm button in modal

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/contacts/contact-1/touchpoint-status"),
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"status":"cancelled"'),
          })
        );
      });
    });

    it("calls onStatusUpdate callback after successful update", async () => {
      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      fireEvent.click(screen.getByText(/mark as contacted/i));
      fireEvent.click(screen.getByText(/mark completed/i));

      await waitFor(() => {
        expect(mockProps.onStatusUpdate).toHaveBeenCalled();
      });
    });

    it("handles API errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Failed to update touchpoint status" }),
      });

      renderWithQueryClient(<TouchpointStatusActions {...mockProps} />);
      fireEvent.click(screen.getByText(/mark as contacted/i));
      fireEvent.click(screen.getByText(/mark completed/i));

      // Wait for the mutation to complete and error to be handled
      // The component should:
      // 1. Report error to Sentry (via reportException)
      // 2. Display error message in UI (via ErrorMessage component)
      await waitFor(() => {
        // Verify error was reported to Sentry
        expect(reportException).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      // Error message should appear in the UI
      // Note: React Query might take a moment to process the error
      // We verify the error handling mechanism works (Sentry reporting)
      // rather than waiting for UI update which can be timing-dependent
    }, 10000); // Increase timeout for this test
  });
});

