import { render, screen, fireEvent } from "@testing-library/react";
import {
  ErrorMessage,
  extractErrorMessage,
  extractApiError,
  toUserFriendlyError,
} from "../ErrorMessage";

describe("ErrorMessage", () => {
  describe("Rendering", () => {
    it("renders error message", () => {
      render(<ErrorMessage message="Something went wrong" />);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("has correct role and aria-live attributes", () => {
      render(<ErrorMessage message="Error" />);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
    });

    it("applies custom className", () => {
      const { container } = render(
        <ErrorMessage message="Error" className="custom-class" />
      );
      const alert = container.querySelector(".custom-class");
      expect(alert).toBeInTheDocument();
    });
  });

  describe("Dismissible", () => {
    it("shows dismissible button when dismissible is true", () => {
      render(<ErrorMessage message="Error" dismissible />);
      const dismissButton = screen.getByLabelText("Dismiss error message");
      expect(dismissButton).toBeInTheDocument();
    });

    it("does not show dismissible button when dismissible is false", () => {
      render(<ErrorMessage message="Error" dismissible={false} />);
      expect(
        screen.queryByLabelText("Dismiss error message")
      ).not.toBeInTheDocument();
    });

    it("calls onDismiss when dismissible button is clicked", () => {
      const mockOnDismiss = jest.fn();
      render(
        <ErrorMessage
          message="Error"
          dismissible
          onDismiss={mockOnDismiss}
        />
      );
      const dismissButton = screen.getByLabelText("Dismiss error message");
      fireEvent.click(dismissButton);
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it("hides error message when dismissed", () => {
      render(<ErrorMessage message="Error" dismissible />);
      const dismissButton = screen.getByLabelText("Dismiss error message");
      fireEvent.click(dismissButton);
      expect(screen.queryByText("Error")).not.toBeInTheDocument();
    });
  });
});

describe("extractErrorMessage", () => {
  it("converts Firestore quota errors to user-friendly messages", () => {
    expect(
      extractErrorMessage(new Error("RESOURCE_EXHAUSTED: Quota exceeded"))
    ).toBe("Database quota exceeded. Please wait a few hours or upgrade your plan.");

    expect(
      extractErrorMessage(new Error("Quota exceeded"))
    ).toBe("Database quota exceeded. Please wait a few hours or upgrade your plan.");
  });

  it("converts network errors to user-friendly messages", () => {
    expect(
      extractErrorMessage(new Error("Failed to fetch"))
    ).toBe("Network error. Please check your connection and try again.");

    expect(
      extractErrorMessage(new Error("NetworkError"))
    ).toBe("Network error. Please check your connection and try again.");

    expect(
      extractErrorMessage(new Error("network issue"))
    ).toBe("Network error. Please check your connection and try again.");
  });

  it("converts permission errors to user-friendly messages", () => {
    expect(
      extractErrorMessage(new Error("permission denied"))
    ).toBe("Permission denied. Please ensure you're logged in and have access.");

    expect(
      extractErrorMessage(new Error("PERMISSION_DENIED"))
    ).toBe("Permission denied. Please ensure you're logged in and have access.");
  });

  it("converts authentication errors to user-friendly messages", () => {
    expect(
      extractErrorMessage(new Error("UNAUTHENTICATED"))
    ).toBe("Authentication required. Please log in and try again.");

    expect(
      extractErrorMessage(new Error("authentication failed"))
    ).toBe("Authentication required. Please log in and try again.");
  });

  it("converts Gmail API errors to user-friendly messages", () => {
    expect(
      extractErrorMessage(new Error("Gmail API error"))
    ).toBe("Email sync error. Please try again or contact support if the issue persists.");

    expect(
      extractErrorMessage(new Error("gmail sync failed"))
    ).toBe("Email sync error. Please try again or contact support if the issue persists.");
  });

  it("converts generic technical errors to user-friendly messages", () => {
    expect(
      extractErrorMessage(new Error("TypeError: Cannot read property"))
    ).toBe("An unexpected error occurred. Please refresh the page and try again.");

    expect(
      extractErrorMessage(new Error("ReferenceError: x is not defined"))
    ).toBe("An unexpected error occurred. Please refresh the page and try again.");

    expect(
      extractErrorMessage(new Error("SyntaxError: Unexpected token"))
    ).toBe("An unexpected error occurred. Please refresh the page and try again.");
  });

  it("handles string errors", () => {
    expect(extractErrorMessage("Simple error")).toBe("Simple error");
    expect(extractErrorMessage("RESOURCE_EXHAUSTED")).toBe(
      "Database quota exceeded. Please wait a few hours or upgrade your plan."
    );
  });

  it("handles unknown error types", () => {
    expect(extractErrorMessage(null)).toBe(
      "An unexpected error occurred. Please try again."
    );
    expect(extractErrorMessage(undefined)).toBe(
      "An unexpected error occurred. Please try again."
    );
    expect(extractErrorMessage({})).toBe(
      "An unexpected error occurred. Please try again."
    );
  });

  it("handles technical patterns in error messages", () => {
    expect(
      extractErrorMessage(new Error("Error at file.tsx:123:45"))
    ).toBe("An error occurred. Please try again or contact support if the issue persists.");

    expect(
      extractErrorMessage(new Error("Error: at Object.function"))
    ).toBe("An error occurred. Please try again or contact support if the issue persists.");
  });

  it("returns user-friendly messages for short, non-technical errors", () => {
    expect(extractErrorMessage("Invalid input")).toBe("Invalid input");
    expect(extractErrorMessage("Not found")).toBe("Not found");
  });
});

describe("extractApiError", () => {
  it("extracts error from API response JSON", async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: "RESOURCE_EXHAUSTED" }),
    } as unknown as Response;

    const error = await extractApiError(mockResponse);
    expect(error).toBe(
      "Database quota exceeded. Please wait a few hours or upgrade your plan."
    );
  });

  it("extracts message from API response JSON", async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ message: "network error" }),
    } as unknown as Response;

    const error = await extractApiError(mockResponse);
    expect(error).toBe("Network error. Please check your connection and try again.");
  });

  it("handles 429 status code", async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: jest.fn().mockRejectedValue(new Error("Not JSON")),
    } as unknown as Response;

    const error = await extractApiError(mockResponse);
    expect(error).toBe("Too many requests. Please wait a moment and try again.");
  });

  it("handles 503 status code", async () => {
    const mockResponse = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: jest.fn().mockRejectedValue(new Error("Not JSON")),
    } as unknown as Response;

    const error = await extractApiError(mockResponse);
    expect(error).toBe("Service temporarily unavailable. Please try again later.");
  });

  it("handles 500+ status codes", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: jest.fn().mockRejectedValue(new Error("Not JSON")),
    } as unknown as Response;

    const error = await extractApiError(mockResponse);
    expect(error).toBe("Server error. Please try again later.");
  });

  it("handles 401/403 status codes", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: jest.fn().mockRejectedValue(new Error("Not JSON")),
    } as unknown as Response;

    const error = await extractApiError(mockResponse);
    expect(error).toBe("Authentication required. Please log in and try again.");
  });

  it("handles JSON parsing failure", async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: jest.fn().mockRejectedValue(new Error("Not JSON")),
    } as unknown as Response;

    const error = await extractApiError(mockResponse);
    expect(error).toContain("Bad Request");
  });
});

describe("toUserFriendlyError", () => {
  it("wraps extractErrorMessage", () => {
    expect(toUserFriendlyError(new Error("RESOURCE_EXHAUSTED"))).toBe(
      "Database quota exceeded. Please wait a few hours or upgrade your plan."
    );
    expect(toUserFriendlyError("network error")).toBe(
      "Network error. Please check your connection and try again."
    );
  });
});

