"use client";

import { useState, ChangeEvent, useEffect, useRef } from "react";
import { Contact } from "@/types/firestore";
import Modal from "@/components/Modal";
import { Button } from "@/components/Button";
import { ErrorMessage, extractErrorMessage } from "@/components/ErrorMessage";
import Textarea from "@/components/Textarea";
import { useUpdateTouchpointStatus } from "@/hooks/useContactMutations";
import { useAuth } from "@/hooks/useAuth";
import { useContact } from "@/hooks/useContact";
import { reportException } from "@/lib/error-reporting";

interface TouchpointStatusActionsProps {
  contactId: string;
  contactName: string;
  userId: string;
  onStatusUpdate?: () => void;
  compact?: boolean; // For dashboard cards
  // Optional: for cases where contact data isn't in React Query (e.g., ContactCard in lists)
  currentStatus?: Contact["touchpointStatus"];
}

export default function TouchpointStatusActions({
  contactId,
  contactName,
  userId,
  onStatusUpdate,
  compact = false,
  currentStatus: fallbackStatus,
}: TouchpointStatusActionsProps) {
  const { user } = useAuth();
  
  // Use userId prop if provided, otherwise fall back to user?.uid
  const effectiveUserId = userId || user?.uid || "";
  
  // Read contact directly from React Query cache for optimistic updates
  // Fall back to prop if contact isn't in cache (e.g., in ContactCard list view)
  const { data: contact } = useContact(effectiveUserId, contactId);
  const prevContactIdRef = useRef<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<Contact["touchpointStatus"]>(
    contact?.touchpointStatus ?? fallbackStatus ?? null
  );
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useUpdateTouchpointStatus(effectiveUserId);

  // Reset state ONLY when contactId changes (switching to a different contact)
  // We don't update when updatedAt changes because that would reset our local state
  // during optimistic updates and refetches. The local state is the source of truth
  // until we switch to a different contact.
  useEffect(() => {
    if (!contact && !fallbackStatus) return;
    
    // Only update if we're switching to a different contact
    if (prevContactIdRef.current !== contactId) {
      prevContactIdRef.current = contactId;
      const statusToUse = contact?.touchpointStatus ?? fallbackStatus ?? null;
      // Batch state updates to avoid cascading renders
      setCurrentStatus(statusToUse);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, fallbackStatus]);

  const handleUpdateStatus = async (status: "completed" | "cancelled" | null, reason?: string) => {
    setError(null);
    setCurrentStatus(status);
    mutation.mutate(
      {
        contactId,
        status,
        reason: reason || null,
      },
      {
        onSuccess: () => {
          setShowCancelModal(false);
          setShowCompleteModal(false);
          setReason("");
          onStatusUpdate?.();
        },
        onError: (error) => {
          reportException(error, {
            context: "Updating touchpoint status in TouchpointStatusActions",
            tags: { component: "TouchpointStatusActions", contactId },
          });
          setError(extractErrorMessage(error));
        },
      }
    );
  };

  if (compact) {
    // Compact view for dashboard cards
    return (
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {currentStatus !== "completed" && (
            <Button
              variant="success"
              onClick={() => setShowCompleteModal(true)}
              disabled={mutation.isPending}
              className="flex-1 cursor-pointer sm:flex-none px-3 py-2 sm:px-2 sm:py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-1"
              title="I've contacted this person"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
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
              <span className="whitespace-nowrap">Mark as Contacted</span>
            </Button>
          )}
          {currentStatus !== "cancelled" && (
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(true)}
              disabled={mutation.isPending}
              className="flex-1 sm:flex-none px-3 py-2 sm:px-2 sm:py-1 text-xs font-medium text-foreground border border-theme-medium rounded hover:bg-theme-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-1"
              title="Skip this touchpoint - no action needed"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
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
              <span className="whitespace-nowrap">Skip Touchpoint</span>
            </Button>
          )}
        </div>
        {error && (
          <ErrorMessage
            message={error}
            dismissible
            onDismiss={() => setError(null)}
          />
        )}
        <Modal
          isOpen={showCompleteModal}
          onClose={() => {
            if (!mutation.isPending) {
              setShowCompleteModal(false);
              setReason("");
              setError(null);
            }
          }}
          title="Mark as Contacted"
          closeOnBackdropClick={!mutation.isPending}
        >
          <p className="text-sm text-theme-dark mb-4">
            Mark the touchpoint for <strong>{contactName}</strong> as contacted? This indicates you&apos;ve reached out to them.
          </p>
          <div className="mb-4">
            <label htmlFor="touchpoint-complete-note-compact" className="block text-sm font-medium text-theme-darker mb-2">
              Note (optional)
              <span className="text-xs text-gray-500 font-normal ml-1">
                — This will be saved and displayed on the contact page
              </span>
            </label>
            <Textarea
              id="touchpoint-complete-note-compact"
              name="touchpoint-complete-note-compact"
              value={reason}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="e.g., Discussed proposal, scheduled follow-up, sent quote..."
              className="px-3 py-2 text-theme-darkest disabled:text-theme-dark"
              rows={3}
              disabled={mutation.isPending}
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>
          {error && (
            <div className="mb-4">
              <ErrorMessage
                message={error}
                dismissible
                onDismiss={() => setError(null)}
              />
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => {
                setShowCompleteModal(false);
                setReason("");
                setError(null);
              }}
              disabled={mutation.isPending}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdateStatus("completed", reason)}
              disabled={mutation.isPending}
              loading={mutation.isPending}
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
            if (!mutation.isPending) {
              setShowCancelModal(false);
              setReason("");
              setError(null);
            }
          }}
          title="Skip Touchpoint"
          closeOnBackdropClick={!mutation.isPending}
        >
          <p className="text-sm text-theme-dark mb-4">
            Skip the touchpoint for <strong>{contactName}</strong>? This indicates no action is needed at this time.
          </p>
          <div className="mb-4">
            <label htmlFor="touchpoint-skip-reason-compact" className="block text-sm font-medium text-theme-darker mb-2">
              Reason (optional)
              <span className="text-xs text-gray-500 font-normal ml-1">
                — This will be saved and displayed on the contact page
              </span>
            </label>
            <Textarea
              id="touchpoint-skip-reason-compact"
              name="touchpoint-skip-reason-compact"
              value={reason}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="e.g., Not relevant, contact inactive, wrong contact..."
              className="px-3 py-2 text-theme-darkest disabled:text-theme-dark"
              rows={3}
              disabled={mutation.isPending}
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>
          {error && (
            <div className="mb-4">
              <ErrorMessage
                message={error}
                dismissible
                onDismiss={() => setError(null)}
              />
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => {
                setShowCancelModal(false);
                setReason("");
                setError(null);
              }}
              disabled={mutation.isPending}
              size="sm"
            >
              Keep Touchpoint
            </Button>
            <Button
              onClick={() => handleUpdateStatus("cancelled", reason)}
              disabled={mutation.isPending}
              loading={mutation.isPending}
              variant="outline"
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
          <span className="px-3 py-1 text-sm font-medium text-[#eeeeec] bg-theme-medium rounded-full">
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
            disabled={mutation.isPending}
            variant="success"
            size="sm"
          >
            Mark as Contacted
          </Button>
          <Button
            onClick={() => setShowCancelModal(true)}
            disabled={mutation.isPending}
            variant="outline"
            size="sm"
          >
            Skip Touchpoint
          </Button>
        </div>
      )}

      {(currentStatus === "completed" || currentStatus === "cancelled") && (
        <Button
          onClick={() => handleUpdateStatus(null)}
          disabled={mutation.isPending}
          loading={mutation.isPending}
          variant="outline"
          size="sm"
          className="text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          Restore to Pending
        </Button>
      )}

      {error && (
        <ErrorMessage
          message={error}
          dismissible
          onDismiss={() => setError(null)}
        />
      )}

      {/* Modals */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => {
          if (!mutation.isPending) {
            setShowCompleteModal(false);
            setReason("");
            setError(null);
          }
        }}
        title="Mark as Contacted"
        closeOnBackdropClick={!mutation.isPending}
      >
        <p className="text-sm text-theme-dark mb-4">
          Mark the touchpoint for <strong>{contactName}</strong> as contacted? This indicates you&apos;ve reached out to them.
        </p>
        <div className="mb-4">
          <label htmlFor="touchpoint-complete-note" className="block text-sm font-medium text-theme-darker mb-2">
            Note (optional)
            <span className="text-xs text-gray-500 font-normal ml-1">
              — This will be saved and displayed on the contact page
            </span>
          </label>
          <Textarea
            id="touchpoint-complete-note"
            name="touchpoint-complete-note"
            value={reason}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            placeholder="e.g., Discussed proposal, scheduled follow-up, sent quote..."
            className="px-3 py-2 text-theme-darkest disabled:text-theme-dark"
            rows={3}
            disabled={mutation.isPending}
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>
        {error && (
          <div className="mb-4">
            <ErrorMessage
              message={error}
              dismissible
              onDismiss={() => setError(null)}
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => {
              setShowCompleteModal(false);
              setReason("");
              setError(null);
            }}
            disabled={mutation.isPending}
            variant="secondary"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleUpdateStatus("completed", reason)}
            disabled={mutation.isPending}
            loading={mutation.isPending}
            variant="success"
            size="sm"
          >
            Mark Completed
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          if (!mutation.isPending) {
            setShowCancelModal(false);
            setReason("");
            setError(null);
          }
        }}
        title="Skip Touchpoint"
        closeOnBackdropClick={!mutation.isPending}
      >
        <p className="text-sm text-theme-dark mb-4">
          Skip the touchpoint for <strong>{contactName}</strong>? This indicates no action is needed at this time.
        </p>
        <div className="mb-4">
          <label htmlFor="touchpoint-skip-reason" className="block text-sm font-medium text-theme-darker mb-2">
            Reason (optional)
            <span className="text-xs text-gray-500 font-normal ml-1">
              — This will be saved and displayed on the contact page
            </span>
          </label>
          <Textarea
            id="touchpoint-skip-reason"
            name="touchpoint-skip-reason"
            value={reason}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            placeholder="e.g., Not relevant, contact inactive, wrong contact..."
            className="px-3 py-2 text-theme-darkest disabled:text-theme-dark"
            rows={3}
            disabled={mutation.isPending}
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>
        {error && (
          <div className="mb-4">
            <ErrorMessage
              message={error}
              dismissible
              onDismiss={() => setError(null)}
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => {
              setShowCancelModal(false);
              setReason("");
              setError(null);
            }}
            disabled={mutation.isPending}
            size="sm"
          >
            Keep Touchpoint
          </Button>
          <Button
            onClick={() => handleUpdateStatus("cancelled", reason)}
            disabled={mutation.isPending}
            loading={mutation.isPending}
            variant="outline"
            size="sm"
          >
            Skip Touchpoint
          </Button>
        </div>
      </Modal>
    </div>
  );
}

