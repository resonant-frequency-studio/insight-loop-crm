import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { isPlaywrightTest } from "@/util/test-utils";
import InsightsPageClient from "./InsightsPageClient";

export const metadata: Metadata = {
  title: "Insights | Insight Loop CRM",
  description: "Understand relationship health, surface risks early, and focus where it matters most",
};

export default async function InsightsPage() {
  let userId: string | null = null;

  if (!isPlaywrightTest()) {
    try {
      userId = await getUserId();
    } catch {
      redirect("/login");
    }
  } else {
    // In E2E mode, userId might be empty initially, client-side auth will handle it
    try {
      userId = await getUserId();
    } catch {
      userId = null;
    }
  }

  return <InsightsPageClient userId={userId} />;
}

