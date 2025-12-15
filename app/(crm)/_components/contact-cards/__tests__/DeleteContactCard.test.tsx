import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DeleteContactCard from "../DeleteContactCard";
import { useDeleteContact } from "@/hooks/useContactMutations";
import { useRouter } from "next/navigation";
import { createMockUseMutationResult } from "@/components/__tests__/test-utils";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

jest.mock("@/hooks/useContactMutations");
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

const mockUseDeleteContact = useDeleteContact as jest.MockedFunction<typeof useDeleteContact>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe("DeleteContactCard", () => {
  const mockContactId = "contact-123";
  const mockPush = jest.fn();
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    } as AppRouterInstance);

    mockUseDeleteContact.mockReturnValue(
      createMockUseMutationResult<unknown, Error, string, unknown>(
        mockMutate,
        jest.fn(),
        false,
        false,
        false,
        null,
        undefined
      )
    );
  });

  describe("Rendering", () => {
    it("renders delete button", () => {
      render(<DeleteContactCard contactId={mockContactId} />);
      expect(screen.getByText("Delete Contact")).toBeInTheDocument();
    });

    it("button is not disabled initially", () => {
      render(<DeleteContactCard contactId={mockContactId} />);
      const button = screen.getByText("Delete Contact");
      expect(button).not.toBeDisabled();
    });
  });

  describe("Modal Interactions", () => {
    it("opens confirmation modal on button click", () => {
      render(<DeleteContactCard contactId={mockContactId} />);
      
      const deleteButton = screen.getByText("Delete Contact");
      fireEvent.click(deleteButton);

      expect(screen.getByText("Delete Contact", { selector: "h2, h3, h4, h5, h6" })).toBeInTheDocument();
      expect(screen.getByText(/Are you sure\? Deleting this contact is final and cannot be undone/)).toBeInTheDocument();
    });

    it("closes modal on cancel", () => {
      render(<DeleteContactCard contactId={mockContactId} />);
      
      const deleteButton = screen.getByText("Delete Contact");
      fireEvent.click(deleteButton);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(screen.queryByText(/Are you sure\?/)).not.toBeInTheDocument();
    });
  });

  describe("Delete Functionality", () => {
    it("calls delete mutation on confirm", () => {
      render(<DeleteContactCard contactId={mockContactId} />);
      
      const deleteButton = screen.getByText("Delete Contact");
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByText("Delete");
      fireEvent.click(confirmButton);

      expect(mockMutate).toHaveBeenCalledWith(mockContactId, expect.any(Object));
    });

    it("closes modal on successful deletion", async () => {
      let onSuccessCallback: (() => void) | undefined;
      mockMutate.mockImplementation((contactId, options) => {
        onSuccessCallback = options?.onSuccess;
      });

      render(<DeleteContactCard contactId={mockContactId} />);
      
      const deleteButton = screen.getByText("Delete Contact");
      fireEvent.click(deleteButton);

      // Verify modal is open
      expect(screen.getByText(/Are you sure\?/)).toBeInTheDocument();

      const confirmButton = screen.getByText("Delete");
      fireEvent.click(confirmButton);

      if (onSuccessCallback) {
        // Call onSuccess - this will attempt to navigate and close modal
        // Note: window.location.href assignment will throw in JSDOM, but that's expected
        // The important behavior is that the modal closes
        try {
          onSuccessCallback();
        } catch {
          // Expected in JSDOM - navigation is not implemented
        }
      }

      // Verify modal closes (the primary testable behavior)
      await waitFor(() => {
        expect(screen.queryByText(/Are you sure\?/)).not.toBeInTheDocument();
      });
    });

    it("displays error message on failure", async () => {
      const mockError = new Error("Delete failed");
      let onErrorCallback: ((error: Error) => void) | undefined;
      mockMutate.mockImplementation((contactId, options) => {
        onErrorCallback = options?.onError;
      });

      render(<DeleteContactCard contactId={mockContactId} />);
      
      const deleteButton = screen.getByText("Delete Contact");
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByText("Delete");
      fireEvent.click(confirmButton);

      if (onErrorCallback) {
        onErrorCallback(mockError);
      }

      await waitFor(() => {
        // Error message appears in both Button error prop and ErrorMessage component
        expect(screen.getAllByText("Delete failed").length).toBeGreaterThan(0);
      });
    });

    it("disables button during pending mutation", () => {
      mockUseDeleteContact.mockReturnValue(
        createMockUseMutationResult<unknown, Error, string, unknown>(
          mockMutate,
          jest.fn(),
          true,
          false,
          false,
          null,
          undefined
        )
      );

      render(<DeleteContactCard contactId={mockContactId} />);
      
      const deleteButton = screen.getByText("Delete Contact");
      expect(deleteButton).toBeDisabled();
    });
  });
});

