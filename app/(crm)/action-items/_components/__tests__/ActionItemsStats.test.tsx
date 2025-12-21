import { render, screen } from "@testing-library/react";
import ActionItemsStats from "../ActionItemsStats";

// Mock the useAnimatedNumber hook to return the target value immediately
jest.mock("@/hooks/useAnimatedNumber", () => ({
  useAnimatedNumber: (target: number) => target,
}));

describe("ActionItemsStats", () => {
  it("renders all stat cards with correct values", () => {
    render(
      <ActionItemsStats total={10} pending={7} overdue={3} today={2} />
    );

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders zero values correctly", () => {
    render(
      <ActionItemsStats total={0} pending={0} overdue={0} today={0} />
    );

    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(4);
  });

  it("renders large numbers correctly", () => {
    render(
      <ActionItemsStats total={999} pending={500} overdue={250} today={100} />
    );

    expect(screen.getByText("999")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });
});

