"use client";

import { useNewContactPage } from "@/hooks/useNewContactPage";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import ContactsLink from "@/app/(crm)/_components/ContactsLink";
import { Button } from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";

export default function NewContactPage() {
  const { user, loading, form, updateField, saving, error, handleSave } = useNewContactPage();

  if (loading) {
    return <Loading />;
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Back Button - Mobile: top, Desktop: in header */}
      <div className="xl:hidden">
        <ContactsLink variant="default" />
      </div>

      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Add New Contact</h1>
          <p className="text-theme-dark text-lg">Create a new contact in your CRM</p>
        </div>
        <div className="hidden xl:block">
          <ContactsLink variant="default" />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sidebar - Right Column (1/3) - Top on mobile, Right on desktop */}
        <div className="xl:col-span-1 space-y-6 order-1 xl:order-2">
          {/* Quick Info Card */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-theme-darkest mb-4">Contact Details</h2>
            <div className="space-y-4 text-sm text-theme-dark">
              <p>Fill in the form fields to create a new contact. Email is required.</p>
              <p>
                Once saved, the contact will be added to your CRM and you can view and edit it
                from the contacts list.
              </p>
            </div>
          </Card>
        </div>

        {/* Main Content - Left Column (2/3) */}
        <div className="xl:col-span-2 space-y-6 order-2 xl:order-1">
          {/* Basic Information Card */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-theme-darkest mb-4 flex items-center gap-2">
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
                <label htmlFor="new-contact-email" className="block text-sm font-medium text-theme-darker mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  id="new-contact-email"
                  name="new-contact-email"
                  type="email"
                  value={form.primaryEmail || ""}
                  onChange={(e) => updateField("primaryEmail", e.target.value)}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-contact-first-name" className="block text-sm font-medium text-theme-darker mb-2">
                    First Name
                  </label>
                  <Input
                    id="new-contact-first-name"
                    name="new-contact-first-name"
                    value={form.firstName || ""}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label htmlFor="new-contact-last-name" className="block text-sm font-medium text-theme-darker mb-2">
                    Last Name
                  </label>
                  <Input
                    id="new-contact-last-name"
                    name="new-contact-last-name"
                    value={form.lastName || ""}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    placeholder="Last Name"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="new-contact-company" className="block text-sm font-medium text-theme-darker mb-2">
                  Company
                </label>
                <Input
                  id="new-contact-company"
                  name="new-contact-company"
                  value={form.company || ""}
                  onChange={(e) => updateField("company", e.target.value)}
                  placeholder="Company"
                />
              </div>
            </div>
          </Card>

          {/* CRM Fields Card */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-theme-darkest mb-4 flex items-center gap-2">
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
                <label htmlFor="new-contact-segment" className="block text-sm font-medium text-theme-darker mb-2">Segment</label>
                <Input
                  id="new-contact-segment"
                  value={form.segment || ""}
                  onChange={(e) => updateField("segment", e.target.value)}
                  placeholder="e.g., Enterprise, SMB, Individual"
                />
              </div>
              <div>
                <label htmlFor="new-contact-lead-source" className="block text-sm font-medium text-theme-darker mb-2">
                  Lead Source
                </label>
                <Input
                  id="new-contact-lead-source"
                  value={form.leadSource || ""}
                  onChange={(e) => updateField("leadSource", e.target.value)}
                  placeholder="e.g., Website, Referral, Event"
                />
              </div>
              <div>
                <label htmlFor="new-contact-engagement-score" className="block text-sm font-medium text-theme-darker mb-2">
                  Engagement Score
                </label>
                <Input
                  id="new-contact-engagement-score"
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
                <label htmlFor="new-contact-tags" className="block text-sm font-medium text-theme-darker mb-2">Tags</label>
                <Input
                  id="new-contact-tags"
                  name="new-contact-tags"
                  value={Array.isArray(form.tags) ? form.tags.join(", ") : ""}
                  onChange={(e) =>
                    updateField(
                      "tags",
                      e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  placeholder="tag1, tag2, tag3"
                />
                <p className="mt-2 text-xs text-theme-dark">
                  Enter tags separated by commas. Spaces within tags are allowed (e.g., &quot;Project Manager, Marketing Lead,Referral, VIP&quot;).
                </p>
              </div>
            </div>
          </Card>

          {/* Notes Card */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-theme-darkest mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
            <label htmlFor="new-contact-notes" className="sr-only">Notes</label>
            <Textarea
              id="new-contact-notes"
              name="new-contact-notes"
              rows={6}
              value={form.notes || ""}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Add notes about this contact..."
            />
          </Card>

          {/* Next Touchpoint Card */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-theme-darkest mb-4 flex items-center gap-2">
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
                <label htmlFor="new-contact-next-touchpoint-date" className="block text-sm font-medium text-theme-darker mb-2">Date</label>
                <Input
                  id="new-contact-next-touchpoint-date"
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
                <label htmlFor="new-contact-next-touchpoint-message" className="block text-sm font-medium text-theme-darker mb-2">Message</label>
                <Textarea
                  id="new-contact-next-touchpoint-message"
                  name="new-contact-next-touchpoint-message"
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
              variant="success"
              size="md"
              className="shadow-[rgba(34,32,29,0.1)_0px_2px_4px]
"
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
