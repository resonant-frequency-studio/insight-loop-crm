"use client";

import { useState, useRef, DragEvent } from "react";
import { useContactImportPage } from "@/hooks/useContactImportPage";
import Modal from "@/components/Modal";
import Card from "@/components/Card";
import Loading from "@/components/Loading";
import { Button } from "@/components/Button";
import Link from "next/link";

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

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const dragCounter = useRef(0);

  if (loading) {
    return <Loading />;
  }

  if (!user) return null;

  // Determine the status message to display
  const status = csvStatus || importState.status;
  const isImporting = importState.isImporting || isParsing;
  const hasError = parseError || importState.status.includes("Error");
  const isSuccess = status.includes("complete") || status.includes("Successfully");
  const isChecking = status.includes("Checking for existing contacts");
  const isProcessing = isImporting || isChecking || isParsing;

  // Handle drag and drop
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (isImporting) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        if (fileInputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInputRef.current.files = dataTransfer.files;
          const event = new Event("change", { bubbles: true });
          fileInputRef.current.dispatchEvent(event);
        }
      }
    }
  };

  // Enhanced upload handler to capture file info
  const handleUploadWithInfo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      setFileSize(formatFileSize(file.size));
    } else {
      setSelectedFileName(null);
      setFileSize(null);
    }
    handleUpload(e);
  };

  // Reset file info when modal is cancelled
  const handleCancelModalWithReset = () => {
    setSelectedFileName(null);
    setFileSize(null);
    handleCancelModal();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // Download sample CSV
  const downloadSampleCsv = () => {
    const sampleData = [
      ["Email", "FirstName", "LastName", "Segment", "LeadSource", "Tags", "Notes"],
      ["john.doe@example.com", "John", "Doe", "Active Client", "Website", "VIP, Priority", "Interested in premium services"],
      ["jane.smith@example.com", "Jane", "Smith", "Prospect", "Referral", "Follow-up", "Referred by John Doe"],
    ];
    const csvContent = sampleData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-contacts.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Import Contacts</h1>
        <p className="text-theme-dark text-lg">
          Upload a CSV file to import contacts into your CRM
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* CSV Format Guide - Top on mobile, Right on desktop */}
        <div className="xl:col-span-1 space-y-6 order-1 xl:order-2">
          <Card padding="md">
            <h3 className="text-lg font-semibold text-theme-darkest mb-2">CSV Format Guide</h3>
            <p className="text-sm text-theme-dark mb-4">
              Download a sample CSV template or review the required format below.
            </p>
            <Button
              onClick={downloadSampleCsv}
              variant="outline"
              size="sm"
              fullWidth
              className="mb-4"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Download Sample CSV
            </Button>
            <div className="space-y-3 text-sm text-theme-dark">
              <div>
                <p className="font-medium text-theme-darkest mb-2">Required columns:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">Email</code> - Contact email address
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-theme-darkest mt-4 mb-2">Optional columns:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">FirstName</code>,{" "}
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">LastName</code>
                  </li>
                  <li>
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">Summary</code>,{" "}
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">Notes</code>,{" "}
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">Tags</code>
                  </li>
                  <li>
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">Segment</code>,{" "}
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">LeadSource</code>,{" "}
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">EngagementScore</code>
                  </li>
                  <li>
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">NextTouchpointDate</code>,{" "}
                    <code className="bg-theme-light text-foreground px-1.5 py-0.5 rounded text-xs font-mono">NextTouchpointMessage</code>
                  </li>
                  <li className="text-xs text-theme-darker mt-2">And other CRM fields as needed</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Upload Card - Left Column (2/3) */}
        <div className="xl:col-span-2 space-y-6 order-2 xl:order-1">
      <Card padding="lg">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-theme-darkest mb-2">CSV File Upload</h2>
          <p className="text-sm text-gray-500">
                Select a CSV file with contact information. The file should include columns like
                Email, FirstName, LastName, and other CRM fields.
          </p>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : isImporting
              ? "border-gray-300 bg-gray-50"
              : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/30"
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleUploadWithInfo}
            disabled={isImporting}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className={`flex flex-col items-center ${
              isImporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
              isDragging ? "bg-blue-200" : "bg-blue-100"
            }`}>
              <svg
                className={`w-8 h-8 transition-colors ${
                  isDragging ? "text-blue-700" : "text-blue-600"
                }`}
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
            {selectedFileName && !isImporting ? (
              <div className="mb-2">
                <p className="text-lg font-medium text-theme-darkest mb-1">{selectedFileName}</p>
                {fileSize && (
                  <p className="text-sm text-gray-500">Size: {fileSize}</p>
                )}
              </div>
            ) : (
              <>
                <p className="text-lg font-medium text-theme-darkest mb-1">
                  {isImporting ? "Importing..." : isDragging ? "Drop CSV file here" : "Click to upload or drag and drop"}
                </p>
                <p className="text-sm text-gray-500">CSV files only (max size: 10MB)</p>
              </>
            )}
          </label>
        </div>

        {/* Progress Bar - Checking for existing contacts */}
        {isChecking && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-theme-darker">Checking for existing contacts</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div className="bg-blue-600 h-2.5 rounded-full animate-progress-bar relative"></div>
            </div>
          </div>
        )}

        {/* Progress Bar - Import Progress */}
        {isImporting && importState.progress && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-theme-darker">Import Progress</span>
              <span className="text-sm text-gray-500">
                {importState.importCount} / {importState.progress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${((importState.importCount + importState.progress.errors) / importState.progress.total) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Warning Message - Don't refresh or navigate away */}
        {isProcessing && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-sm">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 mt-0.5 shrink-0"
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
              <div>
                <p className="font-medium text-amber-800 mb-1">Please do not refresh or navigate away</p>
                <p className="text-sm text-amber-700">
                  {isChecking
                    ? "We're checking your existing contacts. This process will be interrupted if you leave this page."
                    : "The import is in progress. Refreshing or navigating away will cancel the import and you'll need to start over."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {status && (
          <div
            className={`mt-6 p-4 rounded-sm ${
              hasError
                ? "bg-red-50 border border-red-200"
                : isSuccess
                ? "bg-green-50 border border-green-200"
                : "bg-blue-50 border border-blue-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {isImporting ? (
                <svg
                  className="animate-spin h-5 w-5 text-blue-600 mt-0.5"
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
                  className="w-5 h-5 text-red-600 mt-0.5"
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
                  className="w-5 h-5 text-green-600 mt-0.5"
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
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    hasError
                      ? "text-red-800"
                      : isSuccess
                      ? "text-green-800"
                      : "text-blue-800"
                  }`}
                >
                  {status}
                </p>
                {isImporting && importState.importCount > 0 && (
                  <p className="text-sm text-blue-600 mt-1">
                    Processed {importState.importCount} of {importState.progress?.total || "?"} contacts...
                  </p>
                )}
                {importState.errorDetails.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-red-600 hover:text-red-800 font-medium">
                      View {importState.errorDetails.length} error
                      {importState.errorDetails.length > 1 ? "s" : ""}
                    </summary>
                    <ul className="mt-2 space-y-1 text-red-700 max-h-40 overflow-y-auto pl-4">
                      {importState.errorDetails.map((err, idx) => (
                        <li key={idx} className="text-xs list-disc">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {isSuccess && importState.progress && (
                  <div className="mt-3 flex gap-3">
                    <Link href="/contacts">
                      <Button variant="primary" size="sm">
                        View Contacts
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedFileName(null);
                        setFileSize(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      Import More
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

            {/* Cancel button if importing */}
        {isImporting && (
          <div className="mt-4 text-center">
            <Button
              onClick={cancel}
              variant="link"
              size="sm"
            >
              Cancel Import
            </Button>
          </div>
        )}
      </Card>
        </div>
      </div>

            {/* Overwrite Modal */}
      <Modal isOpen={showOverwriteModal} onClose={handleCancelModalWithReset} title="Import Options">
        <p className="text-theme-dark mb-4">
          Found {existingContactsCount} existing contact
          {existingContactsCount !== 1 ? "s" : ""} in your database that match contacts in the
          CSV file.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          How would you like to handle existing contacts?
        </p>
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-sm cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="overwriteMode"
              value="overwrite"
              checked={overwriteMode === "overwrite"}
              onChange={() => setOverwriteMode("overwrite")}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-theme-darkest">Overwrite existing contacts</div>
              <div className="text-sm text-gray-500">
                Replace all fields in existing contacts with data from the CSV. This will
                overwrite any modifications you&apos;ve made.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-sm cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="overwriteMode"
              value="skip"
              checked={overwriteMode === "skip"}
              onChange={() => setOverwriteMode("skip")}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-theme-darkest">Skip existing contacts</div>
              <div className="text-sm text-gray-500">
                Only import new contacts. Existing contacts will be left unchanged, preserving
                your modifications.
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            onClick={handleCancelModalWithReset}
            disabled={isImporting}
            variant="secondary"
            size="md"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (overwriteMode) {
                handleStartImport();
              }
            }}
            disabled={!overwriteMode || isImporting}
            variant="primary"
            size="md"
          >
            Continue Import
          </Button>
        </div>
      </Modal>
    </div>
  );
}
