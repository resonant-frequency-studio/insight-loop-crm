/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import ViewAllLink from "../ViewAllLink";

// Mock next/link
jest.mock("next/link", () => {
  const MockLink = ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("ViewAllLink", () => {
  describe("Rendering", () => {
    it("renders link with default label", () => {
      render(<ViewAllLink href="/contacts" />);
      const link = screen.getByRole("link", { name: "View All →" });
      expect(link).toBeInTheDocument();
    });

    it("renders link with custom label", () => {
      render(<ViewAllLink href="/contacts" label="See all contacts" />);
      const link = screen.getByRole("link", { name: "See all contacts" });
      expect(link).toBeInTheDocument();
    });

    it("has correct href attribute", () => {
      render(<ViewAllLink href="/action-items" />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/action-items");
    });
  });

  describe("Styling", () => {
    it("applies base link styles", () => {
      render(<ViewAllLink href="/contacts" />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass("text-sm", "text-blue-600", "font-medium");
    });

    it("applies hover styles", () => {
      render(<ViewAllLink href="/contacts" />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass("hover:text-blue-800", "hover:underline");
    });

    it("has margin-left auto class", () => {
      render(<ViewAllLink href="/contacts" />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass("ml-auto");
    });
  });
});
