"use client";

import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { getSegmentCoverage } from "@/lib/insights/insight-utils";

interface SegmentCoverageCardProps {
  contacts: Contact[];
}

export default function SegmentCoverageCard({
  contacts,
}: SegmentCoverageCardProps) {
  const router = useRouter();
  const { topSegments, underrepresented } = getSegmentCoverage(contacts);

  const handleViewSegment = (segmentName: string) => {
    const encodedSegment = encodeURIComponent(segmentName);
    router.push(`/contacts?segment=${encodedSegment}`);
  };

  if (topSegments.length === 0) {
    return (
      <Card padding="md">
      <h3 className="text-base font-medium text-theme-darkest mb-2 opacity-80">
        Segment Overview
      </h3>
      <p className="text-sm text-theme-dark opacity-70">No segments assigned yet.</p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h3 className="text-base font-medium text-theme-darkest mb-4 opacity-80">
        Segment Overview
      </h3>
      <div className="space-y-4">
        {topSegments.length > 0 && (
          <div>
            <p className="text-sm font-medium text-theme-dark mb-2">
              Top Segments
            </p>
            <div className="space-y-2">
              {topSegments.map((segment) => (
                <div
                  key={segment.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-theme-darkest">
                    {segment.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-theme-dark">
                      {segment.count} ({Math.round(segment.percentage)}%)
                    </span>
                    <Button
                      onClick={() => handleViewSegment(segment.name)}
                      variant="outline"
                      size="xs"
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {underrepresented.length > 0 && (
          <div>
            <p className="text-sm font-medium text-theme-dark mb-2">
              Lightly used segment
            </p>
            <div className="space-y-2">
              {underrepresented.map((segment) => (
                <div
                  key={segment.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-theme-darkest">
                    {segment.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-theme-dark">
                      {segment.count} ({Math.round(segment.percentage)}%)
                    </span>
                    <Button
                      onClick={() => handleViewSegment(segment.name)}
                      variant="outline"
                      size="xs"
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

