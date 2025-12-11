"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeleteContact } from "@/hooks/useContactMutations";
import Modal from "@/components/Modal";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { ErrorMessage, extractErrorMessage } from "@/components/ErrorMessage";
import { reportException } from "@/lib/error-reporting";

interface DeleteContactCardProps {
  contactId: string;
}

export default function DeleteContactCard({
  contactId,
}: DeleteContactCardProps) {
  const router = useRouter();
  const deleteContactMutation = useDeleteContact();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteContact = () => {
    setDeleteError(null);
    deleteContactMutation.mutate(contactId, {
      onSuccess: () => {
        router.push("/contacts");
      },
      onError: (error) => {
        reportException(error, {
          context: "Deleting contact in DeleteContactCard",
          tags: { component: "DeleteContactCard", contactId },
        });
        setDeleteError(extractErrorMessage(error));
      },
    });
  };

  return (
    <>
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Contact"
        closeOnBackdropClick={!deleteContactMutation.isPending}
      >
        <p className="text-theme-dark mb-6">
          Are you sure? Deleting this contact is final and cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleteContactMutation.isPending}
            variant="secondary"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={deleteContact}
            disabled={deleteContactMutation.isPending}
            loading={deleteContactMutation.isPending}
            variant="danger"
            size="sm"
            error={deleteError}
          >
            Delete
          </Button>
        </div>
      </Modal>

      <Card padding="md">
        <Button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteContactMutation.isPending || showDeleteConfirm}
          variant="danger"
          fullWidth
          error={deleteError}
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          }
        >
          Delete Contact
        </Button>
        {deleteError && (
          <div className="mt-3">
            <ErrorMessage
              message={deleteError}
              dismissible
              onDismiss={() => setDeleteError(null)}
            />
          </div>
        )}
      </Card>
    </>
  );
}

