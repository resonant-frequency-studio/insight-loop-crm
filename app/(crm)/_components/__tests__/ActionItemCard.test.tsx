import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ActionItemCard from "../ActionItemCard";
import { createMockActionItem } from "@/components/__tests__/test-utils";

describe("ActionItemCard", () => {
  const mockActionItem = createMockActionItem({
    actionItemId: "action-1",
    contactId: "contact-1",
    text: "Follow up on proposal",
    status: "pending",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  });

  const mockOnComplete = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders action item text", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          contactEmail="john@example.com"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.getByText("Follow up on proposal")).toBeInTheDocument();
    });
  });

  describe("Status Styling", () => {
    it("completed status shows correct styling (gray, line-through)", () => {
      const completedItem = createMockActionItem({
        ...mockActionItem,
        status: "completed",
      });
      const { container } = render(
        <ActionItemCard
          actionItem={completedItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const text = screen.getByText("Follow up on proposal");
      expect(text).toHaveClass("line-through", "text-gray-500");
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-card-highlight-light");
    });

    it("overdue status shows correct styling (red)", () => {
      const overdueItem = createMockActionItem({
        ...mockActionItem,
        status: "pending",
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      });
      const { container } = render(
        <ActionItemCard
          actionItem={overdueItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          isOverdue={true}
        />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-card-overdue", "border-card-overdue-dark");
    });
  });

  describe("Completion", () => {
    it("checkbox toggles completion status", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it("checkbox is unchecked for pending items", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });

    it("checkbox is checked for completed items", () => {
      const completedItem = createMockActionItem({
        ...mockActionItem,
        status: "completed",
      });
      render(
        <ActionItemCard
          actionItem={completedItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });
  });

  describe("Edit Mode", () => {
    it("edit mode activates on edit button click", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Follow up on proposal")).toBeInTheDocument();
    });

    it("edit mode shows textarea and date input", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
    });

    it("save edit calls onEdit with correct values", async () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Updated text" } });

      const saveButton = screen.getByRole("button", { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnEdit).toHaveBeenCalledWith(
          "Updated text",
          expect.any(String)
        );
      });
    });

    it("cancel edit resets form", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Changed text" } });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Should exit edit mode
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      // Original text should still be displayed
      expect(screen.getByText("Follow up on proposal")).toBeInTheDocument();
    });

    it("save button is disabled when text is empty", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "   " } }); // Only whitespace

      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Delete", () => {
    it("delete button calls onDelete", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const deleteButton = screen.getByRole("button", { name: /delete/i });
      fireEvent.click(deleteButton);
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it("delete button does not appear for completed items", () => {
      const completedItem = createMockActionItem({
        ...mockActionItem,
        status: "completed",
      });
      render(
        <ActionItemCard
          actionItem={completedItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe("Contact Info", () => {
    it("contact info displays when not in compact mode", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          contactEmail="john@example.com"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          compact={false}
        />
      );
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
    });

    it("contact info hidden when in compact mode", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          contactEmail="john@example.com"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          compact
        />
      );
      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      expect(screen.queryByText("john@example.com")).not.toBeInTheDocument();
    });

    it("link to contact detail page works", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          contactEmail="john@example.com"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/contacts/contact-1");
    });
  });

  describe("Date Information", () => {
    it("due date displays correctly", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.getByText(/Due:/i)).toBeInTheDocument();
    });

    it("overdue indicator shows when overdue", () => {
      const overdueItem = createMockActionItem({
        ...mockActionItem,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      });
      render(
        <ActionItemCard
          actionItem={overdueItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          isOverdue={true}
        />
      );
      expect(screen.getByText(/Overdue/i)).toBeInTheDocument();
    });

    it("completed date displays when completed", () => {
      const completedItem = createMockActionItem({
        ...mockActionItem,
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      render(
        <ActionItemCard
          actionItem={completedItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.getByText(/Completed:/i)).toBeInTheDocument();
    });

    it("created date displays", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.getByText(/Created:/i)).toBeInTheDocument();
    });
  });

  describe("Disabled State", () => {
    it("disabled state prevents interactions", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          disabled
        />
      );
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();

      const editButton = screen.getByRole("button", { name: /edit/i });
      expect(editButton).toBeDisabled();
    });
  });

  describe("Pre-computed Values", () => {
    it("uses pre-computed isOverdue when provided", () => {
      const { container } = render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          contactName="John Doe"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          isOverdue={true}
        />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-card-overdue", "border-card-overdue-dark");
    });

    it("uses pre-computed displayName when provided", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          displayName="Jane Smith"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    it("uses pre-computed initials when provided", () => {
      render(
        <ActionItemCard
          actionItem={mockActionItem}
          contactId="contact-1"
          initials="JS"
          onComplete={mockOnComplete}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.getByText("JS")).toBeInTheDocument();
    });
  });
});

