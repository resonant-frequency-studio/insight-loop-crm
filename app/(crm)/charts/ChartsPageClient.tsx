"use client";

import { useAuth } from "@/hooks/useAuth";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import DashboardCharts from "../_components/DashboardCharts";
import EmptyState from "@/components/dashboard/EmptyState";
import ThemedSuspense from "@/components/ThemedSuspense";

export default function ChartsPageClient({ userId: ssrUserId }: { userId: string | null }) {
  const { user, loading: authLoading } = useAuth();
  
  // Prioritize userId prop from SSR (production should always have this)
  // Only fallback to client auth if userId prop is empty (E2E mode)
  const effectiveUserId = ssrUserId || (!authLoading && user?.uid ? user.uid : null);
  
  // Use Firebase real-time listeners
  const { contacts, loading: contactsLoading } = useContactsRealtime(effectiveUserId);

  // Show loading state if we don't have userId yet OR if contacts are loading (initial load)
  if (!effectiveUserId || (contactsLoading && contacts.length === 0)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Charts & Analytics</h1>
          <p className="text-theme-dark text-lg">Visual insights into your contact data and engagement metrics</p>
        </div>
        <ThemedSuspense
          isLoading={true}
          fallback={
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse">
                  <div className="h-6 bg-theme-light rounded w-40 mb-4" />
                  <div className="h-64 bg-theme-light rounded" />
                </div>
              ))}
            </div>
          }
        />
      </div>
    );
  }
  
  // Show empty state only after loading completes AND there's no data
  if (!contactsLoading && contacts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Charts & Analytics</h1>
          <p className="text-theme-dark text-lg">
            Visual insights into your contact data and engagement metrics
          </p>
        </div>
        <EmptyState wrapInCard={true} size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Charts & Analytics</h1>
        <p className="text-theme-dark text-lg">
          Visual insights into your contact data and engagement metrics
        </p>
      </div>

      {/* Charts Section */}
      <DashboardCharts contacts={contacts} />
    </div>
  );
}

