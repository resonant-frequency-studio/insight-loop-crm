"use client";

import { useState, useEffect, useRef } from "react";
import { useContactAutosave } from "./ContactAutosaveProvider";

interface SavingIndicatorProps {
  cardKey: string; // The key used when scheduling saves (e.g., "basic", "tags", "notes")
}

export default function SavingIndicator({ cardKey }: SavingIndicatorProps) {
  const { dirtyKeys, isSaving, lastError, lastSavedAt } = useContactAutosave();
  const [showSaved, setShowSaved] = useState(false);
  const wasDirtyRef = useRef(false);
  
  const isDirty = dirtyKeys.has(cardKey);
  const hasError = lastError?.key === cardKey;
  const isSavingThisCard = isSaving && isDirty;
  
  // Track when card transitions from dirty to clean (successful save)
  useEffect(() => {
    // If card was dirty and is now clean, show "Saved"
    if (wasDirtyRef.current && !isDirty && !hasError && lastSavedAt) {
      // Defer state update to avoid cascading renders
      const showTimer = setTimeout(() => {
        setShowSaved(true);
      }, 0);
      
      // Hide "Saved" after 2 seconds
      const hideTimer = setTimeout(() => {
        setShowSaved(false);
      }, 2000);
      
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
    
    // Update ref to track current dirty state
    wasDirtyRef.current = isDirty;
    
    // Hide "Saved" if card becomes dirty again
    if (isDirty) {
      setTimeout(() => {
        setShowSaved(false);
      }, 0);
    }
  }, [isDirty, hasError, lastSavedAt]);
  
  // Don't show indicator if not saving, not showing saved, and no error
  if (!isSavingThisCard && !showSaved && !hasError) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 z-10">
      {hasError ? (
        <span className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t save
        </span>
      ) : showSaved ? (
        <span className="text-sm text-green-600 dark:text-green-400">
          Saved
        </span>
      ) : (
        <span className="text-sm text-blue-600 dark:text-blue-400">
          Saving…
        </span>
      )}
    </div>
  );
}

