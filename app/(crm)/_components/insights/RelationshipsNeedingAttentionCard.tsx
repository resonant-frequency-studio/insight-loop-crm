"use client";

import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { getRelationshipsNeedingAttention } from "@/lib/insights/insight-utils";

interface RelationshipsNeedingAttentionCardProps {
  contacts: Contact[];
}

export default function RelationshipsNeedingAttentionCard({
  contacts,
}: RelationshipsNeedingAttentionCardProps) {
  const router = useRouter();
  const { count, breakdown } = getRelationshipsNeedingAttention(contacts);

  const handleClick = () => {
    router.push("/contacts?filter=needs-attention");
  };

  if (count === 0) {
    return (
      <Card padding="md" hover={false}>
        <div className="text-center py-4">
          <h3 className="text-lg font-semibold text-theme-darkest mb-2">
            Relationships to Revisit
          </h3>
          <p className="text-theme-dark">
            All active relationships are in good shape.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div onClick={handleClick} className="cursor-pointer">
      <Card padding="md" hover={true}>
        <div>
          <h3 className="text-lg font-semibold text-theme-darkest mb-2">
            Relationships to Revisit
          </h3>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-semibold text-theme-darkest">{count}</span>
            <span className="text-base text-theme-dark">
              {count === 1 ? "relationship" : "relationships"} worth revisiting
            </span>
          </div>
          {breakdown && (
            <p className="text-xs text-theme-dark mb-3">
              {breakdown.lowEngagement > 0 && `${breakdown.lowEngagement} quiet relationships`}
              {breakdown.lowEngagement > 0 && breakdown.overdueTouchpoint > 0 && " • "}
              {breakdown.overdueTouchpoint > 0 && `${breakdown.overdueTouchpoint} with scheduled touchpoints`}
              {((breakdown.lowEngagement > 0 || breakdown.overdueTouchpoint > 0) && breakdown.negativeSentiment > 0) && " • "}
              {breakdown.negativeSentiment > 0 && `${breakdown.negativeSentiment} conversations that may need care`}
            </p>
          )}
          <p className="text-sm text-theme-dark mb-2">
            These relationships may benefit from your attention based on recent activity.
          </p>
          <p className="text-xs text-theme-dark italic">
            Review relationships
          </p>
        </div>
      </Card>
    </div>
  );
}

