"use client";

import { useNewContactPage } from "@/hooks/useNewContactPage";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import ContactsLink from "../_components/ContactsLink";
import { Button } from "@/components/Button";

export default function NewContactPage() {
  const { user, loading, form, updateField, saving, error, handleSave } = useNewContactPage();

  if (loading) {
    return <Loading />;
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Back Button - Mobile: top, Desktop: in header */}
      <div className="lg:hidden">
        <ContactsLink variant="default" />
      </div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Add New Contact</h1>
          <p className="text-gray-600 text-lg">Create a new contact in your CRM</p>
        </div>
        <div className="hidden lg:block">
          <ContactsLink variant="default" />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar - Right Column (1/3) - Top on mobile, Right on desktop */}
        <div className="lg:col-span-1 space-y-6 order-1 lg:order-2">
          {/* Quick Info Card */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Details</h2>
            <div className="space-y-4 text-sm text-gray-600">
              <p>Fill in the form fields to create a new contact. Email is required.</p>
              <p>
                Once saved, the contact will be added to your CRM and you can view and edit it
                from the contacts list.
              </p>
            </div>
          </Card>
        </div>

        {/* Main Content - Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  type="email"
                  value={form.primaryEmail || ""}
                  onChange={(e) => updateField("primaryEmail", e.target.value)}
                  placeholder="email@example.com"
                  required
                />
              </div>
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
            </div>
          </Card>

          {/* CRM Fields Card */}
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              CRM Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Segment</label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  value={form.segment || ""}
                  onChange={(e) => updateField("segment", e.target.value)}
                  placeholder="e.g., Enterprise, SMB, Individual"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead Source
                </label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  value={form.leadSource || ""}
                  onChange={(e) => updateField("leadSource", e.target.value)}
                  placeholder="e.g., Website, Referral, Event"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Engagement Score
                </label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  type="number"
                  min="0"
                  max="100"
                  value={form.engagementScore || ""}
                  onChange={(e) =>
                    updateField("engagementScore", e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="0-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  value={Array.isArray(form.tags) ? form.tags.join(", ") : ""}
                  onChange={(e) =>
                    updateField(
                      "tags",
                      e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  placeholder="tag1, tag2, tag3"
                />
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  type="date"
                  value={
                    form.nextTouchpointDate && typeof form.nextTouchpointDate === "string"
                      ? form.nextTouchpointDate
                      : ""
                  }
                  onChange={(e) => updateField("nextTouchpointDate", e.target.value || null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
                  rows={4}
                  value={form.nextTouchpointMessage || ""}
                  onChange={(e) => updateField("nextTouchpointMessage", e.target.value)}
                  placeholder="What should you discuss in the next touchpoint?"
                />
              </div>
            </div>
          </Card>

          {/* Save Button - Below editable fields */}
          <div className="flex justify-start">
            <Button
              onClick={handleSave}
              disabled={saving}
              loading={saving}
              variant="gradient-blue"
              size="md"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              }
              error={error}
            >
              Save Contact
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
