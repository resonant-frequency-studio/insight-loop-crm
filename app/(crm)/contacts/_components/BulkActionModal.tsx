"use client";

import Modal from "@/components/Modal";
import { Button } from "@/components/Button";
import Input from "@/components/Input";
import SegmentSelect from "../../_components/SegmentSelect";
import { UseMutationResult } from "@tanstack/react-query";

interface BulkUpdateResponse {
  success: number;
  errors: number;
  errorDetails: string[];
}

interface BulkSegmentVariables {
  contactIds: string[];
  segment: string | null;
}

interface BulkTagsVariables {
  contactIds: string[];
  tags: string[];
}

interface BulkCompanyVariables {
  contactIds: string[];
  company: string | null;
}

interface BulkActionModalProps {
  modalType: "segment" | "tags" | "company" | null;
  onClose: () => void;
  selectedCount: number;
  // Segment props
  selectedNewSegment: string;
  setSelectedNewSegment: (value: string) => void;
  uniqueSegments: string[];
  bulkSegmentMutation: UseMutationResult<BulkUpdateResponse, Error, BulkSegmentVariables, unknown>;
  onSegmentUpdate: (segment: string | null) => void;
  // Tags props
  selectedNewTags: string;
  setSelectedNewTags: (value: string) => void;
  bulkTagsMutation: UseMutationResult<BulkUpdateResponse, Error, BulkTagsVariables, unknown>;
  onTagsUpdate: (tags: string) => void;
  // Company props
  selectedNewCompany: string;
  setSelectedNewCompany: (value: string) => void;
  bulkCompanyMutation: UseMutationResult<BulkUpdateResponse, Error, BulkCompanyVariables, unknown>;
  onCompanyUpdate: (company: string | null) => void;
}

export default function BulkActionModal({
  modalType,
  onClose,
  selectedCount,
  selectedNewSegment,
  setSelectedNewSegment,
  uniqueSegments,
  bulkSegmentMutation,
  onSegmentUpdate,
  selectedNewTags,
  setSelectedNewTags,
  bulkTagsMutation,
  onTagsUpdate,
  selectedNewCompany,
  setSelectedNewCompany,
  bulkCompanyMutation,
  onCompanyUpdate,
}: BulkActionModalProps) {
  if (!modalType) return null;

  const isLoading =
    (modalType === "segment" && bulkSegmentMutation.isPending) ||
    (modalType === "tags" && bulkTagsMutation.isPending) ||
    (modalType === "company" && bulkCompanyMutation.isPending);

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const getTitle = () => {
    switch (modalType) {
      case "segment":
        return "Reassign Segment";
      case "tags":
        return "Update Tags";
      case "company":
        return "Reassign Company";
      default:
        return "";
    }
  };

  const count = selectedCount;
  const contactText = count === 1 ? "contact" : "contacts";

  const handleUpdate = () => {
    if (modalType === "segment") {
      const newSegment = selectedNewSegment.trim() || null;
      onSegmentUpdate(newSegment);
      setSelectedNewSegment("");
    } else if (modalType === "tags") {
      onTagsUpdate(selectedNewTags);
      setSelectedNewTags("");
    } else if (modalType === "company") {
      const newCompany = selectedNewCompany.trim() || null;
      onCompanyUpdate(newCompany);
      setSelectedNewCompany("");
    }
  };

  return (
    <Modal
      isOpen={modalType !== null}
      onClose={handleClose}
      title={getTitle()}
      closeOnBackdropClick={!isLoading}
    >
      <div className="space-y-4">
        <p className="text-sm text-theme-darkest">
          Update the{" "}
          {modalType === "segment" && "segment"}
          {modalType === "tags" && "tags"}
          {modalType === "company" && "company"}
          {" "}for{" "}
          <strong className="font-semibold text-theme-darkest">{count}</strong>{" "}
          selected {contactText}.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <svg
                className="animate-spin h-5 w-5 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-sm font-medium text-theme-darkest">
                Updating contacts...
              </span>
            </div>
          </div>
        ) : (
          <>
            {modalType === "segment" && (
              <div>
                <label className="block text-sm font-medium text-theme-darkest mb-2">
                  New Segment
                </label>
                <SegmentSelect
                  value={selectedNewSegment || null}
                  onChange={(value) => setSelectedNewSegment(value || "")}
                  existingSegments={uniqueSegments}
                  placeholder="Enter or select segment..."
                />
                <p className="mt-2 text-xs text-theme-dark">
                  Select an existing segment from the dropdown, or type a new segment name to create
                  it. Choose &quot;No Segment&quot; to clear.
                </p>
              </div>
            )}

            {modalType === "tags" && (
              <div>
                <label className="block text-sm font-medium text-theme-darkest mb-2">
                  Tags (comma-separated)
                </label>
                <Input
                  type="text"
                  value={selectedNewTags}
                  onChange={(e) => setSelectedNewTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="text-theme-darker"
                />
                <p className="mt-2 text-xs text-theme-dark">
                  Enter tags separated by commas. This will replace all existing tags on the selected contacts.
                  Leave empty to remove all tags.
                </p>
              </div>
            )}

            {modalType === "company" && (
              <div>
                <label className="block text-sm font-medium text-theme-darkest mb-2">
                  Company Name
                </label>
                <Input
                  type="text"
                  value={selectedNewCompany}
                  onChange={(e) => setSelectedNewCompany(e.target.value)}
                  placeholder="Enter company name..."
                  className="text-theme-darker"
                />
                <p className="mt-2 text-xs text-theme-dark">
                  Enter a company name to assign to all selected contacts. Leave empty to clear the company field.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                onClick={handleClose}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isLoading}
                loading={isLoading}
                size="sm"
              >
                {modalType === "segment" && "Update Segment"}
                {modalType === "tags" && "Update Tags"}
                {modalType === "company" && "Update Company"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
