import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { isPlaywrightTest } from "@/util/test-utils";
import SyncData from "./_components/SyncData";

export const metadata: Metadata = {
  title: "Google Sync Status | Insight Loop CRM",
  description: "Monitor your Gmail, Calendar, and Contacts synchronization status and history",
};

export default async function SyncStatusPage() {
  // Bypass SSR auth redirect for E2E tests - let client-side auth handle it
  if (!isPlaywrightTest()) {
    try {
      await getUserId();
    } catch {
      redirect("/login");
    }
  }

  return (
    <div className="space-y-8">
      {/* Static Header - renders immediately */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Google Sync Status</h1>
          <p className="text-theme-dark text-lg">
            Monitor your Gmail, Calendar, and Contacts synchronization status and history
          </p>
        </div>
      </div>

      {/* Data-dependent content - only dynamic data is suspended */}
      <SyncData />
    </div>
  );
}
