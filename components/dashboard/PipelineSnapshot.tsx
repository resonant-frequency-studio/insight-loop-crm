"use client";

import { usePipelineCounts } from "@/hooks/usePipelineCounts";
import Card from "@/components/Card";
import Link from "next/link";

interface PipelineSnapshotProps {
  userId: string;
}

export default function PipelineSnapshot({ userId }: PipelineSnapshotProps) {
  const { data: counts, isLoading } = usePipelineCounts(userId);

  if (isLoading || !counts) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-theme-darkest mb-4">Pipeline Snapshot</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  // Get top 4 segments by count
  const topSegments = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  // Color mapping for segments
  const getSegmentColor = (index: number) => {
    const colors = [
      "bg-green-50 border-green-200 text-green-900",
      "bg-blue-50 border-blue-200 text-blue-900",
      "bg-yellow-50 border-yellow-200 text-yellow-900",
      "bg-red-50 border-red-200 text-red-900",
    ];
    return colors[index % colors.length];
  };

  if (topSegments.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-theme-darkest mb-4">Pipeline Snapshot</h3>
        <p className="text-sm text-gray-500">No segments found</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-theme-darkest mb-4">Pipeline Snapshot</h3>
      <div className="grid grid-cols-2 gap-3">
        {topSegments.map(([segment, count], index) => (
          <Link
            key={segment}
            href={`/contacts?segment=${encodeURIComponent(segment)}`}
            className={`p-3 rounded-md border-2 ${getSegmentColor(index)} hover:opacity-80 transition-opacity`}
          >
            <p className="text-xs font-medium mb-1 truncate">{segment}</p>
            <p className="text-2xl font-bold">{count.toLocaleString()}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}

