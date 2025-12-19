"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { Button } from "@/components/Button";
import { GoogleCalendarEvent } from "@/lib/calendar/google-calendar-client";
import { reportException } from "@/lib/error-reporting";

export interface ConflictData {
  conflict: true;
  reason: "etag_mismatch";
  googleEvent: GoogleCalendarEvent;
  localEvent: Partial<{
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
  }>;
  cachedEvent?: {
    etag?: string;
    googleUpdated?: string;
  };
  changedFields?: string[];
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflictData: ConflictData;
  onResolve: (resolution: "keep-google" | "overwrite-google" | "merge", mergedData?: Partial<{
    title?: string;
    description?: string;
    location?: string;
    startTime?: string;
    endTime?: string;
    attendees?: string[];
  }>) => Promise<void>;
}

export default function ConflictResolutionModal({
  isOpen,
  onClose,
  conflictData,
  onResolve,
}: ConflictResolutionModalProps) {
  const [resolution, setResolution] = useState<"keep-google" | "overwrite-google" | "merge" | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [mergeData, setMergeData] = useState<Partial<{
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    attendees: string[];
  }>>({});

  const { googleEvent, localEvent, changedFields = [] } = conflictData;

  // Initialize merge data with Google's values as defaults
  const initializeMergeData = () => {
    const googleStart = googleEvent.start.dateTime || googleEvent.start.date;
    const googleEnd = googleEvent.end.dateTime || googleEvent.end.date;
    const localStart = localEvent.start?.dateTime || localEvent.start?.date;
    const localEnd = localEvent.end?.dateTime || localEvent.end?.date;

    setMergeData({
      title: googleEvent.summary || localEvent.summary || "",
      description: googleEvent.description || localEvent.description || "",
      location: googleEvent.location || localEvent.location || "",
      startTime: googleStart || localStart || "",
      endTime: googleEnd || localEnd || "",
      attendees: googleEvent.attendees?.map(a => a.email) || localEvent.attendees?.map(a => a.email) || [],
    });
  };

  const handleResolutionSelect = (res: "keep-google" | "overwrite-google" | "merge") => {
    setResolution(res);
    if (res === "merge") {
      initializeMergeData();
    }
  };

  const handleResolve = async () => {
    if (!resolution) return;

    setIsResolving(true);
    try {
      if (resolution === "merge") {
        await onResolve("merge", mergeData);
      } else {
        await onResolve(resolution);
      }
      onClose();
      setResolution(null);
      setMergeData({});
    } catch (error) {
      reportException(error, {
        context: "Resolving calendar event conflict",
        tags: { component: "ConflictResolutionModal" },
      });
      // Error handling is done by parent component
    } finally {
      setIsResolving(false);
    }
  };

  const formatDateTime = (dateTime?: string, date?: string): string => {
    if (dateTime) {
      return new Date(dateTime).toLocaleString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    if (date) {
      return new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return "Not set";
  };

  const formatAttendees = (attendees?: Array<{ email: string; displayName?: string }>): string => {
    if (!attendees || attendees.length === 0) return "None";
    return attendees.map(a => a.displayName || a.email).join(", ");
  };

  const hasFieldChanged = (field: string): boolean => {
    return changedFields.includes(field);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resolve Conflict"
      maxWidth="2xl"
      closeOnBackdropClick={!isResolving}
    >
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            This event was modified in Google Calendar while you were editing it. Please choose how to resolve the conflict.
          </p>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Calendar version */}
          <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
            <h3 className="font-semibold text-theme-darkest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              Google Calendar Version
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-theme-medium">Title:</span>
                <p className="text-theme-darkest mt-1">{googleEvent.summary || "Untitled"}</p>
              </div>
              {hasFieldChanged("description") && (
                <div>
                  <span className="font-medium text-theme-medium">Description:</span>
                  <p className="text-theme-darkest mt-1 whitespace-pre-wrap">
                    {googleEvent.description || "None"}
                  </p>
                </div>
              )}
              {hasFieldChanged("location") && (
                <div>
                  <span className="font-medium text-theme-medium">Location:</span>
                  <p className="text-theme-darkest mt-1">{googleEvent.location || "None"}</p>
                </div>
              )}
              {hasFieldChanged("startTime") && (
                <div>
                  <span className="font-medium text-theme-medium">Start:</span>
                  <p className="text-theme-darkest mt-1">
                    {formatDateTime(googleEvent.start.dateTime, googleEvent.start.date)}
                  </p>
                </div>
              )}
              {hasFieldChanged("endTime") && (
                <div>
                  <span className="font-medium text-theme-medium">End:</span>
                  <p className="text-theme-darkest mt-1">
                    {formatDateTime(googleEvent.end.dateTime, googleEvent.end.date)}
                  </p>
                </div>
              )}
              {hasFieldChanged("attendees") && (
                <div>
                  <span className="font-medium text-theme-medium">Attendees:</span>
                  <p className="text-theme-darkest mt-1">{formatAttendees(googleEvent.attendees)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Your changes */}
          <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
            <h3 className="font-semibold text-theme-darkest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              Your Changes
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-theme-medium">Title:</span>
                <p className="text-theme-darkest mt-1">{localEvent.summary || "Untitled"}</p>
              </div>
              {hasFieldChanged("description") && (
                <div>
                  <span className="font-medium text-theme-medium">Description:</span>
                  <p className="text-theme-darkest mt-1 whitespace-pre-wrap">
                    {localEvent.description || "None"}
                  </p>
                </div>
              )}
              {hasFieldChanged("location") && (
                <div>
                  <span className="font-medium text-theme-medium">Location:</span>
                  <p className="text-theme-darkest mt-1">{localEvent.location || "None"}</p>
                </div>
              )}
              {hasFieldChanged("startTime") && (
                <div>
                  <span className="font-medium text-theme-medium">Start:</span>
                  <p className="text-theme-darkest mt-1">
                    {formatDateTime(localEvent.start?.dateTime, localEvent.start?.date)}
                  </p>
                </div>
              )}
              {hasFieldChanged("endTime") && (
                <div>
                  <span className="font-medium text-theme-medium">End:</span>
                  <p className="text-theme-darkest mt-1">
                    {formatDateTime(localEvent.end?.dateTime, localEvent.end?.date)}
                  </p>
                </div>
              )}
              {hasFieldChanged("attendees") && (
                <div>
                  <span className="font-medium text-theme-medium">Attendees:</span>
                  <p className="text-theme-darkest mt-1">
                    {formatAttendees(localEvent.attendees?.map(a => ({ email: a.email })))}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resolution options */}
        <div className="space-y-4">
          <h3 className="font-semibold text-theme-darkest">Choose Resolution:</h3>
          
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="resolution"
                value="keep-google"
                checked={resolution === "keep-google"}
                onChange={() => handleResolutionSelect("keep-google")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-theme-darkest">Keep Google Calendar Version</div>
                <div className="text-sm text-theme-medium mt-1">
                  Discard your changes and use the version from Google Calendar
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="resolution"
                value="overwrite-google"
                checked={resolution === "overwrite-google"}
                onChange={() => handleResolutionSelect("overwrite-google")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-theme-darkest">Overwrite Google Calendar</div>
                <div className="text-sm text-theme-medium mt-1">
                  Apply your changes to Google Calendar (will overwrite Google&apos;s version)
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="resolution"
                value="merge"
                checked={resolution === "merge"}
                onChange={() => handleResolutionSelect("merge")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-theme-darkest">Merge Changes</div>
                <div className="text-sm text-theme-medium mt-1">
                  Combine both versions field-by-field
                </div>
              </div>
            </label>
          </div>

          {/* Merge preview/editor */}
          {resolution === "merge" && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 mt-4">
              <h4 className="font-semibold text-theme-darkest mb-3">Merge Preview</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block font-medium text-theme-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={mergeData.title || ""}
                    onChange={(e) => setMergeData({ ...mergeData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-theme-medium mb-1">Description</label>
                  <textarea
                    value={mergeData.description || ""}
                    onChange={(e) => setMergeData({ ...mergeData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-theme-medium mb-1">Location</label>
                  <input
                    type="text"
                    value={mergeData.location || ""}
                    onChange={(e) => setMergeData({ ...mergeData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-theme-medium mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      value={mergeData.startTime ? new Date(mergeData.startTime).toISOString().slice(0, 16) : ""}
                      onChange={(e) => setMergeData({ ...mergeData, startTime: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-theme-medium mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      value={mergeData.endTime ? new Date(mergeData.endTime).toISOString().slice(0, 16) : ""}
                      onChange={(e) => setMergeData({ ...mergeData, endTime: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isResolving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleResolve}
            disabled={!resolution || isResolving}
            loading={isResolving}
          >
            Resolve Conflict
          </Button>
        </div>
      </div>
    </Modal>
  );
}

