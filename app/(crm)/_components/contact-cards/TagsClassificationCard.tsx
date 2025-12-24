"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import InfoPopover from "@/components/InfoPopover";
import SegmentSelect from "../SegmentSelect";
import { reportException } from "@/lib/error-reporting";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import Input from "@/components/Input";
import SavingIndicator from "@/components/contacts/SavingIndicator";

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
  const { schedule, flush } = useDebouncedAutosave();
  
  const prevContactIdRef = useRef<string | null>(null);
  const lastSavedValuesRef = useRef<{ tags: string[]; segment: string | null; leadSource: string } | null>(null);
  
  // Initialize form state from contact using lazy initialization
  const [tagsInput, setTagsInput] = useState<string>(""); // Raw input string for free typing
  const [tags, setTags] = useState<string[]>([]); // Parsed tags array
  const [segment, setSegment] = useState<string | null>(null);
  const [leadSource, setLeadSource] = useState<string>("");
  
  // Use refs to store current values so save function always reads latest state
  const tagsRef = useRef<string[]>(tags);
  const segmentRef = useRef<string | null>(segment);
  const leadSourceRef = useRef<string>(leadSource);
  
  // Keep refs in sync with state
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);
  
  useEffect(() => {
    segmentRef.current = segment;
  }, [segment]);
  
  useEffect(() => {
    leadSourceRef.current = leadSource;
  }, [leadSource]);
  
  // Reset form state only when contactId changes (switching to a different contact)
  // Don't reset when contact data updates from our own save
  useEffect(() => {
    if (!contact) return;
    
    // Only reset if we're switching to a different contact
    if (prevContactIdRef.current !== contact.contactId) {
      prevContactIdRef.current = contact.contactId;
      lastSavedValuesRef.current = null; // Clear saved values when switching contacts
      // Batch state updates to avoid cascading renders
      const contactTags = contact.tags ?? [];
      setTags(contactTags);
      setTagsInput(contactTags.join(", ")); // Initialize input with tags joined by comma
      setSegment(contact.segment ?? null);
      setLeadSource(contact.leadSource ?? "");
      return;
    }
    
    // If contact data updated but it matches what we just saved, don't reset
    if (lastSavedValuesRef.current) {
      const saved = lastSavedValuesRef.current;
      const contactTags = contact.tags ?? [];
      const contactMatchesSaved = 
        JSON.stringify(contactTags.sort()) === JSON.stringify(saved.tags.sort()) &&
        (contact.segment ?? null) === saved.segment &&
        (contact.leadSource ?? "") === saved.leadSource;
      
      if (contactMatchesSaved) {
        // This update came from our save, don't reset form
        return;
      }
    }
    
    // Only update if form values match the old contact values (user hasn't made changes)
    const formMatchesOldContact = 
      JSON.stringify(tags.sort()) === JSON.stringify((contact.tags ?? []).sort()) &&
      segment === (contact.segment ?? null) &&
      leadSource === (contact.leadSource ?? "");
    
    if (formMatchesOldContact) {
      // Form hasn't been edited, safe to update from contact
      const contactTags = contact.tags ?? [];
      setTags(contactTags);
      setTagsInput(contactTags.join(", "));
      setSegment(contact.segment ?? null);
      setLeadSource(contact.leadSource ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId, contact?.tags, contact?.segment, contact?.leadSource]);

  // Save function for autosave - reads from refs to always get latest values
  const saveTags = useMemo(() => {
    return async () => {
      if (!contact) return;
      
      // Read current form values from refs (always latest, even if scheduled before state update)
      const currentTags = tagsRef.current.length > 0 ? tagsRef.current : [];
      const currentSegment = segmentRef.current || null;
      const currentLeadSource = leadSourceRef.current || null;
      
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(
          {
            contactId,
            updates: {
              tags: currentTags,
              segment: currentSegment,
              leadSource: currentLeadSource,
            },
          },
          {
            onSuccess: () => {
              // Remember what we saved so we don't reset form when contact refetches
              lastSavedValuesRef.current = {
                tags: currentTags,
                segment: currentSegment,
                leadSource: currentLeadSource ?? "",
              };
              resolve();
            },
            onError: (error) => {
              reportException(error, {
                context: "Saving tags & classification in TagsClassificationCard",
                tags: { component: "TagsClassificationCard", contactId },
              });
              reject(error);
            },
          }
        );
      });
    };
  }, [contact, contactId, updateMutation]);

  // Parse tags input string into tags array
  const parseTags = (input: string): string[] => {
    return input.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const handleTagsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagsInput(value); // Allow free typing
    const parsedTags = parseTags(value);
    setTags(parsedTags); // Update tags array for comparison
    schedule("tags", saveTags);
  };

  const handleTagsBlur = () => {
    // Normalize the input on blur (remove extra spaces, etc.)
    const normalized = tags.join(", ");
    setTagsInput(normalized);
    flush("tags");
  };

  const handleSegmentChange = (value: string | null) => {
    setSegment(value);
    schedule("tags", saveTags);
  };

  const handleLeadSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLeadSource(e.target.value);
    schedule("tags", saveTags);
  };

  const handleLeadSourceBlur = () => {
    flush("tags");
  };

  if (!contact) {
    return (
      <Card padding="md">
        <Skeleton height="h-48" width="w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md" className="relative">
      <SavingIndicator cardKey="tags" />
      <div className="mb-2">
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
            <SegmentSelect
              value={segment}
              onChange={handleSegmentChange}
              existingSegments={uniqueSegments}
              placeholder="Enter or select segment..."
            />
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
              onChange={handleLeadSourceChange}
              onBlur={handleLeadSourceBlur}
              placeholder="Enter lead source..."
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

