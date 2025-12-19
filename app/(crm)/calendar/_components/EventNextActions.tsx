"use client";

import { CalendarEvent, Contact } from "@/types/firestore";
import { Button } from "@/components/Button";
import { useRouter } from "next/navigation";
import OverflowMenu from "./OverflowMenu";

interface EventNextActionsProps {
  event: CalendarEvent;
  linkedContact: Contact | null;
  onCreateFollowUp: () => void;
  onDraftEmail: () => void;
  onAddActionItem: () => void;
  onViewContact: () => void;
  followUpEmailDraft?: string | null;
}

export default function EventNextActions({
  event,
  linkedContact,
  onCreateFollowUp,
  onDraftEmail,
  onAddActionItem,
  onViewContact,
  followUpEmailDraft,
}: EventNextActionsProps) {
  const router = useRouter();

  const handleDraftEmail = () => {
    if (followUpEmailDraft && linkedContact?.primaryEmail) {
      const subject = encodeURIComponent(`Follow-up: ${event.title}`);
      const body = encodeURIComponent(followUpEmailDraft);
      window.open(
        `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(linkedContact.primaryEmail)}&su=${subject}&body=${body}`,
        "_blank"
      );
    } else {
      onDraftEmail();
    }
  };

  const handleAddActionItem = () => {
    if (linkedContact) {
      router.push(`/contacts/${linkedContact.contactId}?actionItem=true`);
    } else {
      onAddActionItem();
    }
  };

  // Only show actions if there's a linked contact
  if (!linkedContact) {
    return null;
  }

  const moreActionsItems = [
    {
      label: "Draft Follow-up Email",
      onClick: handleDraftEmail,
    },
    {
      label: "Add Action Item",
      onClick: handleAddActionItem,
    },
    {
      label: "View Contact",
      onClick: onViewContact,
    },
  ];

  return (
    <div 
      className="sticky top-0 z-10 py-4 mb-4"
    >
      <div className="flex items-center gap-2 justify-end">
        <Button
          onClick={onCreateFollowUp}
          variant="primary"
          size="sm"
        >
          Create Follow-up
        </Button>
        <OverflowMenu items={moreActionsItems} />
      </div>
    </div>
  );
}

