"use client";

import { useAuth } from "@/hooks/useAuth";
import DashboardStatsCards from "./_components/DashboardStatsCards";
import DashboardCharts from "./_components/DashboardCharts";
import DashboardTouchpoints from "./_components/DashboardTouchpoints";

interface DashboardPageClientProps {
  userId: string;
}

export default function DashboardPageClient({ userId }: DashboardPageClientProps) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Header Section - Static, renders immediately */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Welcome back, {user.displayName?.split(" ")[0] || "User"}!
        </h1>
        <p className="text-gray-600 text-lg">
          Here&apos;s what&apos;s happening with your contacts today
        </p>
      </div>

      {/* Stats Grid - Only dynamic data is suspended */}
      <DashboardStatsCards userId={userId} />

      {/* Touchpoints Section - Only dynamic data is suspended */}
      <DashboardTouchpoints userId={userId} />

      {/* Charts Section - Only dynamic data is suspended */}
      <DashboardCharts userId={userId} />
    </div>
  );
}

