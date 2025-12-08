import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import SyncData from "./_components/SyncData";

export const metadata: Metadata = {
  title: "Gmail Sync Status | Insight Loop CRM",
  description: "Monitor your email synchronization status and history",
};

export default async function SyncStatusPage() {
  try {
    await getUserId();
  } catch {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      {/* Static Header - renders immediately */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Gmail Sync Status</h1>
          <p className="text-gray-600 text-lg">
            Monitor your email synchronization status and history
          </p>
        </div>
      </div>

      {/* Data-dependent content - only dynamic data is suspended */}
      <SyncData />
    </div>
  );
}
