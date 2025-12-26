"use client";

import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { getAtRiskContacts, getHighMomentumContacts, getNegativeSentimentContacts } from "@/lib/insights/insight-utils";
import { isWithinPrimaryWindow, toDate } from "@/lib/dashboard/time-windows";

interface CoachingSignalsProps {
  contacts: Contact[];
}

/**
 * Coaching Signals (formerly AI Insights) for Dashboard
 * Shows gentle nudges with coaching tone
 * Only includes contacts within the 30-day window
 */
export default function CoachingSignals({ contacts }: CoachingSignalsProps) {
  const router = useRouter();

  // Filter contacts to only include those within the 30-day window
  const recentContacts = contacts.filter((contact) => {
    const lastEmail = toDate(contact.lastEmailDate);
    return isWithinPrimaryWindow(lastEmail);
  });

  const quietRelationships = getAtRiskContacts(recentContacts).slice(0, 12);
  const positiveMomentum = getHighMomentumContacts(recentContacts).slice(0, 12);
  const conversationsNeedingCare = getNegativeSentimentContacts(recentContacts).slice(0, 12);

  const hasSignals = quietRelationships.length > 0 || positiveMomentum.length > 0 || conversationsNeedingCare.length > 0;

  if (!hasSignals) {
    return (
      <Card className="p-4">
        <h3 className="text-base font-semibold text-theme-darkest mb-2">
          Gentle Nudges
        </h3>
        <p className="text-sm text-theme-dark">
          Everything looks good this week.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-base font-semibold text-theme-darkest mb-1">
        Gentle Nudges
      </h3>
      <p className="text-xs text-theme-dark mb-4 italic">
        Opportunities worth revisiting while energy is high.
      </p>
      <div className="space-y-4">
        {quietRelationships.length > 0 && (
          <div>
            <p className="text-sm text-theme-darkest mb-2">
              A few relationships may be ready for a check-in.
            </p>
            <p className="text-xs text-theme-dark mb-2">
              {quietRelationships.length} {quietRelationships.length === 1 ? "relationship" : "relationships"} showing low engagement.
            </p>
            <Button
              onClick={() => router.push("/contacts?engagement=low")}
              variant="outline"
              size="xs"
            >
              Review
            </Button>
          </div>
        )}

        {positiveMomentum.length > 0 && (
          <div className="border-t border-theme-lighter pt-4">
            <p className="text-sm text-theme-darkest mb-2">
              Some relationships are showing positive momentum.
            </p>
            <p className="text-xs text-theme-dark mb-2">
              A good moment to follow up while energy is high.
            </p>
            <Button
              onClick={() => router.push("/contacts?engagement=high")}
              variant="outline"
              size="xs"
            >
              Review
            </Button>
          </div>
        )}

        {conversationsNeedingCare.length > 0 && (
          <div className="border-t border-theme-lighter pt-4">
            <p className="text-sm text-theme-darkest mb-2">
              A few conversations may need care.
            </p>
            <p className="text-xs text-theme-dark mb-2">
              {conversationsNeedingCare.length} {conversationsNeedingCare.length === 1 ? "conversation" : "conversations"} with recent negative sentiment.
            </p>
            <Button
              onClick={() => router.push("/contacts?sentiment=negative")}
              variant="outline"
              size="xs"
            >
              Review
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

