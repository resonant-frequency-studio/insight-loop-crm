"use client";

import { doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Contact } from "@/types/firestore";
import Modal from "@/components/Modal";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();

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

  return (
    <div className="space-y-6">
      {/* Save Changes Button - Fixed to Right Side */}
      <div className="flex justify-end">
        <button
          onClick={saveChanges}
          disabled={saving}
          className="px-6 py-2.5 bg-gray-100 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2 shadow-lg"
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
              Save Changes
            </>
          )}
        </button>
      </div>

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
        </div>

        {/* Tags, Segment, and Lead Source Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  value={form.segment || ""}
                  onChange={(e) => updateField("segment", e.target.value)}
                  placeholder="Enter segment..."
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
        </div>

        {/* Notes Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
        </div>

        {/* Next Touchpoint Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                    ? form.nextTouchpointDate
                    : ""
                }
                onChange={(e) => updateField("nextTouchpointDate", e.target.value)}
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
        </div>

      </div>

      {/* Sidebar - Right Column (1/3) */}
      <div className="space-y-6">
        {/* Quick Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h2>
          <div className="space-y-4">
            {form.summary && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  AI Summary
                </label>
                <div className="px-3 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {form.summary}
                </div>
              </div>
            )}
            {contact.engagementScore !== null && contact.engagementScore !== undefined && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
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
                      style={{ width: `${Math.min(contact.engagementScore, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {contact.engagementScore}
                  </span>
                </div>
              </div>
            )}
            {contact.threadCount && contact.threadCount > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Email Threads
                </label>
                <p className="text-sm font-medium text-gray-900">{contact.threadCount}</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
        </div>
      </div>
      </div>

      {/* Delete Contact Button - Bottom of Form */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting || showDeleteConfirm}
          className="px-6 py-2.5 bg-gray-100 border-2 border-red-600 text-red-600 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Contact
        </button>
    </div>
  );
}
