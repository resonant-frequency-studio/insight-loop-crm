"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import Input from "@/components/Input";
import { reportException } from "@/lib/error-reporting";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import SavingIndicator from "@/components/contacts/SavingIndicator";

interface BasicInfoCardProps {
  contactId: string;
  userId: string;
}

export default function BasicInfoCard({ contactId, userId }: BasicInfoCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const updateMutation = useUpdateContact(userId);
  const { schedule, flush } = useDebouncedAutosave();
  
  const prevContactIdRef = useRef<string | null>(null);
  const lastSavedValuesRef = useRef<{ firstName: string; lastName: string; company: string; secondaryEmails: string[] } | null>(null);
  
  // Initialize form state from contact using lazy initialization
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [secondaryEmails, setSecondaryEmails] = useState<string[]>([]);
  
  // Use refs to store current values so save function always reads latest state
  const firstNameRef = useRef(firstName);
  const lastNameRef = useRef(lastName);
  const companyRef = useRef(company);
  const secondaryEmailsRef = useRef(secondaryEmails);
  
  // Keep refs in sync with state
  useEffect(() => {
    firstNameRef.current = firstName;
  }, [firstName]);
  
  useEffect(() => {
    lastNameRef.current = lastName;
  }, [lastName]);
  
  useEffect(() => {
    companyRef.current = company;
  }, [company]);

  useEffect(() => {
    secondaryEmailsRef.current = secondaryEmails;
  }, [secondaryEmails]);
  
  // Reset form state only when contactId changes (switching to a different contact)
  // Don't reset when contact data updates from our own save
  useEffect(() => {
    if (!contact) return;
    
    // Only reset if we're switching to a different contact
    if (prevContactIdRef.current !== contact.contactId) {
      prevContactIdRef.current = contact.contactId;
      lastSavedValuesRef.current = null; // Clear saved values when switching contacts
      // Batch state updates to avoid cascading renders
      setFirstName(contact.firstName ?? "");
      setLastName(contact.lastName ?? "");
      setCompany(contact.company ?? "");
      setSecondaryEmails(contact.secondaryEmails ? [...contact.secondaryEmails] : []);
      return;
    }
    
    // Check if secondaryEmails changed (e.g., after a merge)
    // This is important because merges can add secondary emails without changing other fields
    const currentSecondaryEmailsStr = JSON.stringify([...secondaryEmails].sort());
    const contactSecondaryEmailsStr = JSON.stringify([...(contact.secondaryEmails || [])].sort());
    const secondaryEmailsChanged = currentSecondaryEmailsStr !== contactSecondaryEmailsStr;
    
    // Always update secondary emails if they changed (e.g., from a merge)
    // This ensures merged contacts show their secondary emails immediately, even if other fields match saved values
    if (secondaryEmailsChanged) {
      setSecondaryEmails(contact.secondaryEmails ? [...contact.secondaryEmails] : []);
      // Clear saved values so we don't prevent future updates
      lastSavedValuesRef.current = null;
    }
    
    // If contact data updated but it matches what we just saved, don't reset other fields
    if (lastSavedValuesRef.current) {
      const saved = lastSavedValuesRef.current;
      const contactMatchesSaved = 
        (contact.firstName ?? "") === saved.firstName &&
        (contact.lastName ?? "") === saved.lastName &&
        (contact.company ?? "") === saved.company &&
        JSON.stringify(contact.secondaryEmails || []) === JSON.stringify(saved.secondaryEmails);
      
      if (contactMatchesSaved) {
        // This update came from our save, don't reset form
        return;
      }
    }
    
    // Only update if form values match the old contact values (user hasn't made changes)
    // This prevents overwriting user input when contact refetches
    const formMatchesOldContact = 
      firstName === (contact.firstName ?? "") &&
      lastName === (contact.lastName ?? "") &&
      company === (contact.company ?? "");
    
    if (formMatchesOldContact) {
      // Form hasn't been edited, safe to update from contact
      setFirstName(contact.firstName ?? "");
      setLastName(contact.lastName ?? "");
      setCompany(contact.company ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId, contact?.firstName, contact?.lastName, contact?.company, contact?.secondaryEmails]);

  // Save function for autosave - reads from refs to always get latest values
  const saveBasicInfo = useMemo(() => {
    return async () => {
      if (!contact) return;
      
      // Read current form values from refs (always latest, even if scheduled before state update)
      const currentFirstName = firstNameRef.current || null;
      const currentLastName = lastNameRef.current || null;
      const currentCompany = companyRef.current || null;
      const currentSecondaryEmails = secondaryEmailsRef.current
        .map((email) => email.trim())
        .filter((email) => email !== "");
      
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(
          {
            contactId,
            updates: {
              firstName: currentFirstName,
              lastName: currentLastName,
              company: currentCompany,
              secondaryEmails: currentSecondaryEmails.length > 0 ? currentSecondaryEmails : undefined,
            },
          },
          {
            onSuccess: () => {
              // Remember what we saved so we don't reset form when contact refetches
              lastSavedValuesRef.current = {
                firstName: currentFirstName ?? "",
                lastName: currentLastName ?? "",
                company: currentCompany ?? "",
                secondaryEmails: currentSecondaryEmails,
              };
              resolve();
            },
            onError: (error) => {
              reportException(error, {
                context: "Saving basic info in BasicInfoCard",
                tags: { component: "BasicInfoCard", contactId },
              });
              reject(error);
            },
          }
        );
      });
    };
  }, [contact, contactId, updateMutation]);

  // Handle field changes with autosave
  // Schedule debounced save - refs ensure we always read latest values
  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    schedule("basic", saveBasicInfo);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
    schedule("basic", saveBasicInfo);
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompany(e.target.value);
    schedule("basic", saveBasicInfo);
  };

  const handleSecondaryEmailChange = (index: number, value: string) => {
    const newEmails = [...secondaryEmails];
    newEmails[index] = value;
    setSecondaryEmails(newEmails);
    schedule("basic", saveBasicInfo);
  };

  const handleAddSecondaryEmail = () => {
    setSecondaryEmails([...secondaryEmails, ""]);
  };

  const handleRemoveSecondaryEmail = (index: number) => {
    const newEmails = secondaryEmails.filter((_, i) => i !== index);
    setSecondaryEmails(newEmails);
    schedule("basic", saveBasicInfo);
  };

  // Flush on blur (immediate save when user leaves field)
  const handleBlurFlush = () => {
    flush("basic");
  };

  if (!contact) {
    return (
      <Card padding="md">
        <Skeleton height="h-32" width="w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md" className="relative">
      <SavingIndicator cardKey="basic" />
      <div className="mb-4">
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
              onChange={handleFirstNameChange}
              onBlur={handleBlurFlush}
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
              onChange={handleLastNameChange}
              onBlur={handleBlurFlush}
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
            onChange={handleCompanyChange}
            onBlur={handleBlurFlush}
            placeholder="Company"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-darker mb-2">
            Primary Email
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
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-theme-darker">
              Secondary Emails
            </label>
            <button
              type="button"
              onClick={handleAddSecondaryEmail}
              className="flex items-center gap-1 text-sm text-link-blue hover:text-link-blue-hover transition-colors"
              aria-label="Add secondary email"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Email
            </button>
          </div>
          <div className="space-y-2">
            {secondaryEmails.map((email, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="email"
                  id={`secondary-email-${index}`}
                  name={`secondary-email-${index}`}
                  value={email}
                  onChange={(e) => handleSecondaryEmailChange(index, e.target.value)}
                  onBlur={handleBlurFlush}
                  placeholder="secondary@example.com"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveSecondaryEmail(index)}
                  className="p-2 text-error-red-text hover:text-error-red-text-hover hover:bg-error-red-bg-hover rounded-sm transition-colors"
                  aria-label="Remove secondary email"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
            {secondaryEmails.length === 0 && (
              <p className="text-sm text-theme-dark italic">
                No secondary emails. Click &quot;Add Email&quot; to add one.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

