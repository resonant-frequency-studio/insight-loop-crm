"use client";

import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { getMissingLeadSourceCount } from "@/lib/insights/insight-utils";

interface MissingLeadSourceCardProps {
  contacts: Contact[];
}

export default function MissingLeadSourceCard({
  contacts,
}: MissingLeadSourceCardProps) {
  const router = useRouter();
  const { count, percentage } = getMissingLeadSourceCount(contacts);

  const handleReview = () => {
    router.push("/contacts?leadSource=missing");
  };

  if (count === 0) {
    return (
      <Card padding="md">
      <h3 className="text-base font-medium text-theme-darkest mb-2 opacity-80">
        Missing Context
      </h3>
      <p className="text-sm text-theme-dark">All active contacts have lead sources.</p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h3 className="text-base font-medium text-theme-darkest mb-2 opacity-80">
        Missing Context
      </h3>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-semibold text-theme-darkest opacity-80">{count}</span>
        <span className="text-sm text-theme-dark opacity-70">
          active contacts without lead source ({percentage}%)
        </span>
      </div>
      <p className="text-xs text-theme-dark mb-4 opacity-70">
        Could be helpful to review for better attribution
      </p>
      <Button onClick={handleReview} variant="outline" size="xs">
        Review
      </Button>
    </Card>
  );
}

