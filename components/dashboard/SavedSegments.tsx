"use client";

import { usePipelineCounts } from "@/hooks/usePipelineCounts";
import Card from "@/components/Card";
import Link from "next/link";

interface SavedSegmentsProps {
  userId: string;
}

export default function SavedSegments({ userId }: SavedSegmentsProps) {
  const { data: counts, isLoading } = usePipelineCounts(userId);

  if (isLoading || !counts) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-theme-darkest mb-4">Saved Segments</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  // Get top 3 segments by count
  const topSegments = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (topSegments.length === 0) {
    return null; // Don't show if no segments
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-theme-darkest mb-4">Saved Segments</h3>
      <div className="space-y-2">
        {topSegments.map(([segment, count]) => (
          <Link
            key={segment}
            href={`/contacts?segment=${encodeURIComponent(segment)}`}
            className="block p-3 rounded-sm border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-theme-darkest">{segment}</span>
              <span className="text-sm text-theme-dark">({count})</span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

