"use client";

import { useAuth } from "@/hooks/useAuth";
import DashboardStatsCards from "./_components/DashboardStatsCards";
import DashboardCharts from "./_components/DashboardCharts";
import DashboardTouchpoints from "./_components/DashboardTouchpoints";
import { DashboardStats } from "@/hooks/useDashboardStats";

interface DashboardPageClientProps {
  userId: string;
  initialStats?: DashboardStats;
  contactsWithUpcomingTouchpoints?: unknown[];
  contactsWithOverdueTouchpoints?: unknown[];
  recentContacts?: unknown[];
}

export default function DashboardPageClient({ userId, initialStats }: DashboardPageClientProps) {
  const { user, loading } = useAuth();

  // Wait for auth to load before checking for user
  // In production, user should be available after Google login
  // In E2E mode, we might not have Firebase user but session cookie is valid
  // If we have userId from SSR, we can render even without Firebase user (data will load via session cookie)
  if (loading && !userId) {
    // Only wait if we don't have userId from SSR
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header Section - Static, renders immediately */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.displayName?.split(" ")[0] || "User"}!
        </h1>
        <p className="text-gray-600 text-lg">
          Here&apos;s what&apos;s happening with your contacts today
        </p>
      </div>

      {/* Stats Grid - Pass prefetched stats to avoid loading state */}
      <DashboardStatsCards userId={userId} initialStats={initialStats} />

      {/* Touchpoints Section - Only dynamic data is suspended */}
      <DashboardTouchpoints userId={userId} />

      {/* Charts Section - Pass prefetched stats to avoid loading state */}
      <DashboardCharts userId={userId} initialStats={initialStats} />
    </div>
  );
}

