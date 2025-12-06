"use client";

import { doc, updateDoc, deleteDoc, Timestamp, collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Modal from "@/components/Modal";
import Card from "@/components/Card";
import { formatContactDate } from "@/util/contact-utils";
import SegmentSelect from "@/components/SegmentSelect";
import ActionItemsList from "@/components/ActionItemsList";
import TouchpointStatusActions from "@/components/TouchpointStatusActions";

function InfoPopover({ content, children }: { content: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {children}
      </button>
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-white border border-gray-200 text-gray-900 text-[14px] rounded-lg shadow-xl z-50">
          <p className="leading-relaxed lowercase">{content}</p>
          <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
          <div className="absolute left-4 top-full -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>
        </div>
      )}
    </div>
  );
}

interface ContactEditorProps {
  contact: Contact;
  contactDocumentId: string;
  userId: string;
}

export default function ContactEditor({ contact, contactDocumentId, userId }: ContactEditorProps) {
  const [form, setForm] = useState<Contact>(contact);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const router = useRouter();

  // Fetch all contacts to get unique segments
  useEffect(() => {
    const contactsRef = collection(db, `users/${userId}/contacts`);
    const unsub = onSnapshot(contactsRef, (snapshot) => {
      const contactsData = snapshot.docs.map((d) => d.data() as Contact);
      setAllContacts(contactsData);
    });

    return () => unsub();
  }, [userId]);

  // Get unique segments from all contacts
  const uniqueSegments = useMemo(() => {
    return Array.from(new Set(allContacts.map((c) => c.segment).filter(Boolean) as string[])).sort();
  }, [allContacts]);

  const updateField = (field: string, value: string | string[] | null) => {
    setForm({ ...form, [field]: value });
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, `users/${userId}/contacts/${contactDocumentId}`), {
        ...form,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating contact:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async () => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, `users/${userId}/contacts/${contactDocumentId}`));
      router.push("/contacts");
    } catch (error) {
      console.error("Error deleting contact:", error);
      alert("Failed to delete contact. Please try again.");
      setDeleting(false);
    }
  };

  const archiveContact = async (archived: boolean) => {
    setArchiving(true);
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactDocumentId)}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to archive contact");
      }

      // Redirect to contacts page after archiving
      router.push("/contacts");
    } catch (error) {
      console.error("Error archiving contact:", error);
      alert(`Failed to ${archived ? "archive" : "unarchive"} contact. Please try again.`);
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Contact"
        closeOnBackdropClick={!deleting}
      >
        <p className="text-gray-600 mb-6">
          Are you sure? Deleting this contact is final and cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={deleteContact}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
          >
            {deleting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
        {/* Basic Information Card */}
        <Card padding="md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Basic Information
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  value={form.firstName || ""}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  placeholder="First Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  value={form.lastName || ""}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  placeholder="Last Name"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                value={contact.primaryEmail}
              />
            </div>
          </div>
        </Card>

        {/* Tags, Segment, and Lead Source Card */}
        <Card padding="md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            Tags & Classification
          </h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                Tags
                <InfoPopover content="Tags are labels you can assign to contacts to organize and categorize them. Use tags to group contacts by characteristics like industry, role, project, or any custom classification that helps you manage your relationships.">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </InfoPopover>
              </label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                value={(form.tags || []).join(", ")}
                onChange={(e) => updateField("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                placeholder="tag1, tag2, tag3"
              />
              {form.tags && form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  Segment
                  <InfoPopover content="A segment categorizes contacts into distinct groups based on shared characteristics such as company size, industry, customer type, or market segment. This helps you tailor your communication and sales strategies to different groups.">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </InfoPopover>
                </label>
                <SegmentSelect
                  value={form.segment || null}
                  onChange={(value) => updateField("segment", value)}
                  existingSegments={uniqueSegments}
                  placeholder="Enter or select segment..."
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  Lead Source
                  <InfoPopover content="The original source or channel where this contact was first acquired. This helps track which marketing channels or referral sources are most effective for your business.">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </InfoPopover>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  value={form.leadSource || ""}
                  onChange={(e) => updateField("leadSource", e.target.value)}
                  placeholder="Enter lead source..."
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Notes Card */}
        <Card padding="md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Notes
          </h2>
          <textarea
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
            rows={6}
            value={form.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Add notes about this contact..."
          />
        </Card>

        {/* Next Touchpoint Card */}
        <Card padding="md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Next Touchpoint
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                value={
                  form.nextTouchpointDate instanceof Timestamp
                    ? form.nextTouchpointDate.toDate().toISOString().split("T")[0]
                    : typeof form.nextTouchpointDate === "string"
                    ? form.nextTouchpointDate.split("T")[0] // Ensure we only use the date part
                    : ""
                }
                onChange={(e) => {
                  // Only update if we have a valid date value
                  const dateValue = e.target.value;
                  if (dateValue && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    updateField("nextTouchpointDate", dateValue);
                  } else if (!dateValue) {
                    updateField("nextTouchpointDate", null);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
                rows={3}
                value={form.nextTouchpointMessage || ""}
                onChange={(e) => updateField("nextTouchpointMessage", e.target.value)}
                placeholder="What should you discuss in the next touchpoint?"
              />
            </div>
          </div>
          
          {/* Touchpoint Status Management */}
          {(form.nextTouchpointDate || contact.touchpointStatus) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <TouchpointStatusActions
                contactId={contactDocumentId}
                contactName={[form.firstName, form.lastName].filter(Boolean).join(" ") || form.primaryEmail}
                currentStatus={form.touchpointStatus || contact.touchpointStatus}
                onStatusUpdate={() => {
                  // Refresh the contact data
                  window.location.reload();
                }}
              />
              {form.touchpointStatusUpdatedAt ? (
                <p className="text-xs text-gray-500 mt-2">
                  Status updated: {formatContactDate(form.touchpointStatusUpdatedAt, { relative: true })}
                </p>
              ) : null}
              {form.touchpointStatusReason && (
                <p className="text-xs text-gray-600 mt-1 italic">
                  &quot;{form.touchpointStatusReason}&quot;
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Outreach Draft Card */}
        <OutreachDraftEditor
          contact={contact}
          contactDocumentId={contactDocumentId}
          userId={userId}
        />

        {/* Save Changes Button - Bottom Left */}
        <div className="flex justify-start">
          <button
            onClick={saveChanges}
            disabled={saving}
            className="px-6 py-2.5 bg-gray-100 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2 shadow-lg"
            title="Save all changes to this contact (excluding draft)"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save All Changes
              </>
            )}
          </button>
        </div>

      </div>

      {/* Sidebar - Right Column (1/3) */}
      <div className="space-y-6">
        {/* Contact Insights Card (consolidated with Quick Info) */}
        <Card padding="md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Contact Insights</h2>
          <div className="space-y-6">
            {/* Quick Info Section */}
            {form.summary && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  AI Summary
                </label>
                <div className="px-3 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {form.summary}
                </div>
              </div>
            )}
            {(() => {
              const engagementScore = Number(contact.engagementScore);
              const isValidScore = !isNaN(engagementScore) && engagementScore !== null && engagementScore !== undefined;
              return isValidScore ? (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Engagement Score
                    <InfoPopover content="A numerical score (0-100) that measures how actively engaged this contact is with your communications. Higher scores indicate more frequent interactions, email opens, responses, and overall engagement with your content.">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </InfoPopover>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(engagementScore, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {Math.round(engagementScore)}
                    </span>
                  </div>
                </div>
              ) : null;
            })()}
            {contact.threadCount && contact.threadCount > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Email Threads
                </label>
                <p className="text-sm font-medium text-gray-900">{contact.threadCount}</p>
              </div>
            )}

            {/* Insights Section */}
            {contact.lastEmailDate != null && (
              <div className="border-t border-gray-200 pt-6">
                <div className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Last Email Date
                    </h3>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatContactDate(contact.lastEmailDate, { relative: true })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatContactDate(contact.lastEmailDate, { includeTime: true })}
                  </p>
                </div>
              </div>
            )}

            {contact.sentiment && (
              <div className="border-l-4 border-purple-500 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="w-4 h-4 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Sentiment
                  </h3>
                </div>
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    contact.sentiment.toLowerCase().includes("positive")
                      ? "bg-green-100 text-green-800"
                      : contact.sentiment.toLowerCase().includes("negative")
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {contact.sentiment}
                </span>
              </div>
            )}

            {/* Action Items Section - Now using task system */}
            <div className="border-l-4 border-amber-500 pl-4">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-4 h-4 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Action Items
                </h3>
              </div>
              <ActionItemsList
                userId={userId}
                contactId={contactDocumentId}
                onActionItemUpdate={() => {
                  // Trigger a refresh if needed
                }}
              />
            </div>

            {contact.painPoints && (
              <div className="border-l-4 border-red-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Pain Points
                  </h3>
                </div>
                <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                  {contact.painPoints}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Activity Card */}
        <Card padding="md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
              <div>
                <p className="font-medium text-gray-900">Last updated</p>
                <p className="text-gray-500">
                  {contact.updatedAt instanceof Timestamp
                    ? contact.updatedAt.toDate().toLocaleString()
                    : contact.updatedAt
                    ? String(contact.updatedAt)
                    : "N/A"}
                </p>
              </div>
            </div>
            {contact.createdAt != null && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                <div>
                  <p className="font-medium text-gray-900">Created</p>
                  <p className="text-gray-500">
                    {contact.createdAt instanceof Timestamp
                      ? contact.createdAt.toDate().toLocaleString()
                      : typeof contact.createdAt === "string"
                      ? contact.createdAt
                      : "N/A"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Archive Contact Button - Right Sidebar */}
        <Card padding="md">
          <button
            onClick={() => archiveContact(!contact.archived)}
            disabled={archiving || deleting}
            className="w-full px-6 py-2.5 bg-gray-100 border-2 border-gray-600 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2 mb-3"
          >
            {archiving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {contact.archived ? "Unarchiving..." : "Archiving..."}
              </>
            ) : (
              <>
                {contact.archived ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Unarchive Contact
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Archive Contact
                  </>
                )}
              </>
            )}
          </button>
        </Card>

        {/* Delete Contact Button - Right Sidebar */}
        <Card padding="md">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting || showDeleteConfirm || archiving}
            className="w-full px-6 py-2.5 bg-gray-100 border-2 border-red-600 text-red-600 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Contact
          </button>
        </Card>
      </div>
      </div>
    </div>
  );
}

/**
 * Component for editing the Outreach Draft
 */
function OutreachDraftEditor({
  contact,
  contactDocumentId,
  userId,
}: {
  contact: Contact;
  contactDocumentId: string;
  userId: string;
}) {
  const [outreachDraft, setOutreachDraft] = useState(contact.outreachDraft || "");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftHasChanges, setDraftHasChanges] = useState(false);

  // Update local state when contact changes (only if we don't have unsaved changes)
  useEffect(() => {
    if (!draftHasChanges) {
      setOutreachDraft(contact.outreachDraft || "");
    }
  }, [contact.outreachDraft, draftHasChanges]);

  const handleDraftChange = (value: string) => {
    setOutreachDraft(value);
    setDraftHasChanges(value !== (contact.outreachDraft || ""));
  };

  const saveOutreachDraft = async () => {
    if (!draftHasChanges) return;

    setSavingDraft(true);
    try {
      await updateDoc(doc(db, `users/${userId}/contacts/${contactDocumentId}`), {
        outreachDraft: outreachDraft || null,
        updatedAt: new Date(),
      });
      setDraftHasChanges(false);
    } catch (error) {
      console.error("Error saving outreach draft:", error);
      alert("Failed to save outreach draft. Please try again.");
    } finally {
      setSavingDraft(false);
    }
  };

  const openGmailCompose = async () => {
    if (!contact.primaryEmail) {
      alert("This contact does not have an email address.");
      return;
    }

    if (!outreachDraft.trim()) {
      alert("Please add a draft message before continuing in Gmail.");
      return;
    }

    // Auto-save the draft before opening Gmail (if there are unsaved changes)
    if (draftHasChanges) {
      try {
        await updateDoc(doc(db, `users/${userId}/contacts/${contactDocumentId}`), {
          outreachDraft: outreachDraft || null,
          updatedAt: new Date(),
        });
        setDraftHasChanges(false);
      } catch (error) {
        console.error("Error auto-saving draft:", error);
        // Continue anyway - don't block user from opening Gmail
      }
    }

    // Gmail compose URL format: https://mail.google.com/mail/?view=cm&to=EMAIL&body=BODY&su=SUBJECT
    const email = encodeURIComponent(contact.primaryEmail);
    const body = encodeURIComponent(outreachDraft);
    const subject = encodeURIComponent("Follow up");
    
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${email}&body=${body}&su=${subject}`;
    window.open(gmailUrl, "_blank");
  };

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Outreach Draft
        </h2>
        <div className="flex items-center gap-2">
          {draftHasChanges && (
            <button
              onClick={saveOutreachDraft}
              disabled={savingDraft}
              className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
              title="Save only this draft"
            >
              {savingDraft ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
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
                  Saving...
                </>
              ) : (
                <>
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Draft
                </>
              )}
            </button>
          )}
          {outreachDraft.trim() && contact.primaryEmail && (
            <button
              onClick={openGmailCompose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2"
              title="Open this draft in Gmail"
            >
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
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Continue in Gmail
            </button>
          )}
        </div>
      </div>
      <textarea
        value={outreachDraft}
        onChange={(e) => handleDraftChange(e.target.value)}
        placeholder="Write your outreach draft here..."
        className="w-full min-h-[120px] px-4 py-3 text-gray-900 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 resize-y font-sans text-sm leading-relaxed"
      />
    </Card>
  );
}
