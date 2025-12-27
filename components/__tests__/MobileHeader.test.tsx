/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import MobileHeader from "../MobileHeader";

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

// Mock HamburgerMenu - it receives isOpen and onClick from MobileHeader
jest.mock("../HamburgerMenu", () => {
  return function MockHamburgerMenu({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
    return (
      <button onClick={onClick} data-testid="hamburger-menu" data-is-open={isOpen}>
        {isOpen ? "Close" : "Menu"}
      </button>
    );
  };
});

// Mock app-config
jest.mock("@/lib/app-config", () => ({
  appConfig: {
    crmName: "Test CRM",
  },
}));

describe("MobileHeader", () => {
  describe("Rendering", () => {
    it("renders header element", () => {
      render(<MobileHeader isMenuOpen={false} onMenuToggle={jest.fn()} />);
      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();
    });

    it("renders link to dashboard", () => {
      render(<MobileHeader isMenuOpen={false} onMenuToggle={jest.fn()} />);
      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/");
    });

    it("renders HamburgerMenu component", () => {
      render(<MobileHeader isMenuOpen={false} onMenuToggle={jest.fn()} />);
      const hamburger = screen.getByTestId("hamburger-menu");
      expect(hamburger).toBeInTheDocument();
    });
  });

  describe("Props forwarding", () => {
    it("passes isMenuOpen prop to HamburgerMenu as isOpen", () => {
      render(<MobileHeader isMenuOpen={true} onMenuToggle={jest.fn()} />);
      const hamburger = screen.getByTestId("hamburger-menu");
      expect(hamburger).toHaveAttribute("data-is-open", "true");
      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    it("passes onMenuToggle prop to HamburgerMenu as onClick", () => {
      const handleToggle = jest.fn();
      render(<MobileHeader isMenuOpen={false} onMenuToggle={handleToggle} />);
      const hamburger = screen.getByTestId("hamburger-menu");
      fireEvent.click(hamburger);
      expect(handleToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe("Styling", () => {
    it("applies correct header classes", () => {
      render(<MobileHeader isMenuOpen={false} onMenuToggle={jest.fn()} />);
      const header = screen.getByRole("banner");
      expect(header).toHaveClass("xl:hidden", "fixed", "top-0", "h-16", "bg-background", "border-b");
    });
  });
});
