"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCreateContact } from "@/hooks/useContactMutations";
import { Contact } from "@/types/firestore";
import { normalizeContactId } from "@/util/csv-utils";
import { reportException } from "@/lib/error-reporting";

export interface NewContactForm {
  primaryEmail: string;
  firstName: string;
  lastName: string;
  notes: string;
  tags: string[];
  segment: string;
  leadSource: string;
  engagementScore: number | null;
  summary: string;
  nextTouchpointDate: string | null;
  nextTouchpointMessage: string;
}

const initialFormState: NewContactForm = {
  primaryEmail: "",
  firstName: "",
  lastName: "",
  notes: "",
  tags: [],
  segment: "",
  leadSource: "",
  engagementScore: null,
  summary: "",
  nextTouchpointDate: null,
  nextTouchpointMessage: "",
};

/**
 * Hook for managing the new contact page state and logic
 */
export function useNewContactPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const createContactMutation = useCreateContact(user?.uid);
  const [form, setForm] = useState<NewContactForm>(initialFormState);
  const [error, setError] = useState<string | null>(null);

  // Handle auth redirect
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const updateField = useCallback(
    (field: keyof NewContactForm, value: string | string[] | number | null) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear error when user starts typing
      if (error) setError(null);
    },
    [error]
  );

  const validateForm = useCallback((): boolean => {
    if (!form.primaryEmail?.trim()) {
      setError("Email is required");
      return false;
    }
    return true;
  }, [form.primaryEmail]);

  const prepareContactData = useCallback(
    (): Partial<Contact> => {
      const email = form.primaryEmail.trim().toLowerCase();
      return {
        primaryEmail: email,
        firstName: form.firstName?.trim() || null,
        lastName: form.lastName?.trim() || null,
        notes: form.notes?.trim() || null,
        tags: form.tags || [],
        segment: form.segment?.trim() || null,
        leadSource: form.leadSource?.trim() || null,
        engagementScore: form.engagementScore || null,
        summary: form.summary?.trim() || null,
        nextTouchpointDate:
          form.nextTouchpointDate && typeof form.nextTouchpointDate === "string"
            ? form.nextTouchpointDate.trim() || null
            : null,
        nextTouchpointMessage: form.nextTouchpointMessage?.trim() || null,
      };
    },
    [form]
  );

  const handleSave = useCallback(() => {
    if (!user) {
      setError("You must be logged in to create a contact");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setError(null);

    const email = form.primaryEmail.trim().toLowerCase();
    const contactId = normalizeContactId(email);
    const contactData = prepareContactData();

    createContactMutation.mutate(contactData, {
      onSuccess: () => {
        router.push(`/contacts/${contactId}`);
      },
      onError: (err) => {
        reportException(err, {
          context: "Creating new contact in useNewContactPage",
          tags: { component: "useNewContactPage", email: form.primaryEmail },
        });
        const errorMessage = err instanceof Error ? err.message : "Failed to create contact. Please try again.";
        setError(errorMessage);
      },
    });
  }, [user, form, validateForm, prepareContactData, router, createContactMutation]);

  const resetForm = useCallback(() => {
    setForm(initialFormState);
    setError(null);
  }, []);

  return {
    // Auth state
    user,
    loading,
    
    // Form state
    form,
    updateField,
    
    // Save state
    saving: createContactMutation.isPending,
    error,
    handleSave,
    
    // Actions
    resetForm,
  };
}

