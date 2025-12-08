import { render, screen } from "@testing-library/react";
import Loading from "../Loading";

describe("Loading", () => {
  it("renders loading text", () => {
    render(<Loading />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("applies correct styling classes", () => {
    const { container } = render(<Loading />);
    const loadingDiv = container.firstChild as HTMLElement;
    expect(loadingDiv).toHaveClass("flex", "items-center", "justify-center");
    expect(loadingDiv).toHaveClass("h-screen", "bg-neutral-200");
  });
});

