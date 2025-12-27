import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { isPlaywrightTest } from "@/util/test-utils";
import CalendarDevPreview from "./_components/CalendarDevPreview";

export const metadata: Metadata = {
  title: "Schedule Dev Preview | Insight Loop CRM",
  description: "Development preview of calendar with fixture events",
};

export default async function CalendarDevPage() {
  // Only allow in development or with admin flag
  const isDev = process.env.NODE_ENV === "development";
  const isTest = isPlaywrightTest();
  
  if (!isDev && !isTest) {
    redirect("/schedule");
  }

  // Bypass SSR auth redirect for E2E tests
  if (!isTest) {
    try {
      await getUserId();
    } catch {
      redirect("/login");
    }
  }

  return <CalendarDevPreview />;
}

