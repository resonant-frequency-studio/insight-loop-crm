"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import Card from "@/components/Card";
import SavingIndicator from "./SavingIndicator";
import Input from "@/components/Input";
import { reportException } from "@/lib/error-reporting";
import { Contact } from "@/types/firestore";
import { useSavingState } from "@/contexts/SavingStateContext";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface BasicInfoCardProps {
  contactId: string;
  userId: string;
}

export default function BasicInfoCard({ contactId, userId }: BasicInfoCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const updateMutation = useUpdateContact(userId);
  const { registerSaveStatus, unregisterSaveStatus } = useSavingState();
  const cardId = `basic-info-${contactId}`;
  
  const prevContactIdRef = useRef<Contact | null>(null);
  
  // Initialize form state from contact using lazy initialization
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  
  // Register/unregister save status with context
  useEffect(() => {
    registerSaveStatus(cardId, saveStatus);
    return () => {
      unregisterSaveStatus(cardId);
    };
  }, [saveStatus, cardId, registerSaveStatus, unregisterSaveStatus]);
  
//   Reset form state when contactId changes (different contact loaded)
//   Using contactId prop as dependency ensures we only update when switching contacts
  useEffect(() => {
    if (!contact) return;
    if (prevContactIdRef.current !== contact) {
        prevContactIdRef.current = contact;
        // Batch state updates to avoid cascading renders
        setFirstName(contact.firstName ?? "");
        setLastName(contact.lastName ?? "");
        setCompany(contact.company ?? "");
        setSaveStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId, contact?.updatedAt]); // Only depend on contactId prop, not contact object

  // Track changes using useMemo instead of useEffect
  const hasChanges = useMemo(() => {
    if (!contact) return false;
    const firstNameChanged = firstName !== (contact.firstName ?? "");
    const lastNameChanged = lastName !== (contact.lastName ?? "");
    const companyChanged = company !== (contact.company ?? "");
    return firstNameChanged || lastNameChanged || companyChanged;
  }, [firstName, lastName, company, contact]);

  const saveChanges = () => {
    if (!hasChanges || !contact) return;

    setSaveStatus("saving");
    updateMutation.mutate(
      {
        contactId,
        updates: {
          firstName: firstName || null,
          lastName: lastName || null,
          company: company || null,
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
            context: "Saving basic info in BasicInfoCard",
            tags: { component: "BasicInfoCard", contactId },
          });
          setTimeout(() => setSaveStatus("idle"), 3000);
        },
      }
    );
  };

  const debouncedSave = useDebouncedSave(saveChanges, 500);

  const handleBlur = () => {
    if (hasChanges) {
      debouncedSave();
    }
  };

  if (!contact) {
    return (
      <Card padding="md">
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Basic Information
        </h2>
        <SavingIndicator status={saveStatus} />
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-theme-darker mb-2">
              First Name
            </label>
            <Input
              id="contact-first-name"
              name="contact-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={handleBlur}
              placeholder="First Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-darker mb-2">
              Last Name
            </label>
            <Input
              id="contact-last-name"
              name="contact-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={handleBlur}
              placeholder="Last Name"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-darker mb-2">
            Company
          </label>
          <Input
            id="contact-company"
            name="contact-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onBlur={handleBlur}
            placeholder="Company"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-darker mb-2">
            Email
          </label>
          <Input
            type="email"
            id="contact-email"
            name="contact-email"
            disabled
            className="bg-theme-lighter text-[#8d8a85] cursor-not-allowed"
            value={contact.primaryEmail}
          />
        </div>
      </div>
    </Card>
  );
}

