"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Contact } from "@/types/firestore";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { getAtRiskContacts, getHighMomentumContacts } from "@/lib/insights/insight-utils";
import { formatContactDate } from "@/util/contact-utils";
import { getDisplayName } from "@/util/contact-utils";

interface EngagementInsightsCardProps {
  contacts: Contact[];
}

function toDate(date: unknown | null): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === "string") {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof date === "object" && "toDate" in date) {
    return (date as { toDate: () => Date }).toDate();
  }
  if (typeof date === "object" && date !== null && "seconds" in date) {
    const ts = date as { seconds: number; nanoseconds?: number };
    return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
  }
  if (typeof date === "object" && date !== null && "_seconds" in date) {
    const ts = date as { _seconds: number; _nanoseconds?: number };
    return new Date(ts._seconds * 1000 + (ts._nanoseconds || 0) / 1000000);
  }
  return null;
}

export default function EngagementInsightsCard({
  contacts,
}: EngagementInsightsCardProps) {
  const router = useRouter();
  const atRisk = getAtRiskContacts(contacts).slice(0, 5);
  const highMomentum = getHighMomentumContacts(contacts).slice(0, 5);

  const handleViewAllAtRisk = () => {
    // Use engagement=low only - date range will be set to 90 days automatically
    // filter=at-risk requires contacts > 90 days old, which doesn't match insights page
    router.push("/contacts?engagement=low");
  };

  const handleViewAllMomentum = () => {
    // Use engagement=high only - date range will be set to 90 days automatically
    // This matches the insights page which shows high engagement contacts from last 90 days
    router.push("/contacts?engagement=high");
  };

  return (
    <div className="xl:col-span-2">
      <Card padding="md">
        <h3 className="text-lg font-semibold text-theme-darkest mb-4">
          Relationship Activity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quiet Relationships */}
          <div>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-base font-medium text-theme-darkest mb-1">
                  Quiet Relationships
                </h4>
                <p className="text-xs text-theme-dark italic">
                  Where connection has slowed
                </p>
              </div>
              {atRisk.length > 0 && (
                <Button
                  onClick={handleViewAllAtRisk}
                  variant="outline"
                  size="xs"
                  className="shrink-0"
                >
                  View contacts
                </Button>
              )}
            </div>
            {atRisk.length === 0 ? (
              <p className="text-sm text-theme-dark">No quiet relationships in recent activity</p>
            ) : (
              <div className="space-y-3">
                {atRisk.map((contact) => {
                  const lastEmail = toDate(contact.lastEmailDate);
                  const lastInteraction = lastEmail
                    ? formatContactDate(contact.lastEmailDate, { relative: true })
                    : "Never";
                  return (
                    <div
                      key={contact.contactId}
                      className="flex items-center justify-between p-2 bg-card-highlight-light rounded-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/contacts/${encodeURIComponent(contact.contactId)}`}
                          className="text-sm font-medium text-theme-darkest hover:underline block truncate"
                        >
                          {getDisplayName(contact)}
                        </Link>
                        <p className="text-xs text-theme-dark">
                          {lastEmail ? `Last interaction: ${lastInteraction}` : "No recent interaction (outside insight window)"}
                        </p>
                      </div>
                      <Link
                        href={`/contacts/${encodeURIComponent(contact.contactId)}`}
                      >
                        <Button variant="outline" size="xs">
                          Review
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* High Momentum Relationships */}
          <div className="md:border-l md:border-theme-lighter md:pl-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-base font-medium text-theme-darkest mb-1">
                  Positive Momentum
                </h4>
                <p className="text-xs text-theme-dark italic">
                  Where connection is growing
                </p>
              </div>
              {highMomentum.length > 0 && (
                <Button
                  onClick={handleViewAllMomentum}
                  variant="outline"
                  size="xs"
                  className="shrink-0"
                >
                  View contacts
                </Button>
              )}
            </div>
            {highMomentum.length === 0 ? (
              <p className="text-sm text-theme-dark">
                No high momentum relationships
              </p>
            ) : (
              <div className="space-y-3">
                {highMomentum.map((contact) => {
                  return (
                    <div
                      key={contact.contactId}
                      className="flex items-center justify-between p-2 bg-card-highlight-light rounded-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/contacts/${encodeURIComponent(contact.contactId)}`}
                          className="text-sm font-medium text-theme-darkest hover:underline block truncate"
                        >
                          {getDisplayName(contact)}
                        </Link>
                        <p className="text-xs text-theme-dark mt-1">
                          Strong recent engagement
                        </p>
                      </div>
                      <Link
                        href={`/contacts/${encodeURIComponent(contact.contactId)}`}
                      >
                        <Button variant="outline" size="xs">
                          Review
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

