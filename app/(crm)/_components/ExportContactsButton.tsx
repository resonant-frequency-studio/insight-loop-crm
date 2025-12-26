"use client";

import { useState } from "react";
import { Contact } from "@/types/firestore";
import Papa from "papaparse";
import { Button } from "@/components/Button";
import ExportToGoogleModal from "./ExportToGoogleModal";

interface ContactWithId extends Contact {
  id: string;
}

interface ExportContactsButtonProps {
  contacts: ContactWithId[];
  disabled?: boolean;
}

export default function ExportContactsButton({ contacts, disabled = false }: ExportContactsButtonProps) {
  const [showExportModal, setShowExportModal] = useState(false);

  const exportToCSV = () => {
    if (contacts.length === 0) {
      alert("No contacts to export");
      return;
    }

    // Map contacts to CSV format matching the import format
    const csvData = contacts.map((contact) => {
      // Format tags array as comma-separated string
      const tagsString = contact.tags && contact.tags.length > 0 
        ? contact.tags.join(", ") 
        : "";

      // Format dates if they exist
      const formatDate = (date: unknown): string => {
        if (!date) return "";
        if (date instanceof Date) {
          return date.toISOString().split("T")[0];
        }
        if (typeof date === "object" && "toDate" in date) {
          // Firestore Timestamp
          return (date as { toDate: () => Date }).toDate().toISOString().split("T")[0];
        }
        if (typeof date === "string") {
          return date.split("T")[0];
        }
        return "";
      };

      return {
        Email: contact.primaryEmail || "",
        FirstName: contact.firstName || "",
        LastName: contact.lastName || "",
        Summary: contact.summary || "",
        Notes: contact.notes || "",
        Tags: tagsString,
        Segment: contact.segment || "",
        LeadSource: contact.leadSource || "",
        EngagementScore: contact.engagementScore?.toString() || "",
        NextTouchpointDate: formatDate(contact.nextTouchpointDate),
        NextTouchpointMessage: contact.nextTouchpointMessage || "",
      };
    });

    // Convert to CSV
    const csv = Papa.unparse(csvData, {
      header: true,
      skipEmptyLines: false,
    });

    // Create blob and download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `contacts_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2">
          <Button
            onClick={exportToCSV}
            disabled={disabled || contacts.length === 0}
            variant="secondary"
            size="sm"
            icon={
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
            className="whitespace-nowrap shadow-sm"
          >
            Download Contacts
          </Button>
          {contacts.length > 0 && (
            <span className="text-sm text-theme-dark whitespace-nowrap">
              ({contacts.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowExportModal(true)}
            disabled={disabled || contacts.length === 0}
            variant="secondary"
            size="sm"
            icon={
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            }
            className="whitespace-nowrap shadow-sm"
          >
            Export to Google
          </Button>
          {contacts.length > 0 && (
            <span className="text-sm text-theme-dark whitespace-nowrap">
              ({contacts.length})
            </span>
          )}
        </div>
      </div>
      <ExportToGoogleModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        contacts={contacts}
      />
    </>
  );
}

