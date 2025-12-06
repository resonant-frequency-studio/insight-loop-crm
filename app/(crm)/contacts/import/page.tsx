"use client";

import { useContactImportPage } from "@/hooks/useContactImportPage";
import Modal from "@/components/Modal";
import Card from "@/components/Card";
import Loading from "@/components/Loading";

export default function ImportContactsPage() {
  const {
    user,
    loading,
    fileInputRef,
    showOverwriteModal,
    handleCancelModal,
    existingContactsCount,
    overwriteMode,
    setOverwriteMode,
    isParsing,
    csvStatus,
    parseError,
    importState,
    handleUpload,
    handleStartImport,
    cancel,
  } = useContactImportPage();

  if (loading) {
    return <Loading />;
  }
  
  if (!user) return null;

  // Determine the status message to display
  const status = csvStatus || importState.status;
  const isImporting = importState.isImporting || isParsing;
  const hasError = parseError || importState.status.includes("Error");

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Import Contacts</h1>
        <p className="text-gray-600 text-lg">
          Upload a CSV file to import contacts into your CRM
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CSV Format Guide - Top on mobile, Right on desktop */}
        <div className="lg:col-span-1 space-y-6 order-1 lg:order-2">
          <Card padding="md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CSV Format Guide</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Required columns:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <code className="bg-gray-100 px-1 rounded">Email</code> - Contact email address
                </li>
              </ul>
              <p className="font-medium text-gray-900 mt-4">Optional columns:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <code className="bg-gray-100 px-1 rounded">FirstName</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">LastName</code>
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">Summary</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">Notes</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">Tags</code>
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">Segment</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">LeadSource</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">EngagementScore</code>
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">NextTouchpointDate</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">NextTouchpointMessage</code>
                </li>
                <li>And other CRM fields as needed</li>
              </ul>
            </div>
          </Card>
        </div>

        {/* Upload Card - Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
      <Card padding="lg">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">CSV File Upload</h2>
          <p className="text-sm text-gray-500">
                Select a CSV file with contact information. The file should include columns like
                Email, FirstName, LastName, and other CRM fields.
          </p>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors duration-200">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleUpload}
            disabled={isImporting}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className={`cursor-pointer flex flex-col items-center ${
              isImporting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900 mb-1">
              {isImporting ? "Importing..." : "Click to upload CSV file"}
            </p>
                <p className="text-sm text-gray-500">CSV files only (max size: 10MB)</p>
          </label>
        </div>

        {/* Status Messages */}
        {status && (
          <div
            className={`mt-6 p-4 rounded-lg ${
                  hasError
                ? "bg-red-50 border border-red-200"
                : status.includes("complete") || status.includes("Successfully")
                ? "bg-green-50 border border-green-200"
                : "bg-blue-50 border border-blue-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {isImporting ? (
                <svg
                  className="animate-spin h-5 w-5 text-blue-600"
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
                  ) : hasError ? (
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
              ) : (
                <svg
                  className="w-5 h-5 text-green-600"
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
              )}
              <div>
                <p
                  className={`font-medium ${
                        hasError
                      ? "text-red-800"
                      : status.includes("complete") || status.includes("Successfully")
                      ? "text-green-800"
                      : "text-blue-800"
                  }`}
                >
                  {status}
                </p>
                    {isImporting && importState.importCount > 0 && (
                  <p className="text-sm text-blue-600 mt-1">
                        Processed {importState.importCount} contacts...
                  </p>
                )}
                    {importState.errorDetails.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-red-600 hover:text-red-800">
                          View {importState.errorDetails.length} error
                          {importState.errorDetails.length > 1 ? "s" : ""}
                    </summary>
                    <ul className="mt-2 space-y-1 text-red-700 max-h-40 overflow-y-auto">
                          {importState.errorDetails.map((err, idx) => (
                            <li key={idx} className="text-xs">
                              {err}
                            </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

            {/* Cancel button if importing */}
        {isImporting && (
          <div className="mt-4 text-center">
            <button
                  onClick={cancel}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Cancel Import
            </button>
          </div>
        )}
      </Card>
        </div>
      </div>

            {/* Overwrite Modal */}
      <Modal isOpen={showOverwriteModal} onClose={handleCancelModal} title="Import Options">
        <p className="text-gray-600 mb-4">
          Found {existingContactsCount} existing contact
          {existingContactsCount !== 1 ? "s" : ""} in your database that match contacts in the
          CSV file.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          How would you like to handle existing contacts?
        </p>
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="overwriteMode"
              value="overwrite"
              checked={overwriteMode === "overwrite"}
              onChange={() => setOverwriteMode("overwrite")}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-gray-900">Overwrite existing contacts</div>
              <div className="text-sm text-gray-500">
                Replace all fields in existing contacts with data from the CSV. This will
                overwrite any modifications you&apos;ve made.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="overwriteMode"
              value="skip"
              checked={overwriteMode === "skip"}
              onChange={() => setOverwriteMode("skip")}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-gray-900">Skip existing contacts</div>
              <div className="text-sm text-gray-500">
                Only import new contacts. Existing contacts will be left unchanged, preserving
                your modifications.
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleCancelModal}
            disabled={isImporting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (overwriteMode) {
                handleStartImport();
              }
            }}
            disabled={!overwriteMode || isImporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Continue Import
          </button>
        </div>
      </Modal>
    </div>
  );
}
