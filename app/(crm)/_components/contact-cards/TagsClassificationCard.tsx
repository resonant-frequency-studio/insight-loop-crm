"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import Card from "@/components/Card";
import InfoPopover from "@/components/InfoPopover";
import SavingIndicator from "./SavingIndicator";
import SegmentSelect from "../SegmentSelect";
import { reportException } from "@/lib/error-reporting";
import { useSavingState } from "@/contexts/SavingStateContext";
import Input from "@/components/Input";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface TagsClassificationCardProps {
  contactId: string;
  userId: string;
  uniqueSegments?: string[];
}

export default function TagsClassificationCard({
  contactId,
  userId,
  uniqueSegments = [],
}: TagsClassificationCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const updateMutation = useUpdateContact(userId);
  const { registerSaveStatus, unregisterSaveStatus } = useSavingState();
  const cardId = `tags-classification-${contactId}`;
  
  const prevContactIdRef = useRef<string | null>(null);
  
  // Initialize form state from contact using lazy initialization
  const [tagsInput, setTagsInput] = useState<string>(""); // Raw input string for free typing
  const [tags, setTags] = useState<string[]>([]); // Parsed tags array
  const [segment, setSegment] = useState<string | null>(null);
  const [leadSource, setLeadSource] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  
  // Register/unregister save status with context
  useEffect(() => {
    registerSaveStatus(cardId, saveStatus);
    return () => {
      unregisterSaveStatus(cardId);
    };
  }, [saveStatus, cardId, registerSaveStatus, unregisterSaveStatus]);
  
  // Reset form state when contactId changes (different contact loaded)
  // Using contactId prop as dependency ensures we only update when switching contacts
  useEffect(() => {
    if (!contact) return;
    if (prevContactIdRef.current !== contact.contactId) {
      prevContactIdRef.current = contact.contactId;
      // Batch state updates to avoid cascading renders
      const contactTags = contact.tags ?? [];
      setTags(contactTags);
      setTagsInput(contactTags.join(", ")); // Initialize input with tags joined by comma
      setSegment(contact.segment ?? null);
      setLeadSource(contact.leadSource ?? "");
      setSaveStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId]);

  // Track changes using useMemo instead of useEffect
  const hasUnsavedChanges = useMemo(() => {
    if (!contact) return false;
    const tagsChanged =
      JSON.stringify([...tags].sort()) !== JSON.stringify([...(contact.tags ?? [])].sort());
    const segmentChanged = segment !== (contact.segment ?? null);
    const leadSourceChanged = leadSource !== (contact.leadSource ?? "");
    return tagsChanged || segmentChanged || leadSourceChanged;
  }, [tags, segment, leadSource, contact]);

  const saveChanges = () => {
    if (!hasUnsavedChanges || !contact) return;

    setSaveStatus("saving");
    updateMutation.mutate(
      {
        contactId,
        updates: {
          tags: tags.length > 0 ? tags : [],
          segment: segment || null,
          leadSource: leadSource || null,
        },
      },
      {
        onSuccess: () => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        },
        onError: (error) => {
          setSaveStatus("error");
          reportException(error, {
            context: "Saving tags & classification in TagsClassificationCard",
            tags: { component: "TagsClassificationCard", contactId },
          });
          setTimeout(() => setSaveStatus("idle"), 3000);
        },
      }
    );
  };

  const debouncedSave = useDebouncedSave(saveChanges, 500);

  // Parse tags input string into tags array
  const parseTags = (input: string): string[] => {
    return input.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const handleTagsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagsInput(value); // Allow free typing
    const parsedTags = parseTags(value);
    setTags(parsedTags); // Update tags array for comparison
  };

  const handleTagsBlur = () => {
    // Normalize the input on blur (remove extra spaces, etc.)
    const normalized = tags.join(", ");
    setTagsInput(normalized);
    if (hasUnsavedChanges) {
      debouncedSave();
    }
  };

  const handleBlur = () => {
    if (hasUnsavedChanges) {
      debouncedSave();
    }
  };

  if (!contact) {
    return (
      <Card padding="md">
        <div className="h-48 bg-gray-200 rounded animate-pulse" />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-theme-darkest flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          Tags & Classification
        </h2>
        <SavingIndicator status={saveStatus} />
      </div>
      <p className="text-sm text-theme-dark mb-4">
        Organize and categorize your contacts using tags, segments, and lead sources to better track relationships and tailor your communication strategies.
      </p>
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-theme-darker mb-2">
            Tags
            <InfoPopover content="Tags are labels you can assign to contacts to organize and categorize them. Use tags to group contacts by characteristics like industry, role, project, or any custom classification that helps you manage your relationships." />
          </label>
          <Input
            id="contact-tags"
            name="contact-tags"
            value={tagsInput}
            onChange={handleTagsInputChange}
            onBlur={handleTagsBlur}
            placeholder="tag1, tag2, tag3"
          />
          <p className="mt-2 text-xs text-theme-dark">
            Enter tags separated by commas. Spaces within tags are allowed (e.g., &quot;School of Hard Knocks, Referral, VIP&quot;).
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-theme-darker mb-2">
              Segment
              <InfoPopover content="A segment categorizes contacts into distinct groups based on shared characteristics such as company size, industry, customer type, or market segment. This helps you tailor your communication and sales strategies to different groups." />
            </label>
            <div onBlur={handleBlur}>
              <SegmentSelect
                value={segment}
                onChange={(value) => setSegment(value)}
                existingSegments={uniqueSegments}
                placeholder="Enter or select segment..."
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-theme-darker mb-2">
              Lead Source
              <InfoPopover content="The original source or channel where this contact was first acquired. This helps track which marketing channels or referral sources are most effective for your business." />
            </label>
            <Input
              type="text"
              id="contact-lead-source"
              name="contact-lead-source"
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              onBlur={handleBlur}
              placeholder="Enter lead source..."
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

