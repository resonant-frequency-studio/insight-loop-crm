"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCreateContact } from "@/hooks/useContactMutations";
import { Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

export interface NewContactForm {
  primaryEmail: string;
  firstName: string;
  lastName: string;
  company: string;
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
  company: "",
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
  const createContactMutation = useCreateContact();
  const [form, setForm] = useState<NewContactForm>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);
  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Handle auth redirect
  // In test mode (E2E tests), allow rendering without Firebase client auth if session cookie exists
  // Check for session cookie asynchronously - don't redirect immediately to give tests time
  useEffect(() => {
    // Clear any existing timeout
    if (sessionCheckRef.current) {
      clearTimeout(sessionCheckRef.current);
      sessionCheckRef.current = null;
    }

    if (!loading && !user) {
      // Start checking session - use setTimeout to defer setState call
      sessionCheckRef.current = setTimeout(() => {
        setCheckingSession(true);
        
        // Give a small delay to allow session cookie check to complete in test mode
        setTimeout(async () => {
          // Check for session cookie before redirecting (for E2E tests)
          try {
            const response = await fetch("/api/auth/check", {
              credentials: "include",
            });
            // If session check succeeds, allow rendering (test mode with session cookie)
            if (response.ok) {
              setHasValidSession(true);
              setCheckingSession(false);
              return;
            }
          } catch {
            // If check fails, continue with redirect
          }
          // No valid session, redirect to login
          setHasValidSession(false);
          setCheckingSession(false);
          router.push("/login");
        }, 1000); // 1 second delay to allow test session cookie to be recognized
      }, 0);
      
      return () => {
        if (sessionCheckRef.current) {
          clearTimeout(sessionCheckRef.current);
          sessionCheckRef.current = null;
        }
      };
    } else if (user) {
      // User is set, no need to check session
      setHasValidSession(null);
      setCheckingSession(false);
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
        company: form.company?.trim() || null,
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
    // Remove the user check - let the API handle authentication
    // In test mode, the session cookie should work even if Firebase client auth isn't initialized
    // If auth fails, the API will return an error and we'll display it
    if (!validateForm()) {
      return;
    }

    setError(null);

    const contactData = prepareContactData();

    createContactMutation.mutate(contactData, {
      onSuccess: () => {
        router.push("/contacts");
      },
      onError: (err) => {
        reportException(err, {
          context: "Creating new contact in useNewContactPage",
          tags: { component: "useNewContactPage", email: form.primaryEmail },
        });
        const errorMessage = err instanceof Error ? err.message : "Failed to create contact. Please try again.";
        // If the error is auth-related, show a clearer message
        if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("must be logged in")) {
          setError("You must be logged in to create a contact");
        } else {
          setError(errorMessage);
        }
      },
    });
  }, [form, validateForm, prepareContactData, router, createContactMutation]);

  const resetForm = useCallback(() => {
    setForm(initialFormState);
    setError(null);
  }, []);

  return {
    // Auth state
    user,
    loading: loading || checkingSession, // Include session check in loading state
    
    // Form state
    form,
    updateField,
    
    // Save state
    saving: createContactMutation.isPending,
    error,
    handleSave,
    
    // Actions
    resetForm,
    
    // Session check state (for test mode)
    hasValidSession,
  };
}

