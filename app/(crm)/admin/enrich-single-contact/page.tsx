"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import { reportException } from "@/lib/error-reporting";

interface ProcessResult {
  success: boolean;
  message: string;
  dryRun: boolean;
  contact: {
    email: string;
    contactId: string;
  };
  enriched?: {
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    photoUrl: string | null;
    source?: string;
  };
  current?: {
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    photoUrl?: string | null;
  };
  new?: {
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    photoUrl?: string | null;
  };
  action: "updated" | "skipped";
  reason?: string;
  updates?: string[];
  error?: string;
}

export default function EnrichSingleContactPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [emailInput, setEmailInput] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleProcess = async () => {
    if (!emailInput.trim()) {
      setError("Please enter at least one email address");
      return;
    }

    if (!user?.uid) {
      setError("User not authenticated");
      return;
    }

    // Parse email addresses (one per line or comma-separated)
    const emailLines = emailInput
      .split(/[,\n]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.includes("@"));

    if (emailLines.length === 0) {
      setError("No valid email addresses found");
      return;
    }

    if (!dryRun && !confirm(
      `This will enrich ${emailLines.length} contact(s) with first name, last name, company, and profile photo from Google People API. ` +
      "This action will modify your data. Continue?"
    )) {
      return;
    }

    setProcessing(true);
    setError(null);
    const newResults: ProcessResult[] = [];

    // Process emails sequentially to respect rate limits
    for (let i = 0; i < emailLines.length; i++) {
      const email = emailLines[i];

      try {
        const response = await fetch("/api/admin/enrich-single-contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            email,
            dryRun,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          newResults.push({
            success: false,
            message: data.error || "Processing failed",
            dryRun,
            contact: {
              email,
              contactId: "",
            },
            action: "skipped",
            error: data.message || data.error || "Unknown error",
          });
        } else {
          newResults.push(data);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        newResults.push({
          success: false,
          message: "Processing failed",
          dryRun,
          contact: {
            email,
            contactId: "",
          },
          action: "skipped",
          error: errorMessage,
        });
        reportException(err, {
          context: "Enriching single contact with People API",
          tags: { component: "EnrichSingleContactPage", email },
        });
      }

      // Add delay between requests to respect rate limits (200ms)
      if (i < emailLines.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    setResults(newResults);
    setProcessing(false);
  };

  const handleClear = () => {
    setEmailInput("");
    setResults([]);
    setError(null);
  };

  if (authLoading) {
    return <Loading />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Enrich Single Contact</h1>
        <p className="text-theme-dark text-lg">
          Process individual email addresses through Google People API to enrich contact information
        </p>
      </div>

      <Card padding="md" className="bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-blue-600 shrink-0 mt-0.5"
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
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">How it works</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Enter one or more email addresses (one per line or comma-separated)</li>
              <li>Uses Google People API to search for matching contacts</li>
              <li>Extracts first name, last name, company, and profile photo from Google Contacts</li>
              <li>Prioritizes People API data over existing Firestore data</li>
              <li>Falls back to existing Firestore data or email extraction if People API doesn&apos;t have the contact</li>
              <li>Processes sequentially with rate limiting to respect API quotas</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className="space-y-4">
          <div>
            <label htmlFor="emailInput" className="block text-sm font-medium text-theme-darker mb-2">
              Email Address(es)
            </label>
            <Textarea
              id="emailInput"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter email addresses, one per line or comma-separated&#10;Example:&#10;john.doe@example.com&#10;jane.smith@company.com"
              rows={6}
              disabled={processing}
              className="font-mono text-sm"
            />
            <p className="text-xs text-theme-dark mt-2">
              You can enter multiple email addresses separated by commas or new lines
            </p>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-sm">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={processing}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="dryRun" className="text-sm font-medium text-theme-darker cursor-pointer">
              Dry run (preview changes without updating)
            </label>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleProcess}
              disabled={processing || !emailInput.trim()}
              loading={processing}
              variant={dryRun ? "primary" : "danger"}
              size="lg"
              className="flex-1"
            >
              {processing ? "Processing..." : dryRun ? "Preview Changes" : "Enrich and Update"}
            </Button>
            {results.length > 0 && (
              <Button
                onClick={handleClear}
                disabled={processing}
                variant="outline"
                size="lg"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <Card padding="md" className="bg-red-50 border-red-200">
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
        </Card>
      )}

      {results.length > 0 && (
        <Card padding="md" className="bg-green-50 border-green-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-green-900">
                Results ({results.length} processed)
              </h3>
              <div className="text-sm text-green-800">
                {results.filter((r) => r.action === "updated").length} updated,{" "}
                {results.filter((r) => r.action === "skipped").length} skipped
              </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-sm border ${
                    result.action === "updated"
                      ? "bg-white border-green-300"
                      : result.error
                      ? "bg-red-50 border-red-300"
                      : "bg-yellow-50 border-yellow-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-theme-darkest mb-1">
                        {result.contact.email}
                      </div>
                      {result.enriched?.source && (
                        <span className="text-xs text-gray-500">
                          Source: {result.enriched.source === "people_api" ? "People API" : "Email extraction"}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        result.action === "updated"
                          ? "bg-green-100 text-green-800"
                          : result.error
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {result.action === "updated" ? "Updated" : result.error ? "Error" : "Skipped"}
                    </span>
                  </div>

                  {result.error && (
                    <div className="text-sm text-red-600 mb-2">{result.error}</div>
                  )}

                  {result.reason && (
                    <div className="text-sm text-gray-600 mb-2">{result.reason}</div>
                  )}

                  {result.action === "updated" && result.current && result.new && (
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Current:</p>
                          <div className="text-theme-dark">
                            <div>
                              {result.current.firstName || "—"} {result.current.lastName || "—"}
                            </div>
                            {result.current.company && (
                              <div className="text-xs text-gray-600">{result.current.company}</div>
                            )}
                            {result.current.photoUrl && (
                              <div className="text-xs text-gray-600">
                                Photo: {result.current.photoUrl.includes('/cm/') ? "Default avatar" : "Yes"}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">New:</p>
                          <div className="text-theme-dark">
                            <div>
                              {result.new.firstName || "—"} {result.new.lastName || "—"}
                            </div>
                            {result.new.company && (
                              <div className="text-xs text-gray-600">{result.new.company}</div>
                            )}
                            {result.new.photoUrl && (
                              <div className="text-xs text-gray-600">
                                Photo: {result.new.photoUrl.includes('/cm/') ? "Default avatar" : "Yes"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {result.updates && result.updates.length > 0 && (
                        <div className="text-xs text-gray-500 mt-2">
                          Updated fields: {result.updates.join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {result.action === "skipped" && result.current && (
                    <div className="text-sm text-theme-dark">
                      <div>
                        {result.current.firstName || "—"} {result.current.lastName || "—"}
                      </div>
                      {result.current.company && (
                        <div className="text-xs text-gray-600">{result.current.company}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card padding="md" className="bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5"
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
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-900 mb-1">Requirements</h3>
            <p className="text-xs text-yellow-800">
              For this to work, you need to:
            </p>
            <ul className="text-xs text-yellow-800 list-disc list-inside mt-2 space-y-1">
              <li>Have your Google account linked to the CRM</li>
              <li>Have granted the contacts.readonly scope (may require re-authentication)</li>
              <li>Have contacts in your Google Contacts that match the email addresses</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

