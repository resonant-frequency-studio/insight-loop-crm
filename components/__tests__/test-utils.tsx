import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UseQueryResult, UseMutationResult } from "@tanstack/react-query";
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
  // Check if createdAt/updatedAt are explicitly provided (even if undefined)
  const createdAtProvided = overrides && "createdAt" in overrides;
  const updatedAtProvided = overrides && "updatedAt" in overrides;
  return {
    id: overrides?.id || `contact-${Math.random().toString(36).substr(2, 9)}`,
    contactId: overrides?.contactId || `contact-${Math.random().toString(36).substr(2, 9)}`,
    primaryEmail: overrides?.primaryEmail || "test@example.com",
    firstName: overrides?.firstName ?? "John",
    lastName: overrides?.lastName ?? "Doe",
    company: overrides?.company ?? null,
    tags: overrides?.tags || [],
    segment: overrides?.segment || null,
    leadSource: overrides?.leadSource || null,
    engagementScore: overrides?.engagementScore ?? null,
    notes: overrides?.notes ?? null,
    summary: overrides?.summary ?? null,
    lastEmailDate: overrides?.lastEmailDate ?? null,
    nextTouchpointDate: overrides?.nextTouchpointDate ?? null,
    nextTouchpointMessage: overrides?.nextTouchpointMessage ?? null,
    touchpointStatus: overrides?.touchpointStatus ?? null,
    archived: overrides?.archived || false,
    createdAt: createdAtProvided ? (overrides!.createdAt as unknown) : now,
    updatedAt: updatedAtProvided ? (overrides!.updatedAt as unknown) : now,
    outreachDraft: overrides?.outreachDraft ?? null,
    threadCount: overrides?.threadCount ?? undefined,
    painPoints: overrides?.painPoints ?? null,
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

/**
 * Helper function to create properly typed UseQueryResult mocks
 */
export function createMockUseQueryResult<T, E = Error>(
  data: T | undefined,
  isLoading: boolean = false,
  error: E | null = null
): UseQueryResult<T, E> {
  return {
    data,
    isLoading,
    error,
    isError: error !== null,
    isSuccess: !isLoading && error === null,
    status: isLoading ? "loading" : error ? "error" : "success",
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: error ? Date.now() : 0,
    failureCount: error ? 1 : 0,
    failureReason: error,
    fetchStatus: isLoading ? "fetching" : "idle",
    isFetched: !isLoading,
    isFetchedAfterMount: !isLoading,
    isFetching: isLoading,
    isInitialLoading: isLoading,
    isPaused: false,
    isPlaceholderData: false,
    isRefetching: false,
    isStale: false,
    refetch: jest.fn(),
    remove: jest.fn(),
    isPending: isLoading,
    isLoadingError: error !== null && isLoading,
    isRefetchError: false,
    errorUpdateCount: error ? 1 : 0,
    isEnabled: true,
    promise: Promise.resolve(data) as Promise<T>,
  } as unknown as UseQueryResult<T, E>;
}

/**
 * Helper function to create properly typed UseMutationResult mocks
 */
export function createMockUseMutationResult<TData, TError, TVariables, TContext>(
  mutate: jest.Mock,
  mutateAsync: jest.Mock,
  isPending: boolean = false,
  isError: boolean = false,
  isSuccess: boolean = false,
  error: TError | null = null,
  data: TData | undefined = undefined
): UseMutationResult<TData, TError, TVariables, TContext> {
  return {
    mutate,
    mutateAsync,
    isPending,
    isError,
    isSuccess,
    error,
    data,
    reset: jest.fn(),
    status: isPending ? "pending" : isError ? "error" : isSuccess ? "success" : "idle",
    failureCount: isError ? 1 : 0,
    failureReason: error,
    isIdle: !isPending && !isError && !isSuccess,
    isPaused: false,
    submittedAt: isSuccess ? Date.now() : 0,
    variables: undefined,
    context: undefined,
  } as UseMutationResult<TData, TError, TVariables, TContext>;
}

