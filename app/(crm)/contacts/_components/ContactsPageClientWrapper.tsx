"use client";

import { useAuth } from "@/hooks/useAuth";
import ContactsPageClient from "../ContactsPageClient";

export default function ContactsPageClientWrapper() {
  const { user, loading: authLoading } = useAuth();
  
  // Get userId from auth (no longer passed as prop from SSR)
  // For Firebase listeners, null is acceptable - the hook will handle it
  const userId = !authLoading && user?.uid ? user.uid : null;

  return <ContactsPageClient userId={userId || ""} />;
}

