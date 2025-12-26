"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/Button";
import { useExportJob } from "@/hooks/useExportJob";
import { useAuth } from "@/hooks/useAuth";
import { Contact } from "@/types/firestore";
import { extractErrorMessage } from "@/components/ErrorMessage";
import { reportException } from "@/lib/error-reporting";
import ProcessingDrawer, { ProcessingStatus } from "@/components/ProcessingDrawer";
import Modal from "@/components/Modal";

interface ContactWithId extends Contact {
  id: string;
}

interface ExportToGoogleModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: ContactWithId[];
}

interface ContactGroup {
  resourceName: string;
  name: string;
}

export default function ExportToGoogleModal({
  isOpen,
  onClose,
  contacts,
}: ExportToGoogleModalProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [useExistingGroup, setUseExistingGroup] = useState(true);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const { exportJob } = useExportJob(user?.uid || null, exportJobId);

  // Fetch contact groups when modal opens
  useEffect(() => {
    if (isOpen && useExistingGroup) {
      fetchContactGroups();
    }
  }, [isOpen, useExistingGroup]);

  const fetchContactGroups = async () => {
    setLoadingGroups(true);
    setError(null);
    try {
      const response = await fetch("/api/contacts/groups");
      if (!response.ok) {
        throw new Error("Failed to fetch contact groups");
      }
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (err) {
      reportException(err, {
        context: "Fetching contact groups",
        tags: { component: "ExportToGoogleModal" },
      });
      setError(extractErrorMessage(err));
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleStartExport = async () => {
    if (contacts.length === 0) {
      setError("No contacts to export");
      return;
    }

    // Group selection is optional - if neither provided, contacts will be exported without a group
    // For now, we require a group to be selected for better organization
    if (useExistingGroup && !selectedGroupId) {
      setError("Please select a contact group");
      return;
    }

    if (!useExistingGroup && !newGroupName.trim()) {
      setError("Please enter a group name");
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/contacts/export-to-google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactIds: contacts.map((c) => c.id),
          groupId: useExistingGroup ? selectedGroupId : undefined,
          groupName: useExistingGroup ? undefined : newGroupName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start export");
      }

      const data = await response.json();
      setExportJobId(data.exportJobId);
    } catch (err) {
      reportException(err, {
        context: "Starting export to Google",
        tags: { component: "ExportToGoogleModal" },
      });
      setError(extractErrorMessage(err));
      setStarting(false);
    }
  };

  const handleClose = () => {
    // Allow closing even if running - user can dismiss the drawer
    // The export will continue in the background
    if (exportJob?.status === "running") {
      // Just close the UI, export continues
      onClose();
      return;
    }
    setExportJobId(null);
    setError(null);
    setSelectedGroupId("");
    setNewGroupName("");
    setUseExistingGroup(true);
    setStarting(false);
    onClose();
  };

  // Determine processing status
  const getProcessingStatus = (): ProcessingStatus => {
    if (!exportJob) return "pending";
    if (exportJob.status === "error") return "error";
    if (exportJob.status === "complete") return "complete";
    return "running";
  };

  const processingStatus = getProcessingStatus();
  const isProcessing = exportJobId !== null;

  // Show ProcessingDrawer when export is in progress
  if (isProcessing) {
    const progress = exportJob
      ? {
          current: exportJob.processedContacts + exportJob.skippedContacts,
          total: exportJob.totalContacts,
          label: exportJob.currentStep || "Processing contacts...",
        }
      : undefined;

    const details =
      exportJob && (exportJob.status === "complete" || exportJob.status === "error") ? (
        <div className="bg-white/30 dark:bg-black/20 rounded-sm p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total Contacts:</span>
            <span className="font-medium">{exportJob.totalContacts}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Created:</span>
            <span className="font-medium">{exportJob.processedContacts}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Already Existed (Added to Group):</span>
            <span className="font-medium">{exportJob.skippedContacts}</span>
          </div>
          {exportJob.errors > 0 && (
            <div className="flex justify-between text-sm">
              <span>Errors:</span>
              <span className="font-medium">{exportJob.errors}</span>
            </div>
          )}
        </div>
      ) : undefined;

    const successMessage =
      exportJob?.status === "complete"
        ? `${exportJob.processedContacts} new contacts created${
            exportJob.skippedContacts > 0
              ? `, ${exportJob.skippedContacts} existing contacts added to group`
              : ""
          }${exportJob.groupName ? ` "${exportJob.groupName}"` : ""}.`
        : undefined;

    return (
      <ProcessingDrawer
        isOpen={isOpen}
        onClose={handleClose}
        status={processingStatus}
        title={
          exportJob?.status === "complete"
            ? "Export Complete"
            : exportJob?.status === "error"
            ? "Export Failed"
            : "Exporting to Google Contacts"
        }
        message={
          exportJob?.status === "complete"
            ? successMessage
            : exportJob?.status === "error"
            ? undefined
            : exportJob?.currentStep || "Processing contacts..."
        }
        errorMessage={exportJob?.errorMessage || undefined}
        progress={progress}
        details={details}
        allowCloseWhileRunning={true}
      />
    );
  }

  // Show modal for initial form
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Export to Google Contacts" maxWidth="lg">
      <div className="space-y-6">
        <div>
          <p className="text-sm mb-4">
            Export {contacts.length} {contacts.length === 1 ? "contact" : "contacts"} to Google Contacts.
          </p>
        </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Group Option
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="groupOption"
                      checked={useExistingGroup}
                      onChange={() => setUseExistingGroup(true)}
                      className="w-4 h-4"
                    />
                    <span>Use existing group</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="groupOption"
                      checked={!useExistingGroup}
                      onChange={() => setUseExistingGroup(false)}
                      className="w-4 h-4"
                    />
                    <span>Create new group</span>
                  </label>
                </div>
              </div>

              {useExistingGroup ? (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select Contact Group
                  </label>
                  {loadingGroups ? (
                    <div className="text-sm opacity-70">Loading groups...</div>
                  ) : (
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme-darkest"
                      disabled={loadingGroups}
                    >
                      <option value="">-- Select a group --</option>
                      {groups.map((group) => (
                        <option key={group.resourceName} value={group.resourceName}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    New Group Name
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme-darkest"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-sm p-3 text-red-800 dark:text-red-200 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={handleClose} disabled={starting} size="sm">
                Cancel
              </Button>
              <Button
                onClick={handleStartExport}
                disabled={starting || contacts.length === 0}
                loading={starting}
                size="sm"
              >
                Start Export
              </Button>
        </div>
      </div>
    </Modal>
  );
}

