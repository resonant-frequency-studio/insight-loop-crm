"use client";

import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { getRelationshipsNeedingAttention, getAtRiskContacts, getHighMomentumContacts, getNegativeSentimentContacts } from "@/lib/insights/insight-utils";
import { isWithinPrimaryWindow, toDate } from "@/lib/dashboard/time-windows";

interface SuggestedFocusCardProps {
  contacts: Contact[];
}

/**
 * Unified Suggested Focus card for Dashboard
 * Combines relationships to revisit, conversations needing care, and positive momentum
 * Only includes contacts within the 30-day window
 */
export default function SuggestedFocusCard({
  contacts,
}: SuggestedFocusCardProps) {
  const router = useRouter();

  // Filter contacts to only include those within the 30-day window
  const recentContacts = contacts.filter((contact) => {
    const lastEmail = toDate(contact.lastEmailDate);
    return isWithinPrimaryWindow(lastEmail);
  });

  const { count } = getRelationshipsNeedingAttention(recentContacts);
  const quietRelationships = getAtRiskContacts(recentContacts).slice(0, 12);
  const positiveMomentum = getHighMomentumContacts(recentContacts).slice(0, 12);
  const conversationsNeedingCare = getNegativeSentimentContacts(recentContacts).slice(0, 12);

  const hasAnyInsights = count > 0 || quietRelationships.length > 0 || positiveMomentum.length > 0 || conversationsNeedingCare.length > 0;

  if (!hasAnyInsights) {
    return (
      <Card className="p-4">
        <h3 className="text-base font-semibold text-theme-darkest mb-2">
          Suggested Focus
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
        Suggested Focus
      </h3>
      <p className="text-xs text-theme-dark mb-4 italic">
        A small set of people who may benefit from a thoughtful check-in.
      </p>

      {/* Summary with count */}
      {count > 0 && (
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-semibold text-theme-darkest">{count}</span>
          <span className="text-sm text-theme-dark">
            {count === 1 ? "relationship" : "relationships"} worth revisiting
          </span>
        </div>
      )}

      {/* Bullet-style insight rows */}
      <div className="space-y-2 mb-4">
        {quietRelationships.length > 0 && (
          <div className="text-xs text-theme-dark">
            <span className="font-medium">{quietRelationships.length}</span> quiet relationships may be ready for a check-in
          </div>
        )}
        {conversationsNeedingCare.length > 0 && (
          <div className="text-xs text-theme-dark">
            <span className="font-medium">{conversationsNeedingCare.length}</span> {conversationsNeedingCare.length === 1 ? "conversation" : "conversations"} may need care
          </div>
        )}
        {positiveMomentum.length > 0 && (
          <div className="text-xs text-theme-dark opacity-70">
            <span className="font-medium">{positiveMomentum.length}</span> {positiveMomentum.length === 1 ? "relationship" : "relationships"} showing positive momentum
          </div>
        )}
      </div>

      {/* Single primary CTA */}
      <Button 
        onClick={() => router.push("/contacts?filter=needs-attention")} 
        variant="outline" 
        size="sm" 
        className="w-full"
      >
        Review relationships
      </Button>
    </Card>
  );
}

