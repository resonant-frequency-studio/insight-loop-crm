"use client";

import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { getTagCoverageGaps } from "@/lib/insights/insight-utils";

interface TagCoverageCardProps {
  contacts: Contact[];
}

export default function TagCoverageCard({
  contacts,
}: TagCoverageCardProps) {
  const router = useRouter();
  const gaps = getTagCoverageGaps(contacts);

  const handleApplyTag = (tagName: string) => {
    const encodedTag = encodeURIComponent(tagName);
    router.push(`/contacts?tagsMissing=${encodedTag}`);
  };

  if (gaps.length === 0) {
    return (
      <Card padding="md">
      <h3 className="text-base font-medium text-theme-darkest mb-2 opacity-80">
        Optional Tag Suggestions
      </h3>
      <p className="text-sm text-theme-dark opacity-70">
        No tag suggestions at this time.
      </p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h3 className="text-base font-medium text-theme-darkest mb-2 opacity-80">
        Optional Tag Suggestions
      </h3>
      <p className="text-xs text-theme-dark mb-4 opacity-70 italic">
        These are optional and meant to support reflection, not maintenance work.
      </p>
      <div className="space-y-3">
        {gaps.map((gap) => (
          <div
            key={gap.tag}
            className="flex items-center justify-between p-2 bg-card-highlight-light rounded-sm"
          >
            <div className="flex-1">
              <span className="text-sm font-medium text-theme-darkest">
                {gap.tag}
              </span>
              <span className="text-sm text-theme-dark ml-2">
                — applied to {Math.round(gap.percentage)}% of contacts
              </span>
            </div>
            <Button
              onClick={() => handleApplyTag(gap.tag)}
              variant="outline"
              size="xs"
              className="opacity-70"
            >
              Review
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

