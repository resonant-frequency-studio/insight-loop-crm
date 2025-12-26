import { renderHook, waitFor, act } from "@testing-library/react";
import { useExportJob } from "../useExportJob";
import { db } from "@/lib/firebase-client";
import { doc, onSnapshot, DocumentSnapshot } from "firebase/firestore";
import { ExportJob } from "@/types/firestore";

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
function createMockSnapshot(data: ExportJob | null, id: string): DocumentSnapshot {
  return {
    exists: () => data !== null,
    id,
    data: () => data as ExportJob,
    metadata: { fromCache: false, hasPendingWrites: false },
    ref: {} as ReturnType<typeof doc> & { path: string },
    get: jest.fn(),
  } as unknown as DocumentSnapshot;
}

describe("useExportJob", () => {
  const mockUserId = "user123";
  const mockExportJobId = "export-job-123";
  let unsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe = jest.fn();
    mockDoc.mockReturnValue({} as ReturnType<typeof doc>);
    // Default: return unsubscribe function
    mockOnSnapshot.mockReturnValue(unsubscribe);
  });

  it("should return null exportJob when userId is null", async () => {
    const { result } = renderHook(() => useExportJob(null, mockExportJobId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.exportJob).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should return null exportJob when exportJobId is null", async () => {
    const { result } = renderHook(() => useExportJob(mockUserId, null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.exportJob).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should set up Firestore listener when userId and exportJobId are provided", () => {
    renderHook(() => useExportJob(mockUserId, mockExportJobId));

    expect(mockDoc).toHaveBeenCalledWith(db, `users/${mockUserId}/exportJobs/${mockExportJobId}`);
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it("should return exportJob when snapshot exists", async () => {
    const mockExportJob: ExportJob = {
      jobId: mockExportJobId,
      userId: mockUserId,
      status: "running",
      startedAt: new Date(),
      totalContacts: 10,
      processedContacts: 5,
      skippedContacts: 2,
      errors: 0,
      currentStep: "Processing contacts...",
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockOnSnapshot.mockImplementation((docRef: unknown, onNext: unknown, _onError?: unknown) => {
      // Call after hook is set up
      setTimeout(() => {
        act(() => {
          (onNext as (snapshot: DocumentSnapshot) => void)(createMockSnapshot(mockExportJob, mockExportJobId));
        });
      }, 0);
      return unsubscribe;
    });

    const { result } = renderHook(() => useExportJob(mockUserId, mockExportJobId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.exportJob).toEqual({
      ...mockExportJob,
      jobId: mockExportJobId,
    });
    expect(result.current.error).toBeNull();
  });

  it("should return null exportJob when snapshot does not exist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockOnSnapshot.mockImplementation((docRef: unknown, onNext: unknown, _onError?: unknown) => {
      setTimeout(() => {
        act(() => {
          (onNext as (snapshot: DocumentSnapshot) => void)(createMockSnapshot(null, mockExportJobId));
        });
      }, 0);
      return unsubscribe;
    });

    const { result } = renderHook(() => useExportJob(mockUserId, mockExportJobId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.exportJob).toBeNull();
  });

  it("should handle error in snapshot callback", async () => {
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

    const { result } = renderHook(() => useExportJob(mockUserId, mockExportJobId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.error).toBe("Failed to load export job status");
    expect(result.current.exportJob).toBeNull();
  });

  it("should handle error in setup", async () => {
    mockDoc.mockImplementation(() => {
      throw new Error("Setup error");
    });

    const { result } = renderHook(() => useExportJob(mockUserId, mockExportJobId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to initialize export job listener");
  });

  it("should unsubscribe on unmount", () => {
    const { unmount } = renderHook(() => useExportJob(mockUserId, mockExportJobId));

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("should update exportJob when snapshot changes", async () => {
    const initialJob: ExportJob = {
      jobId: mockExportJobId,
      userId: mockUserId,
      status: "running",
      startedAt: new Date(),
      totalContacts: 10,
      processedContacts: 5,
      skippedContacts: 0,
      errors: 0,
    };

    const updatedJob: ExportJob = {
      ...initialJob,
      processedContacts: 8,
      skippedContacts: 2,
    };

    let onNextCallback: (snapshot: DocumentSnapshot) => void;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockOnSnapshot.mockImplementation((docRef: unknown, onNext: unknown, _onError?: unknown) => {
      onNextCallback = onNext as (snapshot: DocumentSnapshot) => void;
      // Initially return running job
      setTimeout(() => {
        act(() => {
          onNextCallback(createMockSnapshot(initialJob, mockExportJobId));
        });
      }, 0);
      return unsubscribe;
    });

    const { result } = renderHook(() => useExportJob(mockUserId, mockExportJobId));

    await waitFor(() => {
      expect(result.current.exportJob?.processedContacts).toBe(5);
    }, { timeout: 3000 });

    // Updated snapshot
    act(() => {
      onNextCallback(createMockSnapshot(updatedJob, mockExportJobId));
    });

    await waitFor(() => {
      expect(result.current.exportJob?.processedContacts).toBe(8);
      expect(result.current.exportJob?.skippedContacts).toBe(2);
    });
  });
});

