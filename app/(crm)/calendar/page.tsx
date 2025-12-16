import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { isPlaywrightTest } from "@/util/test-utils";
import CalendarData from "./_components/CalendarData";

export const metadata: Metadata = {
  title: "Calendar | Insight Loop CRM",
  description: "View and manage your calendar events",
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

