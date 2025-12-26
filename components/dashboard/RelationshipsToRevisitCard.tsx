"use client";

import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { getRelationshipsNeedingAttention } from "@/lib/insights/insight-utils";
import { isWithinPrimaryWindow, toDate } from "@/lib/dashboard/time-windows";

interface RelationshipsToRevisitCardProps {
  contacts: Contact[];
}

/**
 * Relationships to Revisit card for Dashboard Zone A (Suggested Focus)
 * Shows a small set of people who may benefit from a thoughtful check-in
 * Only includes contacts within the 30-day window
 */
export default function RelationshipsToRevisitCard({
  contacts,
}: RelationshipsToRevisitCardProps) {
  const router = useRouter();

  // Filter contacts to only include those within the 30-day window
  const recentContacts = contacts.filter((contact) => {
    const lastEmail = toDate(contact.lastEmailDate);
    return isWithinPrimaryWindow(lastEmail);
  });

  const { count, breakdown } = getRelationshipsNeedingAttention(recentContacts);

  const handleClick = () => {
    router.push("/contacts?filter=needs-attention");
  };

  if (count === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-base font-semibold text-theme-darkest mb-2">
          Relationships to Revisit
        </h3>
        <p className="text-sm text-theme-dark">
          All active relationships are thriving!
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-base font-semibold text-theme-darkest mb-1">
        Relationships to Revisit
      </h3>
      <p className="text-xs text-theme-dark mb-3 italic">
        A small set of people who may benefit from a thoughtful check-in.
      </p>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-semibold text-theme-darkest">{count}</span>
        <span className="text-sm text-theme-dark">
          {count === 1 ? "relationship" : "relationships"}
        </span>
      </div>
      {breakdown && (
        <div className="text-xs text-theme-dark mb-4 space-y-1">
          {breakdown.lowEngagement > 0 && (
            <p>
              <span className="font-medium">{breakdown.lowEngagement}</span> quiet relationships
            </p>
          )}
          {breakdown.overdueTouchpoint > 0 && (
            <p>
              <span className="font-medium">{breakdown.overdueTouchpoint}</span> with scheduled touchpoints
            </p>
          )}
          {breakdown.negativeSentiment > 0 && (
            <p>
              <span className="font-medium">{breakdown.negativeSentiment}</span> conversations that may need care
            </p>
          )}
        </div>
      )}
      <Button onClick={handleClick} variant="outline" size="sm" className="w-full">
        Review relationships
      </Button>
    </Card>
  );
}

