"use client";

import { useAuth } from "@/hooks/useAuth";
import DashboardTouchpoints from "./_components/DashboardTouchpoints";
import { Contact } from "@/types/firestore";
import RightColumnMetrics from "@/components/dashboard/RightColumnMetrics";
import PipelineSnapshot from "@/components/dashboard/PipelineSnapshot";
import AiInsights from "@/components/dashboard/AiInsights";
import SavedSegments from "@/components/dashboard/SavedSegments";

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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">
          Welcome back, {user?.displayName?.split(" ")[0] || "User"}!
        </h1>
        <p className="text-theme-dark text-lg">
          Here&apos;s what&apos;s happening with your contacts today
        </p>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* Left Column - Main Content */}
        <div className="space-y-6">
          {/* Touchpoints Section - Already uses Card internally */}
          <DashboardTouchpoints userId={userId} />
        </div>

        {/* Right Column - Metrics & Insights */}
        <div className="space-y-6">
          <RightColumnMetrics userId={userId} contacts={contacts} />
          <AiInsights userId={userId} />
          <PipelineSnapshot userId={userId} />
          <SavedSegments userId={userId} />
        </div>
      </div>
    </div>
  );
}

