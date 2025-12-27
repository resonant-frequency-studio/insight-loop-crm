import { render, screen } from "@testing-library/react";
import Card from "../Card";

describe("Card", () => {
  describe("Rendering", () => {
    it("renders children correctly", () => {
      render(
        <Card>
          <div>Card Content</div>
        </Card>
      );
      expect(screen.getByText("Card Content")).toBeInTheDocument();
    });
  });

  describe("Padding Variants", () => {
    it("applies no padding when padding is 'none'", () => {
      const { container } = render(<Card padding="none">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveClass("p-3", "p-6", "p-8", "p-12");
    });

    it("applies sm padding", () => {
      const { container } = render(<Card padding="sm">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-4", "sm:p-3");
    });

    it("applies md padding by default", () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-4", "sm:p-6");
    });

    it("applies lg padding", () => {
      const { container } = render(<Card padding="lg">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-6", "sm:p-8");
    });

    it("applies xl padding", () => {
      const { container } = render(<Card padding="xl">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-8", "sm:p-12");
    });

    it("applies responsive padding", () => {
      const { container } = render(<Card padding="responsive">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-4", "sm:p-3", "xl:p-6");
    });
  });

  describe("Hover Effect", () => {
    it("applies hover effect when hover prop is true", () => {
      const { container } = render(<Card hover>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("hover:shadow-[0px_6px_16px_rgba(0,0,0,0.15)]");
      expect(card).toHaveClass("transition-shadow", "duration-200");
    });

    it("does not apply hover effect when hover prop is false", () => {
      const { container } = render(<Card hover={false}>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveClass("hover:shadow-[0px_6px_16px_rgba(0,0,0,0.15)]");
    });
  });

  describe("Custom className", () => {
    it("merges custom className correctly", () => {
      const { container } = render(<Card className="custom-class">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("custom-class");
      expect(card).toHaveClass("bg-card-light", "rounded-sm"); // Base classes still present
    });

    it("does not apply padding class when className includes padding", () => {
      const { container } = render(
        <Card padding="md" className="p-4">
          Content
        </Card>
      );
      const card = container.firstChild as HTMLElement;
      // Should not have p-6 (from md padding) since className has p-4
      expect(card).toHaveClass("p-4");
      // The padding prop should be ignored when className has padding
      const paddingClass = card.className.match(/\bp-\d+\b/);
      expect(paddingClass?.[0]).toBe("p-4");
    });

    it("does not apply padding when padding is 'none' and className has padding", () => {
      const { container } = render(
        <Card padding="none" className="p-4">
          Content
        </Card>
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-4");
    });
  });

  describe("Base Styles", () => {
    it("applies base card styles", () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-card-light");
      expect(card).toHaveClass("rounded-sm");
      expect(card).toHaveClass("shadow-sm");
      expect(card).toHaveClass("border", "border-theme-lighter");
    });
  });
});

