"use client";

import { useAuth } from "@/hooks/useAuth";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import EmptyState from "@/components/dashboard/EmptyState";
import ThemedSuspense from "@/components/ThemedSuspense";
import Card from "@/components/Card";
import Accordion from "@/components/Accordion";
import RelationshipsNeedingAttentionCard from "../_components/insights/RelationshipsNeedingAttentionCard";
import MissingLeadSourceCard from "../_components/insights/MissingLeadSourceCard";
import SegmentCoverageCard from "../_components/insights/SegmentCoverageCard";
import EngagementInsightsCard from "../_components/insights/EngagementInsightsCard";
import SentimentAlertsCard from "../_components/insights/SentimentAlertsCard";
import TagCoverageCard from "../_components/insights/TagCoverageCard";

export default function InsightsPageClient({
  userId: ssrUserId,
}: {
  userId: string | null;
}) {
  const { user, loading: authLoading } = useAuth();

  // Prioritize userId prop from SSR (production should always have this)
  // Only fallback to client auth if userId prop is empty (E2E mode)
  const effectiveUserId =
    ssrUserId || (!authLoading && user?.uid ? user.uid : null);

  // Use Firebase real-time listeners
  const {
    contacts,
    loading: contactsLoading,
    hasConfirmedNoContacts,
  } = useContactsRealtime(effectiveUserId);

  // Show loading state only if we don't have userId yet OR if contacts are loading AND no cached data
  if (!effectiveUserId || (contactsLoading && contacts.length === 0)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Insights</h1>
          <p className="text-theme-dark text-lg">
            A thoughtful reflection on your active relationships and where they may benefit from attention.
          </p>
        </div>
        <ThemedSuspense
          isLoading={true}
          fallback={
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card-highlight-light rounded-xl shadow p-6 animate-pulse"
                >
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

  // Show empty state as soon as we have confirmed no contacts (don't wait for loading to complete)
  if (hasConfirmedNoContacts && contacts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Insights</h1>
          <p className="text-theme-dark text-lg">
            A thoughtful reflection on your active relationships and where they may benefit from attention.
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
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Insights</h1>
        <p className="text-theme-dark text-lg">
          A thoughtful reflection on your active relationships and where they may benefit from attention.
        </p>
      </div>

      {/* Tier 1 — Suggested Focus */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-theme-darkest mb-4">
            Suggested Focus
          </h2>
          <RelationshipsNeedingAttentionCard contacts={contacts} />
        </div>

        <SentimentAlertsCard contacts={contacts} />

        <EngagementInsightsCard contacts={contacts} />
      </div>

      {/* Tier 2 — Background Awareness */}
      <div className="border-t border-theme-lighter">
        <Card padding="md">
          <Accordion
            title="Background Awareness"
            description="Optional — no action required. These insights are for reflection and context."
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <MissingLeadSourceCard contacts={contacts} />
              <SegmentCoverageCard contacts={contacts} />
              <TagCoverageCard contacts={contacts} />
            </div>
          </Accordion>
        </Card>
      </div>
    </div>
  );
}

