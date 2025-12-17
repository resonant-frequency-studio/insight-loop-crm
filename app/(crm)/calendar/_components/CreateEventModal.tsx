"use client";

import { useState } from "react";
import { useCreateCalendarEvent, CreateEventInput } from "@/hooks/useCalendarEvents";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/hooks/useAuth";
import { Contact } from "@/types/firestore";
import { Button } from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Select from "@/components/Select";
import Modal from "@/components/Modal";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillStartTime?: Date;
  prefillEndTime?: Date;
  prefillContactId?: string;
  contacts?: Contact[];
}

export default function CreateEventModal({
  isOpen,
  onClose,
  prefillStartTime,
  prefillEndTime,
  prefillContactId,
  contacts: providedContacts,
}: CreateEventModalProps) {
  const { user } = useAuth();
  const createMutation = useCreateCalendarEvent();
  
  // Fetch contacts if not provided
  const { data: fetchedContacts = [] } = useContacts(user?.uid || "", undefined);
  const contacts = providedContacts || fetchedContacts;

  // Default to 1 hour from now if no prefill
  const defaultStartTime = prefillStartTime || new Date();
  const defaultEndTime = prefillEndTime || new Date(defaultStartTime.getTime() + 60 * 60 * 1000);

  // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatForInput = (date: Date, isAllDay: boolean): string => {
    if (isAllDay) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Parse datetime-local input to ISO string
  const parseFromInput = (value: string, isAllDay: boolean): string => {
    if (isAllDay) {
      // For all-day, use date at midnight
      return `${value}T00:00:00`;
    }
    // For timed events, use the datetime value directly
    return value;
  };

  const [formData, setFormData] = useState<CreateEventInput>({
    title: "",
    description: "",
    location: "",
    startTime: defaultStartTime.toISOString(),
    endTime: defaultEndTime.toISOString(),
    attendees: [],
    contactId: prefillContactId,
    isAllDay: false,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [attendeesText, setAttendeesText] = useState("");

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title || formData.title.trim() === "") {
      errors.title = "Title is required";
    }

    if (!formData.startTime) {
      errors.startTime = "Start time is required";
    }

    if (!formData.endTime) {
      errors.endTime = "End time is required";
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime);
      const end = new Date(formData.endTime);
      if (start >= end) {
        errors.endTime = "End time must be after start time";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Parse attendees from text
    const attendees = attendeesText
      .split("\n")
      .map((email) => email.trim())
      .filter((email) => email !== "" && email.includes("@"));

    try {
      await createMutation.mutateAsync({
        ...formData,
        attendees: attendees.length > 0 ? attendees : undefined,
      });
      handleClose();
    } catch (error) {
      // Error handling is done by the mutation hook
    }
  };

  const handleClose = () => {
    // Reset form
    setFormData({
      title: "",
      description: "",
      location: "",
      startTime: defaultStartTime.toISOString(),
      endTime: defaultEndTime.toISOString(),
      attendees: [],
      contactId: undefined,
      isAllDay: false,
    });
    setAttendeesText("");
    setFormErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Event"
      maxWidth="2xl"
      closeOnBackdropClick={true}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-theme-darkest mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Event title"
              required
            />
            {formErrors.title && (
              <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>
            )}
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-darkest mb-1">
                Start <span className="text-red-500">*</span>
              </label>
              <Input
                type={formData.isAllDay ? "date" : "datetime-local"}
                value={formatForInput(new Date(formData.startTime), formData.isAllDay || false)}
                onChange={(e) => {
                  const value = e.target.value;
                  const newStartTime = parseFromInput(value, formData.isAllDay || false);
                  setFormData({ ...formData, startTime: newStartTime });
                }}
                required
              />
              {formErrors.startTime && (
                <p className="text-red-500 text-sm mt-1">{formErrors.startTime}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-darkest mb-1">
                End <span className="text-red-500">*</span>
              </label>
              <Input
                type={formData.isAllDay ? "date" : "datetime-local"}
                value={formatForInput(new Date(formData.endTime), formData.isAllDay || false)}
                onChange={(e) => {
                  const value = e.target.value;
                  const newEndTime = parseFromInput(value, formData.isAllDay || false);
                  setFormData({ ...formData, endTime: newEndTime });
                }}
                required
              />
              {formErrors.endTime && (
                <p className="text-red-500 text-sm mt-1">{formErrors.endTime}</p>
              )}
            </div>
          </div>

          {/* All-day toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAllDay"
              checked={formData.isAllDay || false}
              onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="isAllDay" className="text-sm font-medium text-theme-darkest">
              All-day event
            </label>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-theme-darkest mb-1">
              Location
            </label>
            <Input
              value={formData.location || ""}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Event location"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-theme-darkest mb-1">
              Description
            </label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Event description"
              rows={4}
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-theme-darkest mb-1">
              Attendees (one email per line)
            </label>
            <Textarea
              value={attendeesText}
              onChange={(e) => setAttendeesText(e.target.value)}
              placeholder="email@example.com"
              rows={3}
            />
          </div>

          {/* Link to Contact */}
          {contacts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-theme-darkest mb-1">
                Link to Contact (optional)
              </label>
              <Select
                value={formData.contactId || ""}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value || undefined })}
              >
                <option value="">None</option>
                {contacts.map((contact) => (
                  <option key={contact.contactId} value={contact.contactId}>
                    {contact.firstName || contact.lastName
                      ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
                      : contact.primaryEmail}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
    </Modal>
  );
}

