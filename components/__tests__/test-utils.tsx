import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Contact, ActionItem } from "@/types/firestore";

/**
 * Custom render function that wraps components with React Query provider
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Mock data factory for Contact
 */
export function createMockContact(
  overrides?: Partial<Contact & { id: string }>
): Contact & { id: string } {
  const now = new Date().toISOString();
  return {
    id: overrides?.id || `contact-${Math.random().toString(36).substr(2, 9)}`,
    contactId: overrides?.contactId || `contact-${Math.random().toString(36).substr(2, 9)}`,
    primaryEmail: overrides?.primaryEmail || "test@example.com",
    firstName: overrides?.firstName ?? "John",
    lastName: overrides?.lastName ?? "Doe",
    tags: overrides?.tags || [],
    segment: overrides?.segment || null,
    leadSource: overrides?.leadSource || null,
    engagementScore: overrides?.engagementScore || null,
    notes: overrides?.notes || null,
    summary: overrides?.summary || null,
    lastEmailDate: overrides?.lastEmailDate || null,
    nextTouchpointDate: overrides?.nextTouchpointDate || null,
    nextTouchpointMessage: overrides?.nextTouchpointMessage || null,
    touchpointStatus: overrides?.touchpointStatus || null,
    archived: overrides?.archived || false,
    createdAt: overrides?.createdAt || now,
    updatedAt: overrides?.updatedAt || now,
  };
}

/**
 * Mock data factory for ActionItem
 */
export function createMockActionItem(
  overrides?: Partial<ActionItem>
): ActionItem {
  const now = new Date().toISOString();
  return {
    actionItemId: overrides?.actionItemId || `action-${Math.random().toString(36).substr(2, 9)}`,
    contactId: overrides?.contactId || `contact-${Math.random().toString(36).substr(2, 9)}`,
    userId: overrides?.userId || `user-${Math.random().toString(36).substr(2, 9)}`,
    text: overrides?.text || "Test action item",
    status: overrides?.status || "pending",
    dueDate: overrides?.dueDate || null,
    completedAt: overrides?.completedAt || null,
    createdAt: overrides?.createdAt || now,
    updatedAt: overrides?.updatedAt || now,
  };
}

/**
 * Helper to wait for async updates
 */
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Helper to mock Next.js Link component
 */
export const mockNextLink = () => {
  jest.mock("next/link", () => {
    return function MockLink({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    };
  });
};

