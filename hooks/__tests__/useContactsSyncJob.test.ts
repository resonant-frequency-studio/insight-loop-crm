import { renderHook, waitFor, act } from "@testing-library/react";
import { useContactsSyncJob } from "../useContactsSyncJob";
import { db } from "@/lib/firebase-client";
import { doc, onSnapshot, DocumentSnapshot } from "firebase/firestore";
import { SyncJob } from "@/types/firestore";

// Mock Firebase
jest.mock("@/lib/firebase-client", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  onSnapshot: jest.fn(),
}));

jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));

const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>;

// Helper to create a mock snapshot
function createMockSnapshot(data: SyncJob | null, id: string): DocumentSnapshot {
  return {
    exists: () => data !== null,
    id,
    data: () => data as SyncJob,
    metadata: { fromCache: false, hasPendingWrites: false },
    ref: {} as ReturnType<typeof doc> & { path: string },
    get: jest.fn(),
  } as unknown as DocumentSnapshot;
}

describe("useContactsSyncJob", () => {
  const mockUserId = "user123";
  const mockSyncJobId = "sync-job-123";
  let unsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe = jest.fn();
    mockDoc.mockReturnValue({} as ReturnType<typeof doc>);
    // Default: return unsubscribe function
    mockOnSnapshot.mockReturnValue(unsubscribe);
  });

  it("should return null syncJob when userId is null", async () => {
    const { result } = renderHook(() => useContactsSyncJob(null, mockSyncJobId));

    expect(result.current.syncJob).toBeNull();
    
    // Wait for queueMicrotask to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it("should return null syncJob when syncJobId is null", async () => {
    const { result } = renderHook(() => useContactsSyncJob(mockUserId, null));

    expect(result.current.syncJob).toBeNull();
    
    // Wait for queueMicrotask to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it("should set up Firestore listener when userId and syncJobId are provided", () => {
    renderHook(() => useContactsSyncJob(mockUserId, mockSyncJobId));

    expect(mockDoc).toHaveBeenCalledWith(db, `users/${mockUserId}/syncJobs/${mockSyncJobId}`);
    expect(mockOnSnapshot).toHaveBeenCalled();
    expect(mockOnSnapshot).toHaveReturnedWith(unsubscribe);
  });

  it("should update syncJob when Firestore document exists", async () => {
    const mockSyncJob: SyncJob = {
      syncJobId: mockSyncJobId,
      userId: mockUserId,
      service: "contacts",
      type: "initial",
      status: "running",
      startedAt: new Date().toISOString(),
      processedContacts: 5,
      skippedContacts: 2,
      totalContacts: 10,
      currentStep: "importing",
    };
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockOnSnapshot.mockImplementation((docRef: unknown, onNext: unknown, _onError?: unknown) => {
      // Call after hook is set up
      setTimeout(() => {
        act(() => {
          (onNext as (snapshot: DocumentSnapshot) => void)(createMockSnapshot(mockSyncJob, mockSyncJobId));
        });
      }, 0);
      return unsubscribe;
    });

    const { result } = renderHook(() => useContactsSyncJob(mockUserId, mockSyncJobId));

    await waitFor(() => {
      expect(result.current.syncJob).toBeDefined();
    }, { timeout: 3000 });

    expect(result.current.syncJob).toMatchObject({
      ...mockSyncJob,
      syncJobId: mockSyncJobId,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should set syncJob to null when document does not exist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockOnSnapshot.mockImplementation((docRef: unknown, onNext: unknown, _onError?: unknown) => {
      setTimeout(() => {
        act(() => {
          (onNext as (snapshot: DocumentSnapshot) => void)(createMockSnapshot(null, mockSyncJobId));
        });
      }, 0);
      return unsubscribe;
    });

    const { result } = renderHook(() => useContactsSyncJob(mockUserId, mockSyncJobId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.syncJob).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("should handle Firestore errors", async () => {
    const mockError = new Error("Firestore error");
    
    mockOnSnapshot.mockImplementation((_docRef: unknown, _onNext: unknown, onError?: unknown) => {
      // Call error handler after hook is set up
      setTimeout(() => {
        act(() => {
          if (onError && typeof onError === 'function') {
            (onError as (error: Error) => void)(mockError);
          }
        });
      }, 0);
      return unsubscribe;
    });

    const { result } = renderHook(() => useContactsSyncJob(mockUserId, mockSyncJobId));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    }, { timeout: 3000 });

    expect(result.current.error).toBe("Failed to load sync job status");
    expect(result.current.loading).toBe(false);
  });

  it("should unsubscribe from Firestore listener on unmount", () => {
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useContactsSyncJob(mockUserId, mockSyncJobId));

    expect(mockOnSnapshot).toHaveBeenCalled();
    
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it("should update syncJob when status changes", async () => {
    const initialJob: SyncJob = {
      syncJobId: mockSyncJobId,
      userId: mockUserId,
      service: "contacts",
      type: "initial",
      status: "running",
      startedAt: new Date().toISOString(),
      processedContacts: 5,
    };

    const updatedJob: SyncJob = {
      ...initialJob,
      status: "complete",
      finishedAt: new Date().toISOString(),
      processedContacts: 10,
    };

    let onNextCallback: (snapshot: DocumentSnapshot) => void;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockOnSnapshot.mockImplementation((docRef: unknown, onNext: unknown, _onError?: unknown) => {
      onNextCallback = onNext as (snapshot: DocumentSnapshot) => void;
      // Initially return running job
      setTimeout(() => {
        act(() => {
          onNextCallback(createMockSnapshot(initialJob, mockSyncJobId));
        });
      }, 0);
      return unsubscribe;
    });

    const { result } = renderHook(() => useContactsSyncJob(mockUserId, mockSyncJobId));

    await waitFor(() => {
      expect(result.current.syncJob?.status).toBe("running");
    });

    // Simulate status update
    act(() => {
      onNextCallback(createMockSnapshot(updatedJob, mockSyncJobId));
    });

    await waitFor(() => {
      expect(result.current.syncJob?.status).toBe("complete");
    });

    expect(result.current.syncJob?.processedContacts).toBe(10);
  });
});

