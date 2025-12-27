import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { isPlaywrightTest } from "@/util/test-utils";
import CalendarData from "./_components/CalendarData";

export const metadata: Metadata = {
  title: "Schedule | Insight Loop CRM",
  description: "Plan your week with clarity—sessions, follow-ups, and focus time in one place",
};

export default async function CalendarPage() {
  // Bypass SSR auth redirect for E2E tests - let client-side auth handle it
  if (!isPlaywrightTest()) {
    try {
      await getUserId();
    } catch {
      redirect("/login");
    }
  }

  return <CalendarData />;
}

