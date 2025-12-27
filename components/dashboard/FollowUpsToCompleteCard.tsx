"use client";

import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { toDate, getPrimaryWindowStart } from "@/lib/dashboard/time-windows";

interface FollowUpsToCompleteCardProps {
  contacts: Contact[];
}

/**
 * Follow-ups to Complete card for Dashboard Zone A (Suggested Focus)
 * Shows overdue touchpoints count
 * Only includes touchpoints within the 30-day window
 */
export default function FollowUpsToCompleteCard({
  contacts,
}: FollowUpsToCompleteCardProps) {
  const router = useRouter();
  const now = new Date();
  const thirtyDaysAgo = getPrimaryWindowStart();

  const overdueCount = contacts.filter((contact) => {
    if (contact.archived) return false;
    const touchpointDate = toDate(contact.nextTouchpointDate);
    if (!touchpointDate) return false;
    const status = contact.touchpointStatus;
    if (status === "completed" || status === "cancelled") return false;
    // Only show overdue touchpoints within the last 30 days
    return touchpointDate < now && touchpointDate >= thirtyDaysAgo;
  }).length;

  const handleClick = () => {
    router.push("/touchpoints/overdue");
  };

  if (overdueCount === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-base font-semibold text-theme-darkest mb-2">
          Follow-ups to Finish
        </h3>
        <p className="text-sm text-theme-dark">
          All follow-ups are up to date.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
        <h3 className="text-base font-semibold text-theme-darkest mb-1">
          Follow-ups to Finish
        </h3>
      <p className="text-xs text-theme-dark mb-3 italic">
        A few touchpoints are waiting—finishing one or two can create momentum.
      </p>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-semibold text-theme-darkest">{overdueCount}</span>
        <span className="text-sm text-theme-dark">
          {overdueCount === 1 ? "follow-up" : "follow-ups"} waiting
        </span>
      </div>
      <Button onClick={handleClick} variant="outline" size="sm" className="w-full">
        View overdue
      </Button>
    </Card>
  );
}

