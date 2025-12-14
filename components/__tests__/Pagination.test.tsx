/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "../Pagination";

describe("Pagination", () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    totalItems: 50,
    startIndex: 0,
    endIndex: 10,
    itemLabel: "contact",
    onPageChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Conditional rendering", () => {
    it("does not render when totalPages is 1", () => {
      const { container } = render(
        <Pagination
          {...defaultProps}
          currentPage={1}
          totalPages={1}
          totalItems={10}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders when totalPages is greater than 1", () => {
      render(<Pagination {...defaultProps} />);
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
    });
  });

  describe("Item count display", () => {
    it("displays correct item count", () => {
      render(<Pagination {...defaultProps} />);
      expect(screen.getByText(/showing 1 to 10 of 50/i)).toBeInTheDocument();
    });

    it("displays singular item label when totalItems is 1", () => {
      render(
        <Pagination
          {...defaultProps}
          totalItems={1}
          endIndex={1}
        />
      );
      expect(screen.getByText(/1 contact/i)).toBeInTheDocument();
    });

    it("displays plural item label when totalItems is greater than 1", () => {
      render(<Pagination {...defaultProps} />);
      expect(screen.getByText(/50 contacts/i)).toBeInTheDocument();
    });

    it("handles different item labels correctly", () => {
      render(
        <Pagination
          {...defaultProps}
          itemLabel="action item"
        />
      );
      expect(screen.getByText(/50 action items/i)).toBeInTheDocument();
    });

    it("shows correct end index when less than total items", () => {
      render(
        <Pagination
          {...defaultProps}
          currentPage={5}
          startIndex={40}
          endIndex={45}
        />
      );
      expect(screen.getByText(/showing 41 to 45 of 50/i)).toBeInTheDocument();
    });

    it("shows end index as totalItems when endIndex exceeds totalItems", () => {
      render(
        <Pagination
          {...defaultProps}
          currentPage={5}
          startIndex={45}
          endIndex={50}
          totalItems={48}
        />
      );
      expect(screen.getByText(/showing 46 to 48 of 48/i)).toBeInTheDocument();
    });
  });

  describe("Page navigation", () => {
    it("displays current page and total pages", () => {
      render(<Pagination {...defaultProps} currentPage={3} />);
      expect(screen.getByText("Page 3 of 5")).toBeInTheDocument();
    });

    it("calls onPageChange with previous page when Previous is clicked", () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          {...defaultProps}
          currentPage={3}
          onPageChange={handlePageChange}
        />
      );
      
      const previousButton = screen.getByRole("button", { name: /previous/i });
      fireEvent.click(previousButton);
      
      expect(handlePageChange).toHaveBeenCalledWith(2);
    });

    it("calls onPageChange with next page when Next is clicked", () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          {...defaultProps}
          currentPage={3}
          onPageChange={handlePageChange}
        />
      );
      
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);
      
      expect(handlePageChange).toHaveBeenCalledWith(4);
    });
  });

  describe("Disabled states", () => {
    it("disables Previous button on first page", () => {
      render(<Pagination {...defaultProps} currentPage={1} />);
      const previousButton = screen.getByRole("button", { name: /previous/i });
      expect(previousButton).toBeDisabled();
    });

    it("enables Previous button when not on first page", () => {
      render(<Pagination {...defaultProps} currentPage={2} />);
      const previousButton = screen.getByRole("button", { name: /previous/i });
      expect(previousButton).not.toBeDisabled();
    });

    it("disables Next button on last page", () => {
      render(<Pagination {...defaultProps} currentPage={5} />);
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it("enables Next button when not on last page", () => {
      render(<Pagination {...defaultProps} currentPage={3} />);
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe("Boundary conditions", () => {
    it("does not go below page 1 when Previous is clicked on first page", () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          {...defaultProps}
          currentPage={1}
          onPageChange={handlePageChange}
        />
      );
      
      const previousButton = screen.getByRole("button", { name: /previous/i });
      // Even if somehow clicked while disabled, it should use Math.max(1, ...)
      expect(previousButton).toBeDisabled();
    });

    it("does not exceed totalPages when Next is clicked on last page", () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          {...defaultProps}
          currentPage={5}
          onPageChange={handlePageChange}
        />
      );
      
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <Pagination {...defaultProps} className="custom-class" />
      );
      const pagination = container.firstChild as HTMLElement;
      expect(pagination).toHaveClass("custom-class");
    });

    it("has border-top styling", () => {
      const { container } = render(<Pagination {...defaultProps} />);
      const pagination = container.firstChild as HTMLElement;
      expect(pagination).toHaveClass("border-t", "border-gray-200", "pt-4", "mt-4");
    });
  });
});
