"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCsvParser } from "@/hooks/useCsvParser";
import { useContactImport } from "@/hooks/useContactImport";
import { OverwriteMode } from "@/lib/contact-import";

/**
 * Hook for managing the contact import page state and logic
 */
export function useContactImportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [overwriteMode, setOverwriteMode] = useState<OverwriteMode>("skip");
  const [existingContactsCount, setExistingContactsCount] = useState(0);
  const [csvStatus, setCsvStatus] = useState("");
  
  const { parseCsv, isParsing, parseError } = useCsvParser();
  const { state: importState, checkExistingContacts, startImport, reset, cancel } = useContactImport(
    user?.uid || null
  );

  // Handle auth redirect
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    reset();
    setOverwriteMode("skip");
    setCsvStatus("Parsing CSV...");

    try {
      const rows = await parseCsv(file);
      setCsvStatus("");
      
      // Check which contacts already exist
      const existingCount = await checkExistingContacts(rows);
      
      setExistingContactsCount(existingCount);
      setParsedRows(rows);
      setShowOverwriteModal(true);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setCsvStatus(parseError || "Error parsing CSV file");
    }
  };

  const handleCancelModal = () => {
    setShowOverwriteModal(false);
    setParsedRows([]);
    setOverwriteMode("skip");
    reset();
    // Reset file input so user can select the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleStartImport = async () => {
    if (!overwriteMode) return;
    
    setShowOverwriteModal(false);
    await startImport(parsedRows, overwriteMode);
  };

  return {
    // Auth state
    user,
    loading,
    
    // File input
    fileInputRef,
    
    // Modal state
    showOverwriteModal,
    setShowOverwriteModal,
    handleCancelModal,
    
    // Parsed data
    parsedRows,
    existingContactsCount,
    
    // Import mode
    overwriteMode,
    setOverwriteMode,
    
    // CSV parsing
    isParsing,
    csvStatus,
    parseError,
    
    // Import state
    importState,
    
    // Actions
    handleUpload,
    handleStartImport,
    cancel,
  };
}

