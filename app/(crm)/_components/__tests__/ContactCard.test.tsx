import { render, screen, fireEvent } from "@testing-library/react";
import ContactCard from "../ContactCard";
import { createMockContact } from "@/components/__tests__/test-utils";

// Mock TouchpointStatusActions
jest.mock("../TouchpointStatusActions", () => ({
  __esModule: true,
  default: ({ contactId, contactName }: { contactId: string; contactName: string }) => (
    <div data-testid="touchpoint-actions">
      Actions for {contactName} ({contactId})
    </div>
  ),
}));

describe("ContactCard", () => {
  const mockContact = createMockContact({
    id: "contact-1",
    firstName: "John",
    lastName: "Doe",
    primaryEmail: "john.doe@example.com",
    segment: "Enterprise",
    tags: ["VIP", "Priority"],
  });

  describe("Rendering", () => {
    it("renders contact information (name, email)", () => {
      render(<ContactCard contact={mockContact} />);
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
    });

    it("displays initials in avatar", () => {
      render(<ContactCard contact={mockContact} />);
      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("displays initials from email when name is missing", () => {
      const contactWithoutName = {
        ...createMockContact({
          id: "contact-2",
          primaryEmail: "test@example.com",
        }),
        firstName: null,
        lastName: null,
      };
      render(<ContactCard contact={contactWithoutName} />);
      // Initials should be in the avatar div - should be "T" from "test@example.com"
      // Query for the avatar directly - there's only one rounded-full element per card
      const card = screen.getByRole("link").closest(".rounded-sm");
      const avatar = card?.querySelector(".rounded-full");
      expect(avatar?.textContent?.trim()).toBe("T");
    });
  });

  describe("Link Navigation", () => {
    it("link navigates to correct contact detail page", () => {
      render(<ContactCard contact={mockContact} />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/contacts/contact-1");
    });
  });

  describe("Checkbox", () => {
    it("checkbox appears when showCheckbox is true", () => {
      const mockOnSelectChange = jest.fn();
      render(
        <ContactCard
          contact={mockContact}
          showCheckbox
          onSelectChange={mockOnSelectChange}
        />
      );
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });

    it("checkbox does not appear when showCheckbox is false", () => {
      render(<ContactCard contact={mockContact} showCheckbox={false} />);
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("checkbox selection calls onSelectChange", () => {
      const mockOnSelectChange = jest.fn();
      render(
        <ContactCard
          contact={mockContact}
          showCheckbox
          onSelectChange={mockOnSelectChange}
        />
      );
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);
      expect(mockOnSelectChange).toHaveBeenCalledWith("contact-1");
    });

    it("checkbox is checked when isSelected is true", () => {
      render(
        <ContactCard
          contact={mockContact}
          showCheckbox
          isSelected
        />
      );
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe("Variants", () => {
    it("selected variant shows correct styling", () => {
      const { container } = render(
        <ContactCard contact={mockContact} variant="selected" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("ring-2", "ring-blue-500", "bg-card-active");
    });

    it("touchpoint-upcoming variant shows correct styling", () => {
      const { container } = render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-upcoming"
          touchpointDate={new Date()}
          daysUntil={5}
        />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("border", "border-theme-light");
    });

    it("touchpoint-overdue variant shows correct styling", () => {
      const { container } = render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-overdue"
          touchpointDate={new Date()}
          daysUntil={-2}
        />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-card-overdue", "border", "border-card-overdue-dark");
    });
  });

  describe("Touchpoint Badges", () => {
    it("'Due Soon' badge appears when needsReminder is true", () => {
      render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-upcoming"
          touchpointDate={new Date()}
          daysUntil={2}
          needsReminder
        />
      );
      expect(screen.getByText("Due Soon")).toBeInTheDocument();
    });

    it("'Overdue' badge appears for touchpoint-overdue variant", () => {
      render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-overdue"
          touchpointDate={new Date()}
          daysUntil={-1}
        />
      );
      expect(screen.getByText("Overdue")).toBeInTheDocument();
    });

    it("formats touchpoint date as 'Today' when daysUntil is 0", () => {
      const today = new Date();
      render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-upcoming"
          touchpointDate={today}
          daysUntil={0}
        />
      );
      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    it("formats touchpoint date as 'Tomorrow' when daysUntil is 1", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-upcoming"
          touchpointDate={tomorrow}
          daysUntil={1}
        />
      );
      expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    });
  });

  describe("Touchpoint Message", () => {
    it("touchpoint message displays for touchpoint variants", () => {
      const contactWithMessage = createMockContact({
        ...mockContact,
        nextTouchpointMessage: "Follow up on proposal",
      });
      render(
        <ContactCard
          contact={contactWithMessage}
          variant="touchpoint-upcoming"
          touchpointDate={new Date()}
          daysUntil={5}
        />
      );
      expect(screen.getByText("Follow up on proposal")).toBeInTheDocument();
    });
  });

  describe("Touchpoint Actions", () => {
    it("touchpoint actions render when showTouchpointActions is true", () => {
      const mockOnUpdate = jest.fn();
      render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-upcoming"
          showTouchpointActions
          onTouchpointStatusUpdate={mockOnUpdate}
        />
      );
      expect(screen.getByTestId("touchpoint-actions")).toBeInTheDocument();
    });

    it("touchpoint actions do not render when showTouchpointActions is false", () => {
      render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-upcoming"
          showTouchpointActions={false}
        />
      );
      expect(screen.queryByTestId("touchpoint-actions")).not.toBeInTheDocument();
    });
  });

  describe("Segment and Tags", () => {
    it("segment displays correctly", () => {
      render(<ContactCard contact={mockContact} />);
      // Segment appears in multiple places, check it exists
      const segments = screen.getAllByText("Enterprise");
      expect(segments.length).toBeGreaterThan(0);
    });

    it("tags display correctly", () => {
      render(<ContactCard contact={mockContact} />);
      // Tags appear in multiple places (mobile and desktop), check they exist
      const vipTags = screen.getAllByText("VIP");
      expect(vipTags.length).toBeGreaterThan(0);
      const priorityTags = screen.getAllByText("Priority");
      expect(priorityTags.length).toBeGreaterThan(0);
    });

    it("tags truncation shows +N for overflow", () => {
      const contactWithManyTags = createMockContact({
        ...mockContact,
        tags: ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5"],
      });
      render(<ContactCard contact={contactWithManyTags} />);
      // Should show first 3 tags and +2 for overflow
      expect(screen.getByText("+2")).toBeInTheDocument();
    });
  });

  describe("Date Information", () => {
    it("last email date displays when available", () => {
      const contactWithEmailDate = createMockContact({
        ...mockContact,
        lastEmailDate: new Date().toISOString(),
      });
      render(<ContactCard contact={contactWithEmailDate} />);
      expect(screen.getByText(/Last email:/i)).toBeInTheDocument();
    });

    it("updated date displays when available", () => {
      const contactWithUpdateDate = createMockContact({
        ...mockContact,
        updatedAt: new Date().toISOString(),
      });
      render(<ContactCard contact={contactWithUpdateDate} />);
      expect(screen.getByText(/Updated:/i)).toBeInTheDocument();
    });
  });

  describe("Arrow Icon", () => {
    it("arrow icon shows on hover (desktop)", () => {
      const { container } = render(
        <ContactCard contact={mockContact} showArrow />
      );
      const arrow = container.querySelector(".opacity-0.group-hover\\:opacity-100");
      expect(arrow).toBeInTheDocument();
    });

    it("arrow icon does not show for touchpoint variants", () => {
      const { container } = render(
        <ContactCard
          contact={mockContact}
          variant="touchpoint-upcoming"
          showArrow
        />
      );
      const arrow = container.querySelector(".opacity-0.group-hover\\:opacity-100");
      expect(arrow).not.toBeInTheDocument();
    });
  });
});

