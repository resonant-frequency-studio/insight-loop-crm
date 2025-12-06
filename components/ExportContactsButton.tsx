"use client";

import { Contact } from "@/types/firestore";
import Papa from "papaparse";

interface ContactWithId extends Contact {
  id: string;
}

interface ExportContactsButtonProps {
  contacts: ContactWithId[];
  disabled?: boolean;
}

export default function ExportContactsButton({ contacts, disabled = false }: ExportContactsButtonProps) {
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
    <button
      onClick={exportToCSV}
      disabled={disabled || contacts.length === 0}
      className="flex items-center cursor-pointer justify-center gap-2 px-4 py-2.5 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 font-medium w-full sm:w-auto active:scale-95"
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
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      Export {contacts.length > 0 ? `(${contacts.length})` : ""}
    </button>
  );
}

