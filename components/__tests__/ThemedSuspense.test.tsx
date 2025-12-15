/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import ThemedSuspense from "../ThemedSuspense";

// Component that throws a promise to simulate Suspense
const AsyncComponent = ({ delay = 0 }: { delay?: number }) => {
  throw new Promise((resolve) => setTimeout(resolve, delay));
};

// Component that resolves immediately
const SyncComponent = () => <div>Loaded Content</div>;

describe("ThemedSuspense", () => {
  describe("Custom fallback", () => {
    it("uses custom fallback when provided", () => {
      const customFallback = <div data-testid="custom-fallback">Custom Loading...</div>;
      
      render(
        <ThemedSuspense fallback={customFallback}>
          <SyncComponent />
        </ThemedSuspense>
      );
      
      // Should render children immediately since it's sync
      expect(screen.getByText("Loaded Content")).toBeInTheDocument();
    });
  });

  describe("Default variant fallback", () => {
    it("renders default variant fallback when no fallback provided", () => {
      render(
        <ThemedSuspense>
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      // Check for default variant elements (header and cards)
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("has header skeleton in default variant", () => {
      const { container } = render(
        <ThemedSuspense>
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      const header = container.querySelector(".h-6.bg-card-highlight-light");
      expect(header).toBeInTheDocument();
    });

    it("has multiple card skeletons in default variant", () => {
      const { container } = render(
        <ThemedSuspense>
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      const cards = container.querySelectorAll(".rounded-xl.shadow");
      expect(cards.length).toBe(5); // Default variant shows 5 cards
    });
  });

  describe("Simple variant", () => {
    it("renders simple variant fallback", () => {
      const { container } = render(
        <ThemedSuspense variant="simple">
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      const simpleSkeleton = container.querySelector(".h-8.w-16.bg-theme-light");
      expect(simpleSkeleton).toBeInTheDocument();
    });
  });

  describe("Card variant", () => {
    it("renders single card variant fallback", () => {
      const { container } = render(
        <ThemedSuspense variant="card">
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      const card = container.querySelector(".rounded-xl.shadow");
      expect(card).toBeInTheDocument();
      
      // Should only have one card
      const cards = container.querySelectorAll(".rounded-xl.shadow");
      expect(cards.length).toBe(1);
    });

    it("has avatar and text placeholders in card variant", () => {
      const { container } = render(
        <ThemedSuspense variant="card">
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      const avatar = container.querySelector(".rounded-full");
      const textPlaceholders = container.querySelectorAll(".bg-theme-light.rounded");
      expect(avatar).toBeInTheDocument();
      expect(textPlaceholders.length).toBeGreaterThan(0);
    });
  });

  describe("List variant", () => {
    it("renders list variant fallback", () => {
      const { container } = render(
        <ThemedSuspense variant="list">
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      // List variant has 3 items
      const listItems = container.querySelectorAll(".rounded-sm");
      expect(listItems.length).toBe(3);
    });

    it("does not have card wrapper in list variant", () => {
      const { container } = render(
        <ThemedSuspense variant="list">
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      // Should not have rounded-xl cards
      const cards = container.querySelectorAll(".rounded-xl.shadow");
      expect(cards.length).toBe(0);
      
      // Should have rounded-sm items
      const items = container.querySelectorAll(".rounded-sm");
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe("Children rendering", () => {
    it("renders children when not suspended", () => {
      render(
        <ThemedSuspense>
          <SyncComponent />
        </ThemedSuspense>
      );
      
      expect(screen.getByText("Loaded Content")).toBeInTheDocument();
    });
  });

  describe("Suspense behavior", () => {
    it("shows fallback while component is loading", () => {
      const { container } = render(
        <ThemedSuspense variant="simple">
          <AsyncComponent />
        </ThemedSuspense>
      );
      
      // Should show skeleton
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });
  });
});
