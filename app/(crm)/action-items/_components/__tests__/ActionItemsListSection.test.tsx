import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionItemsListSection from "../ActionItemsListSection";
import { ActionItemsFiltersProvider, useActionItemsFilters, FilterStatus, FilterDate } from "../ActionItemsFiltersContext";
import { useUpdateActionItem, useDeleteActionItem } from "@/hooks/useActionItemMutations";
import { createMockUseMutationResult } from "@/components/__tests__/test-utils";
import { EnrichedActionItem } from "../../ActionItemsPageClient";
import type { ActionItem } from "@/types/firestore";

// Test component to set filter values
function FilterSetter({ filterStatus, filterDate, selectedContactId }: { filterStatus?: FilterStatus; filterDate?: FilterDate; selectedContactId?: string | null }) {
  const { setFilterStatus, setFilterDate, setSelectedContactId } = useActionItemsFilters();
  
  React.useEffect(() => {
    if (filterStatus) setFilterStatus(filterStatus);
    if (filterDate) setFilterDate(filterDate);
    if (selectedContactId !== undefined) setSelectedContactId(selectedContactId);
  }, [filterStatus, filterDate, selectedContactId, setFilterStatus, setFilterDate, setSelectedContactId]);
  
  return null;
}

jest.mock("@/hooks/useActionItemMutations");
jest.mock("@/lib/error-reporting", () => ({
  reportException: jest.fn(),
}));
jest.mock("../../../_components/ActionItemCard", () => ({
  __esModule: true,
  default: ({
    actionItem,
    onComplete,
    onDelete,
    onEdit,
    disabled,
  }: {
    actionItem: ActionItem;
    onComplete: () => void;
    onDelete: () => void;
    onEdit: (text: string, dueDate?: string | null) => void;
    disabled?: boolean;
  }) => (
    <div data-testid={`action-item-${actionItem.actionItemId}`}>
      <span>{actionItem.text}</span>
      <span data-testid={`status-${actionItem.actionItemId}`}>{actionItem.status}</span>
      <button onClick={onComplete} data-testid={`complete-${actionItem.actionItemId}`} disabled={disabled}>
        Complete
      </button>
      <button onClick={onDelete} data-testid={`delete-${actionItem.actionItemId}`} disabled={disabled}>
        Delete
      </button>
      <button
        onClick={() => onEdit("Updated text", "2024-12-31")}
        data-testid={`edit-${actionItem.actionItemId}`}
        disabled={disabled}
      >
        Edit
      </button>
    </div>
  ),
}));
jest.mock("@/components/Modal", () => ({
  __esModule: true,
  default: ({
    isOpen,
    onClose,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="delete-modal">
        <h2>{title}</h2>
        {children}
        <button onClick={onClose} data-testid="modal-cancel">
          Cancel
        </button>
      </div>
    ) : null,
}));

const mockUseUpdateActionItem = useUpdateActionItem as jest.MockedFunction<typeof useUpdateActionItem>;
const mockUseDeleteActionItem = useDeleteActionItem as jest.MockedFunction<typeof useDeleteActionItem>;

function createMockEnrichedActionItem(
  overrides?: Partial<EnrichedActionItem>
): EnrichedActionItem {
  return {
    actionItemId: overrides?.actionItemId || "item-1",
    contactId: overrides?.contactId || "contact-1",
    userId: "user-1",
    text: overrides?.text || "Test action item",
    status: overrides?.status || "pending",
    contactName: overrides?.contactName || "Test Contact",
    displayName: overrides?.displayName || "Test Contact",
    initials: overrides?.initials || "TC",
    isOverdue: overrides?.isOverdue || false,
    dateCategory: overrides?.dateCategory || "upcoming",
    dueDate: overrides?.dueDate || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function renderWithProvider(
  actionItems: EnrichedActionItem[],
  options?: { filterStatus?: FilterStatus; filterDate?: FilterDate; selectedContactId?: string | null }
) {
  return render(
    <ActionItemsFiltersProvider>
      {options && <FilterSetter {...options} />}
      <ActionItemsListSection actionItems={actionItems} />
    </ActionItemsFiltersProvider>
  );
}

describe("ActionItemsListSection", () => {
  const mockUpdateMutateAsync = jest.fn();
  const mockDeleteMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateMutateAsync.mockResolvedValue({});
    mockDeleteMutateAsync.mockResolvedValue({});

    mockUseUpdateActionItem.mockReturnValue(
      createMockUseMutationResult<
        unknown,
        Error,
        { contactId: string; actionItemId: string; updates: { text?: string; status?: "pending" | "completed"; dueDate?: Date | string | null } },
        unknown
      >(
        jest.fn(),
        mockUpdateMutateAsync
      )
    );

    mockUseDeleteActionItem.mockReturnValue(
      createMockUseMutationResult<
        unknown,
        Error,
        { contactId: string; actionItemId: string },
        unknown
      >(
        jest.fn(),
        mockDeleteMutateAsync
      )
    );
  });

  describe("Rendering", () => {
    it("renders action items list", () => {
      const items = [
        createMockEnrichedActionItem({ actionItemId: "item-1", text: "Item 1" }),
        createMockEnrichedActionItem({ actionItemId: "item-2", text: "Item 2" }),
      ];

      renderWithProvider(items);

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("displays count of filtered items", () => {
      const items = [
        createMockEnrichedActionItem({ actionItemId: "item-1" }),
        createMockEnrichedActionItem({ actionItemId: "item-2" }),
      ];

      renderWithProvider(items);

      expect(screen.getByText("2 Action Items")).toBeInTheDocument();
    });

    it("displays singular form for one item", () => {
      const items = [createMockEnrichedActionItem({ actionItemId: "item-1" })];

      renderWithProvider(items);

      expect(screen.getByText("1 Action Item")).toBeInTheDocument();
    });

    it("shows empty state when no items match filters", () => {
      renderWithProvider([]);

      expect(screen.getByText("No action items match your filters")).toBeInTheDocument();
    });
  });

  describe("Filtering", () => {
    it("filters by status", () => {
      const items = [
        createMockEnrichedActionItem({ actionItemId: "item-1", status: "pending" }),
        createMockEnrichedActionItem({ actionItemId: "item-2", status: "completed" }),
      ];

      renderWithProvider(items, { filterStatus: "pending" });

      expect(screen.getByTestId("action-item-item-1")).toBeInTheDocument();
      expect(screen.queryByTestId("action-item-item-2")).not.toBeInTheDocument();
    });

    it("filters by date category", () => {
      const items = [
        createMockEnrichedActionItem({
          actionItemId: "item-1",
          status: "pending",
          dateCategory: "overdue",
        }),
        createMockEnrichedActionItem({
          actionItemId: "item-2",
          status: "pending",
          dateCategory: "today",
        }),
      ];

      renderWithProvider(items, { filterDate: "overdue" });

      expect(screen.getByTestId("action-item-item-1")).toBeInTheDocument();
      expect(screen.queryByTestId("action-item-item-2")).not.toBeInTheDocument();
    });

    it("filters by contact", () => {
      const items = [
        createMockEnrichedActionItem({
          actionItemId: "item-1",
          contactId: "contact-1",
        }),
        createMockEnrichedActionItem({
          actionItemId: "item-2",
          contactId: "contact-2",
        }),
      ];

      renderWithProvider(items, { selectedContactId: "contact-1" });

      expect(screen.getByTestId("action-item-item-1")).toBeInTheDocument();
      expect(screen.queryByTestId("action-item-item-2")).not.toBeInTheDocument();
    });
  });

  describe("Completing Action Items", () => {
    it("toggles completion status immediately", async () => {
      const item = createMockEnrichedActionItem({
        actionItemId: "item-1",
        status: "pending",
      });

      renderWithProvider([item]);

      const completeButton = screen.getByTestId("complete-item-1");
      await userEvent.click(completeButton);

      // Status should update immediately (optimistic update)
      await waitFor(() => {
        expect(screen.getByTestId("status-item-1")).toHaveTextContent("completed");
      });
    });

    it("calls update mutation with correct parameters", async () => {
      const item = createMockEnrichedActionItem({
        actionItemId: "item-1",
        contactId: "contact-1",
        status: "pending",
      });

      renderWithProvider([item]);

      const completeButton = screen.getByTestId("complete-item-1");
      await userEvent.click(completeButton);

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
          contactId: "contact-1",
          actionItemId: "item-1",
          updates: { status: "completed" },
        });
      });
    });

    it("reverts on error and shows error message", async () => {
      const item = createMockEnrichedActionItem({
        actionItemId: "item-1",
        status: "pending",
      });

      mockUpdateMutateAsync.mockRejectedValueOnce(new Error("Update failed"));

      renderWithProvider([item]);

      const completeButton = screen.getByTestId("complete-item-1");
      await userEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText("Update failed")).toBeInTheDocument();
        // Status should revert to pending
        expect(screen.getByTestId("status-item-1")).toHaveTextContent("pending");
      });
    });
  });

  describe("Editing Action Items", () => {
    it("updates text immediately", async () => {
      const item = createMockEnrichedActionItem({
        actionItemId: "item-1",
        text: "Original text",
      });

      renderWithProvider([item]);

      const editButton = screen.getByTestId("edit-item-1");
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText("Updated text")).toBeInTheDocument();
      });
    });

    it("calls update mutation with edited text and dueDate", async () => {
      const item = createMockEnrichedActionItem({
        actionItemId: "item-1",
        contactId: "contact-1",
        text: "Original text",
      });

      renderWithProvider([item]);

      const editButton = screen.getByTestId("edit-item-1");
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
          contactId: "contact-1",
          actionItemId: "item-1",
          updates: { text: "Updated text", dueDate: "2024-12-31" },
        });
      });
    });

    it("reverts on error and shows error message", async () => {
      const item = createMockEnrichedActionItem({
        actionItemId: "item-1",
        text: "Original text",
      });

      mockUpdateMutateAsync.mockRejectedValueOnce(new Error("Edit failed"));

      renderWithProvider([item]);

      const editButton = screen.getByTestId("edit-item-1");
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText("Edit failed")).toBeInTheDocument();
        // Text should revert to original
        expect(screen.getByText("Original text")).toBeInTheDocument();
      });
    });
  });

  describe("Deleting Action Items", () => {
    it("opens delete confirmation modal", async () => {
      const item = createMockEnrichedActionItem({ actionItemId: "item-1" });

      renderWithProvider([item]);

      const deleteButton = screen.getByTestId("delete-item-1");
      await userEvent.click(deleteButton);

      expect(screen.getByTestId("delete-modal")).toBeInTheDocument();
      expect(screen.getByText("Delete Action Item")).toBeInTheDocument();
    });

    it("removes item immediately on confirm", async () => {
      const item = createMockEnrichedActionItem({ actionItemId: "item-1" });

      renderWithProvider([item]);

      const deleteButton = screen.getByTestId("delete-item-1");
      await userEvent.click(deleteButton);

      // Find and click confirm button in modal
      const modal = screen.getByTestId("delete-modal");
      const confirmButton = within(modal).getByRole("button", { name: /^Delete$/ });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByTestId("action-item-item-1")).not.toBeInTheDocument();
      });
    });

    it("calls delete mutation with correct parameters", async () => {
      const item = createMockEnrichedActionItem({
        actionItemId: "item-1",
        contactId: "contact-1",
      });

      renderWithProvider([item]);

      const deleteButton = screen.getByTestId("delete-item-1");
      await userEvent.click(deleteButton);

      const modal = screen.getByTestId("delete-modal");
      const confirmButton = within(modal).getByRole("button", { name: /^Delete$/ });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteMutateAsync).toHaveBeenCalledWith({
          contactId: "contact-1",
          actionItemId: "item-1",
        });
      });
    });

    it("closes modal on cancel", async () => {
      const item = createMockEnrichedActionItem({ actionItemId: "item-1" });

      renderWithProvider([item]);

      const deleteButton = screen.getByTestId("delete-item-1");
      await userEvent.click(deleteButton);

      expect(screen.getByTestId("delete-modal")).toBeInTheDocument();

      const cancelButton = screen.getByTestId("modal-cancel");
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId("delete-modal")).not.toBeInTheDocument();
      });
    });

    it("restores item and shows error on delete failure", async () => {
      const item = createMockEnrichedActionItem({ actionItemId: "item-1" });

      mockDeleteMutateAsync.mockRejectedValueOnce(new Error("Delete failed"));

      renderWithProvider([item]);

      const deleteButton = screen.getByTestId("delete-item-1");
      await userEvent.click(deleteButton);

      const modal = screen.getByTestId("delete-modal");
      const confirmButton = within(modal).getByRole("button", { name: /^Delete$/ });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Delete failed")).toBeInTheDocument();
        // Item should be restored
        expect(screen.getByTestId("action-item-item-1")).toBeInTheDocument();
      });
    });
  });

  describe("Deleted Items", () => {
    it("hides successfully deleted items", async () => {
      const items = [
        createMockEnrichedActionItem({ actionItemId: "item-1" }),
        createMockEnrichedActionItem({ actionItemId: "item-2" }),
      ];

      renderWithProvider(items);

      const deleteButton = screen.getByTestId("delete-item-1");
      await userEvent.click(deleteButton);

      const modal = screen.getByTestId("delete-modal");
      const confirmButton = within(modal).getByRole("button", { name: /^Delete$/ });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByTestId("action-item-item-1")).not.toBeInTheDocument();
        expect(screen.getByTestId("action-item-item-2")).toBeInTheDocument();
      });
    });
  });
});

