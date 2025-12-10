"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SavingStateContextType {
  isSaving: boolean;
  registerSaveStatus: (id: string, status: SaveStatus) => void;
  unregisterSaveStatus: (id: string) => void;
}

const SavingStateContext = createContext<SavingStateContextType | undefined>(undefined);

export function SavingStateProvider({ children }: { children: ReactNode }) {
  // Track save statuses by component ID
  const [saveStatuses, setSaveStatuses] = useState<Map<string, SaveStatus>>(new Map());

  const registerSaveStatus = useCallback((id: string, status: SaveStatus) => {
    setSaveStatuses((prev) => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
  }, []);

  const unregisterSaveStatus = useCallback((id: string) => {
    setSaveStatuses((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Determine if any component is currently saving
  const isSaving = Array.from(saveStatuses.values()).some((status) => status === "saving");

  return (
    <SavingStateContext.Provider value={{ isSaving, registerSaveStatus, unregisterSaveStatus }}>
      {children}
    </SavingStateContext.Provider>
  );
}

export function useSavingState() {
  const context = useContext(SavingStateContext);
  // Provide default values if context is not available (shouldn't happen, but be defensive)
  if (context === undefined) {
    return {
      isSaving: false,
      registerSaveStatus: () => {},
      unregisterSaveStatus: () => {},
    };
  }
  return context;
}

