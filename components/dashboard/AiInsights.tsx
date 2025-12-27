"use client";

import { useAiInsights } from "@/hooks/useAiInsights";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import Card from "@/components/Card";
import Link from "next/link";
import { Button } from "@/components/Button";
import EmptyState from "@/components/dashboard/EmptyState";
import Skeleton from "@/components/Skeleton";

interface AiInsightsProps {
  userId: string;
}

export default function AiInsights({ userId }: AiInsightsProps) {
  const { data: insights, isLoading, isError } = useAiInsights(userId);
  const { data: stats, isLoading: statsLoading } = useDashboardStats(userId);

  const showSkeletons = isLoading || statsLoading || !stats;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="w-5 h-5 text-purple-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-theme-darkest">AI Insights</h3>
      </div>

      {/* Show skeleton loaders while loading */}
      {showSkeletons && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton variant="text" width="w-3/4" />
              <Skeleton variant="text" width="w-full" height="h-3" />
              <Skeleton variant="text" width="w-2/3" height="h-3" />
            </div>
          ))}
        </div>
      )}

      {/* Show empty state when no contacts */}
      {!showSkeletons && stats && stats.totalContacts === 0 && (
        <EmptyState
          message="No insights yet"
          description="Import contacts to get AI-powered insights"
          showActions={false}
          wrapInCard={false}
          size="sm"
        />
      )}

      {isError && (
        <p className="text-sm text-red-600">Unable to load insights. Try again later.</p>
      )}

      {!showSkeletons && !isError && stats && stats.totalContacts > 0 && (!insights || insights.length === 0) && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 mb-2">🎉</p>
          <p className="text-sm text-gray-500">You&apos;re all caught up!</p>
          <p className="text-xs text-gray-400 mt-1">No insights at the moment.</p>
        </div>
      )}

      {!showSkeletons && !isError && stats && stats.totalContacts > 0 && insights && insights.length > 0 && (
        <div className="space-y-4">
          {insights.slice(0, 3).map((insight) => (
            <div key={insight.id} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
              <h4 className="font-semibold text-theme-darkest text-sm mb-1">{insight.title}</h4>
              <p className="text-xs text-theme-dark mb-2">{insight.description}</p>
              <Link href={insight.actionHref}>
                <Button size="sm" variant="outline" className="text-xs">
                  View
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

