"use client";

import { useState } from "react";
import { Contact } from "@/types/firestore";
import Modal from "@/components/Modal";
import { Button } from "@/components/Button";
import { reportException } from "@/lib/error-reporting";

interface TouchpointStatusActionsProps {
  contactId: string;
  contactName: string;
  currentStatus: Contact["touchpointStatus"];
  onStatusUpdate?: () => void;
  compact?: boolean; // For dashboard cards
}

export default function TouchpointStatusActions({
  contactId,
  contactName,
  currentStatus,
  onStatusUpdate,
  compact = false,
}: TouchpointStatusActionsProps) {
  const [updating, setUpdating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [reason, setReason] = useState("");

  const handleUpdateStatus = async (status: "completed" | "cancelled" | null, reason?: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}/touchpoint-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason || null }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update touchpoint status");
      }

      setShowCancelModal(false);
      setShowCompleteModal(false);
      setReason("");
      onStatusUpdate?.();
    } catch (error) {
      reportException(error, {
        context: "Updating touchpoint status",
        tags: { component: "TouchpointStatusActions", contactId },
        extra: { status: newStatus },
      });
      alert(error instanceof Error ? error.message : "Failed to update touchpoint status");
    } finally {
      setUpdating(false);
    }
  };

  if (compact) {
    // Compact view for dashboard cards
    return (
      <div className="flex items-center gap-2">
        {currentStatus !== "completed" && (
          <button
            onClick={() => setShowCompleteModal(true)}
            disabled={updating}
            className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="I've contacted this person"
          >
            <svg
              className="w-3.5 h-3.5 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Mark as Contacted
          </button>
        )}
        {currentStatus !== "cancelled" && (
          <button
            onClick={() => setShowCancelModal(true)}
            disabled={updating}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Skip this touchpoint - no action needed"
          >
            <svg
              className="w-3.5 h-3.5 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Skip Touchpoint
          </button>
        )}
        <Modal
          isOpen={showCompleteModal}
          onClose={() => {
            if (!updating) {
              setShowCompleteModal(false);
              setReason("");
            }
          }}
          title="Mark as Contacted"
          closeOnBackdropClick={!updating}
        >
          <p className="text-sm text-gray-600 mb-4">
            Mark the touchpoint for <strong>{contactName}</strong> as contacted? This indicates you&apos;ve reached out to them.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional note about the contact (e.g., what you discussed)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 resize-none"
            rows={3}
            disabled={updating}
          />
          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => {
                setShowCompleteModal(false);
                setReason("");
              }}
              disabled={updating}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdateStatus("completed", reason)}
              disabled={updating}
              loading={updating}
              variant="success"
              size="sm"
            >
              Mark as Contacted
            </Button>
          </div>
        </Modal>
        <Modal
          isOpen={showCancelModal}
          onClose={() => {
            if (!updating) {
              setShowCancelModal(false);
              setReason("");
            }
          }}
          title="Skip Touchpoint"
          closeOnBackdropClick={!updating}
        >
          <p className="text-sm text-gray-600 mb-4">
            Skip the touchpoint for <strong>{contactName}</strong>? This indicates no action is needed at this time.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional reason for skipping (e.g., not relevant, contact inactive)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 resize-none"
            rows={3}
            disabled={updating}
          />
          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => {
                setShowCancelModal(false);
                setReason("");
              }}
              disabled={updating}
              variant="secondary"
              size="sm"
            >
              Keep Touchpoint
            </Button>
            <Button
              onClick={() => handleUpdateStatus("cancelled", reason)}
              disabled={updating}
              loading={updating}
              variant="secondary"
              size="sm"
            >
              Skip Touchpoint
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  // Full view for contact detail page
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {currentStatus === "completed" && (
          <span className="px-3 py-1 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full">
            ✓ Contacted
          </span>
        )}
        {currentStatus === "cancelled" && (
          <span className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-full">
            ✕ Skipped
          </span>
        )}
        {(!currentStatus || currentStatus === "pending") && (
          <span className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
            Pending
          </span>
        )}
      </div>
      
        {(!currentStatus || currentStatus === "pending") && (
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCompleteModal(true)}
            disabled={updating}
            variant="success"
            size="sm"
          >
            Mark as Contacted
          </Button>
          <Button
            onClick={() => setShowCancelModal(true)}
            disabled={updating}
            variant="secondary"
            size="sm"
          >
            Skip Touchpoint
          </Button>
        </div>
      )}

      {(currentStatus === "completed" || currentStatus === "cancelled") && (
        <Button
          onClick={() => handleUpdateStatus(null)}
          disabled={updating}
          variant="outline"
          size="sm"
          className="text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          Restore to Pending
        </Button>
      )}

      {/* Modals */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => {
          if (!updating) {
            setShowCompleteModal(false);
            setReason("");
          }
        }}
        title="Mark as Contacted"
        closeOnBackdropClick={!updating}
      >
        <p className="text-sm text-gray-600 mb-4">
          Mark the touchpoint for <strong>{contactName}</strong> as contacted? This indicates you&apos;ve reached out to them.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional note about the contact (e.g., what you discussed)..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 resize-none"
          rows={3}
          disabled={updating}
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              setShowCompleteModal(false);
              setReason("");
            }}
            disabled={updating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => handleUpdateStatus("completed", reason)}
            disabled={updating}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {updating ? "Updating..." : "Mark Completed"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          if (!updating) {
            setShowCancelModal(false);
            setReason("");
          }
        }}
        title="Skip Touchpoint"
        closeOnBackdropClick={!updating}
      >
        <p className="text-sm text-gray-600 mb-4">
          Skip the touchpoint for <strong>{contactName}</strong>? This indicates no action is needed at this time.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason for skipping (e.g., not relevant, contact inactive)..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 resize-none"
          rows={3}
          disabled={updating}
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              setShowCancelModal(false);
              setReason("");
            }}
            disabled={updating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Keep Touchpoint
          </button>
          <button
            onClick={() => handleUpdateStatus("cancelled", reason)}
            disabled={updating}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {updating ? "Skipping..." : "Skip Touchpoint"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

