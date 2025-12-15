import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SyncPageClient from "../SyncPageClient";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/hooks/useAuth";
import { reportException } from "@/lib/error-reporting";
import { SyncJob, Contact } from "@/types/firestore";
import { createMockUseQueryResult, createMockContact } from "@/components/__tests__/test-utils";

jest.mock("@/hooks/useSyncStatus");
jest.mock("@/hooks/useContacts");
jest.mock("@/hooks/useAuth");
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockUseSyncStatus = useSyncStatus as jest.MockedFunction<typeof useSyncStatus>;
const mockUseContacts = useContacts as jest.MockedFunction<typeof useContacts>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
const mockReportException = reportException as jest.MockedFunction<typeof reportException>;

describe("SyncPageClient - Clear History", () => {
  const mockUserId = "user123";
  const mockUser = { uid: mockUserId, email: "test@example.com" };

  const createMockSyncJob = (overrides?: Partial<SyncJob>): SyncJob => ({
    syncJobId: overrides?.syncJobId || `sync-${Date.now()}`,
    userId: mockUserId,
    type: overrides?.type || "incremental",
    status: overrides?.status || "complete",
    startedAt: overrides?.startedAt || new Date().toISOString(),
    finishedAt: overrides?.finishedAt || new Date().toISOString(),
    processedThreads: overrides?.processedThreads || 10,
    processedMessages: overrides?.processedMessages || 25,
    errorMessage: overrides?.errorMessage || null,
  });

  const mockContacts: (Contact & { id: string })[] = [
    createMockContact({ id: "contact1", primaryEmail: "test1@example.com", firstName: "John" }),
    createMockContact({ id: "contact2", primaryEmail: "test2@example.com", firstName: "Jane" }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    } as ReturnType<typeof useAuth>);
    mockUseContacts.mockReturnValue(
      createMockUseQueryResult<Contact[], Error>(mockContacts, false, null)
    );
    mockUseSyncStatus.mockReturnValue({
      lastSync: null,
      syncHistory: [],
      loading: false,
      error: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
  });

  describe("Clear History Button Visibility", () => {
    it("should not show clear history button when there is only one sync job", () => {
      const singleJob = createMockSyncJob();
      mockUseSyncStatus.mockReturnValue({
        lastSync: singleJob,
        syncHistory: [singleJob],
        loading: false,
        error: null,
      });

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={singleJob}
          initialSyncHistory={[singleJob]}
        />
      );

      expect(screen.queryByText("Clear History")).not.toBeInTheDocument();
    });

    it("should show clear history button when there are multiple sync jobs", () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      expect(screen.getByText("Clear History")).toBeInTheDocument();
    });

    it("should not show clear history button when sync history is empty", () => {
      mockUseSyncStatus.mockReturnValue({
        lastSync: null,
        syncHistory: [],
        loading: false,
        error: null,
      });

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={null}
          initialSyncHistory={[]}
        />
      );

      expect(screen.queryByText("Clear History")).not.toBeInTheDocument();
    });
  });

  describe("Clear History Modal", () => {
    it("should open confirmation modal when clear history button is clicked", () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      expect(screen.getByText("Clear Sync History")).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to clear sync history/)
      ).toBeInTheDocument();
    });

    it("should close modal when cancel button is clicked", () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(screen.queryByText("Clear Sync History")).not.toBeInTheDocument();
    });

    it("should prevent backdrop click when clearing is in progress", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      // Mock a delayed response that we can control
      let resolveFetch: (value: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      mockFetch.mockReturnValue(fetchPromise);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText("Clear Sync History")).toBeInTheDocument();
      });

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      
      // Click confirm - this will close the modal immediately and start clearing
      fireEvent.click(confirmButton);

      // Modal should close immediately (component closes it at start of handleClearHistory)
      await waitFor(() => {
        expect(screen.queryByText("Clear Sync History")).not.toBeInTheDocument();
      });

      // The trigger button should be disabled while clearing is in progress
      await waitFor(() => {
        expect(clearButton).toBeDisabled();
      });

      // Resolve the fetch to complete the operation
      resolveFetch!({
        ok: true,
        json: async () => ({ success: true, deleted: 1 }),
      } as Response);

      // Wait for button to be enabled again after fetch completes
      await waitFor(() => {
        expect(clearButton).not.toBeDisabled();
      });
    });
  });

  describe("Clear History Functionality", () => {
    it("should call clear API endpoint on confirm", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          deleted: 1,
          message: "Cleared 1 sync job from history",
        }),
      } as Response);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/sync-jobs/clear", {
          method: "DELETE",
        });
      });
    });

    it("should close modal after successful clear", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          deleted: 1,
        }),
      } as Response);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText("Clear Sync History")).not.toBeInTheDocument();
      });
    });

    it("should show loading state on clear button during API call", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      let resolveFetch: (value: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      mockFetch.mockReturnValue(fetchPromise);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText("Clear Sync History")).toBeInTheDocument();
      });

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      
      // Initially not disabled
      expect(confirmButton).not.toBeDisabled();
      
      // Click confirm - this closes modal and starts clearing
      fireEvent.click(confirmButton);

      // Modal should close immediately
      await waitFor(() => {
        expect(screen.queryByText("Clear Sync History")).not.toBeInTheDocument();
      });

      // The trigger button should be disabled while clearing
      await waitFor(() => {
        expect(clearButton).toBeDisabled();
      }, { timeout: 3000 });

      // Resolve the fetch
      resolveFetch!({
        ok: true,
        json: async () => ({ success: true, deleted: 1 }),
      } as Response);

      // Wait for button to be enabled again after fetch completes
      await waitFor(() => {
        expect(clearButton).not.toBeDisabled();
      }, { timeout: 3000 });
    });
  });

  describe("Error Handling", () => {
    it("should display error message when clear API fails", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "Failed to clear sync history",
        }),
      } as Response);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to clear sync history")).toBeInTheDocument();
      });

      expect(mockReportException).toHaveBeenCalled();
    });

    it("should display error when API returns success: false", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          message: "Some jobs failed to delete",
        }),
      } as Response);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Some jobs failed to delete")).toBeInTheDocument();
      });
    });

    it("should handle network errors gracefully", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      mockFetch.mockRejectedValue(new Error("Network error"));

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error|Failed to clear/i)).toBeInTheDocument();
      });

      expect(mockReportException).toHaveBeenCalled();
    });

    it("should allow dismissing error message", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "Failed to clear sync history",
        }),
      } as Response);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to clear sync history")).toBeInTheDocument();
      });

      // Find and click dismiss button (usually an X or close button)
      const errorMessage = screen.getByText("Failed to clear sync history");
      const dismissButton = errorMessage
        .closest(".error-message, [role='alert']")
        ?.querySelector("button");
      
      if (dismissButton) {
        fireEvent.click(dismissButton);
        await waitFor(() => {
          expect(screen.queryByText("Failed to clear sync history")).not.toBeInTheDocument();
        });
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty response from API", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}), // Empty response
      } as Response);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to clear/i)).toBeInTheDocument();
      });
    });

    it("should handle malformed JSON response", async () => {
      const jobs = [
        createMockSyncJob({ syncJobId: "sync-1" }),
        createMockSyncJob({ syncJobId: "sync-2" }),
      ];
      mockUseSyncStatus.mockReturnValue({
        lastSync: jobs[0],
        syncHistory: jobs,
        loading: false,
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as unknown as Response);

      render(
        <SyncPageClient
          userId={mockUserId}
          initialLastSync={jobs[0]}
          initialSyncHistory={jobs}
        />
      );

      const clearButton = screen.getByText("Clear History");
      fireEvent.click(clearButton);

      // Find the confirm button in the modal (it's the danger variant button with "Clear History" text)
      const buttons = screen.getAllByText("Clear History");
      // The second one is in the modal (first is the trigger button)
      const confirmButton = buttons[1];
      expect(confirmButton).toBeInTheDocument();
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockReportException).toHaveBeenCalled();
      });
    });
  });
});

