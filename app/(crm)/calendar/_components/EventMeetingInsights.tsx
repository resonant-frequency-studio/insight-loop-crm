"use client";

import { CalendarEvent, Contact } from "@/types/firestore";
import { EventContext } from "@/hooks/useCalendarEvents";
import { useState, useEffect, useMemo } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { Button } from "@/components/Button";
import { useCreateActionItem } from "@/hooks/useActionItemMutations";
import { formatContactDate } from "@/util/contact-utils";
import { reportException } from "@/lib/error-reporting";

interface EventMeetingInsightsProps {
  event: CalendarEvent;
  linkedContact: Contact | null;
  storedInsights: CalendarEvent["meetingInsights"] | null;
  aiContext: EventContext | null;
  isGenerating: boolean;
  error: Error | null;
  onGenerate: (regenerate: boolean) => void;
  onClose?: () => void; // Optional - may be used in future
}

export default function EventMeetingInsights({
  event,
  linkedContact,
  storedInsights,
  aiContext,
  isGenerating,
  error,
  onGenerate,
}: EventMeetingInsightsProps) {
  const createActionItemMutation = useCreateActionItem();
  const [hasExpanded, setHasExpanded] = useState(false);

  // Use stored insights if available, otherwise use aiContext from mutation
  const insights = useMemo(() => {
    if (storedInsights) {
      return {
        summary: storedInsights.summary,
        suggestedNextStep: storedInsights.suggestedNextStep,
        suggestedTouchpointDate: storedInsights.suggestedTouchpointDate,
        suggestedTouchpointRationale: storedInsights.suggestedTouchpointRationale,
        suggestedActionItems: storedInsights.suggestedActionItems,
        followUpEmailDraft: storedInsights.followUpEmailDraft,
      };
    }
    return aiContext;
  }, [storedInsights, aiContext]);

  // Auto-generate insights on mount if no stored insights exist
  useEffect(() => {
    if (!storedInsights && !insights && !isGenerating && !error) {
      onGenerate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleExpand = () => {
    if (!hasExpanded && !insights) {
      onGenerate(false);
    }
    setHasExpanded(true);
  };

  // Format last generated date
  const lastGeneratedText = useMemo(() => {
    if (storedInsights?.generatedAt) {
      return formatContactDate(storedInsights.generatedAt, { relative: true });
    }
    return null;
  }, [storedInsights?.generatedAt]);

  const handleSaveToNotes = async () => {
    if (!insights || !linkedContact) return;
    
    // Save summary to contact notes
    try {
      const response = await fetch(`/api/contacts/${linkedContact.contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notes: insights.summary,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save to notes");
      }

      // Show success feedback (could use toast here)
      alert("Saved to contact notes");
    } catch (error) {
      reportException(error, {
        context: "Saving meeting insights to contact notes",
        tags: { component: "EventMeetingInsights" },
      });
      alert("Failed to save to notes");
    }
  };

  const insightsIcon = (
    <svg
      className="w-5 h-5 text-theme-medium"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );

  return (
    <CollapsibleSection
      title="Meeting Insights"
      defaultExpanded={false}
      icon={insightsIcon}
      preview={insights ? "Summary & next steps available" : undefined}
    >
      <div>
        {isGenerating && (
          <div className="flex items-center gap-2 text-theme-dark text-sm py-4">
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Generating insights...</span>
          </div>
        )}
        {error && (
          <div className="space-y-2">
            <p className="text-error-red-text text-sm">
              {error.message || "Failed to generate insights"}
            </p>
            <Button
              onClick={() => onGenerate(false)}
              variant="outline"
              size="sm"
            >
              Retry
            </Button>
          </div>
        )}
        {insights && (
          <div className="space-y-4">
            {/* Summary - restructured as "What we discussed" */}
            <div>
              <h5 className="text-theme-darkest font-medium text-sm mb-1">What we discussed</h5>
              <p className="text-theme-dark text-sm whitespace-pre-line">
                {insights.summary}
              </p>
            </div>

            {/* Suggested Next Step */}
            <div>
              <h5 className="text-theme-darkest font-medium text-sm mb-1">Suggested next step</h5>
              <p className="text-theme-dark text-sm">
                {insights.suggestedNextStep}
              </p>
            </div>

            {/* Open loops - from suggested action items */}
            {insights.suggestedActionItems && insights.suggestedActionItems.length > 0 && (
              <div>
                <h5 className="text-theme-darkest font-medium text-sm mb-2">Open loops</h5>
                <ul className="list-disc list-inside space-y-1 mb-3">
                  {insights.suggestedActionItems.map((item: string, idx: number) => (
                    <li key={idx} className="text-theme-dark text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
                {event.matchedContactId && (
                  <div className="flex flex-wrap gap-2">
                    {insights.suggestedActionItems.map((item: string, idx: number) => (
                      <Button
                        key={idx}
                        onClick={() => {
                          if (event.matchedContactId) {
                            createActionItemMutation.mutate({
                              contactId: event.matchedContactId,
                              text: item,
                            });
                          }
                        }}
                        variant="outline"
                        size="sm"
                        disabled={!event.matchedContactId || createActionItemMutation.isPending}
                      >
                        Add &quot;{item.substring(0, 30)}{item.length > 30 ? "..." : ""}&quot;
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div 
              className="pt-3 space-y-2"
              style={{
                borderTop: '1px solid var(--divider)',
              }}
            >
              {linkedContact && (
                <Button
                  onClick={handleSaveToNotes}
                  variant="outline"
                  size="sm"
                  fullWidth
                >
                  Save to notes
                </Button>
              )}
            </div>

            <div 
              className="pt-3"
              style={{
                borderTop: '1px solid var(--divider)',
              }}
            >
              <Button
                onClick={() => onGenerate(true)}
                variant="outline"
                size="sm"
                disabled={isGenerating}
                fullWidth
              >
                Regenerate
              </Button>
              {lastGeneratedText && (
                <p 
                  className="text-xs mt-2 text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Last generated {lastGeneratedText}
                </p>
              )}
            </div>
          </div>
        )}
        {!insights && !isGenerating && !error && (
          <div className="text-center py-4">
            <Button
              onClick={handleExpand}
              variant="outline"
              size="sm"
            >
              Generate Insights
            </Button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

