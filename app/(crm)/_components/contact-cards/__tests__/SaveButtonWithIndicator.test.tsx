import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SaveButtonWithIndicator from "../SaveButtonWithIndicator";

describe("SaveButtonWithIndicator", () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  it("renders Save button when there are unsaved changes", () => {
    render(
      <SaveButtonWithIndicator
        saveStatus="idle"
        hasUnsavedChanges={true}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
  });

  it("disables Save button when there are no unsaved changes", () => {
    render(
      <SaveButtonWithIndicator
        saveStatus="idle"
        hasUnsavedChanges={false}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it("disables Save button when saving", () => {
    render(
      <SaveButtonWithIndicator
        saveStatus="saving"
        hasUnsavedChanges={true}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it("shows 'Saving...' text when saveStatus is 'saving'", () => {
    render(
      <SaveButtonWithIndicator
        saveStatus="saving"
        hasUnsavedChanges={true}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("does not show 'Saving...' text when saveStatus is not 'saving'", () => {
    render(
      <SaveButtonWithIndicator
        saveStatus="idle"
        hasUnsavedChanges={true}
        onSave={mockOnSave}
      />
    );

    expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
  });

  it("calls onSave when Save button is clicked", () => {
    render(
      <SaveButtonWithIndicator
        saveStatus="idle"
        hasUnsavedChanges={true}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it("does not call onSave when button is disabled", () => {
    render(
      <SaveButtonWithIndicator
        saveStatus="idle"
        hasUnsavedChanges={false}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("applies custom className when provided", () => {
    const { container } = render(
      <SaveButtonWithIndicator
        saveStatus="idle"
        hasUnsavedChanges={true}
        onSave={mockOnSave}
        className="custom-class"
      />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("custom-class");
  });
});

