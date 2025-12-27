"use client";

import { useAuth } from "@/hooks/useAuth";
import DashboardTouchpoints from "./_components/DashboardTouchpoints";
import { Contact } from "@/types/firestore";
import RightColumnMetrics from "@/components/dashboard/RightColumnMetrics";
import PipelineSnapshot from "@/components/dashboard/PipelineSnapshot";
import SavedSegments from "@/components/dashboard/SavedSegments";
import Accordion from "@/components/Accordion";
import Card from "@/components/Card";
import SuggestedFocusCard from "@/components/dashboard/SuggestedFocusCard";
import FollowUpsToCompleteCard from "@/components/dashboard/FollowUpsToCompleteCard";

interface DashboardPageClientProps {
  userId: string;
  contacts: Contact[];
  contactsWithUpcomingTouchpoints?: unknown[];
  contactsWithOverdueTouchpoints?: unknown[];
  recentContacts?: unknown[];
}

export default function DashboardPageClient({ userId, contacts }: DashboardPageClientProps) {
  const { user, loading } = useAuth();

  // Wait for auth to load before checking for user
  // In production, user should be available after Google login
  // In E2E mode, we might not have Firebase user but session cookie is valid
  if (loading && !userId) {
    return null;
  }

  const firstName = user?.displayName?.split(" ")[0] || "User";

  return (
    <div id="dashboard-root" className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">
          Welcome back, {firstName}.
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-theme-dark text-lg">
            Here&apos;s a clear view of where your attention can have the most impact this week.
          </p>
          <span className="px-3 py-1 text-xs font-medium text-theme-darkest bg-card-highlight-light rounded-full border border-theme-lighter">
            Last 30 days
          </span>
        </div>
        <p className="text-sm text-theme-dark italic mt-2">
          Focused on recent activity from the past 30 days.
        </p>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* Left Column - Main Content */}
        <div className="space-y-6">
          {/* Touchpoints Section - Already uses Card internally */}
          <DashboardTouchpoints userId={userId} />
        </div>

        {/* Right Column - Organized into 3 Zones */}
        <div className="space-y-4">
          {/* Zone A - Suggested Focus (highest priority) */}
          <SuggestedFocusCard contacts={contacts} />
          <FollowUpsToCompleteCard contacts={contacts} />

          {/* Zone B - Snapshot (secondary, calm context) */}
          <RightColumnMetrics userId={userId} contacts={contacts} />

          {/* Zone C - Reference (lowest priority, collapsible) */}
          <Card className="p-4">
            <Accordion
              title="Pipeline & Saved Views"
              defaultOpen={false}
            >
              <div className="space-y-4 mt-4">
                <PipelineSnapshot userId={userId} />
                <SavedSegments userId={userId} />
              </div>
            </Accordion>
          </Card>
        </div>
      </div>
    </div>
  );
}

