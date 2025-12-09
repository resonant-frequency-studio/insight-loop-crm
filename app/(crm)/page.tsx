import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { isPlaywrightTest } from "@/util/test-utils";
import DashboardData from "./_components/DashboardData";

export const metadata: Metadata = {
  title: "Dashboard | Insight Loop CRM",
  description: "Overview of your contacts and engagement metrics",
};

export default async function DashboardPage() {
  // Bypass SSR auth redirect for E2E tests - let client-side auth handle it
  if (!isPlaywrightTest()) {
    try {
      await getUserId();
    } catch {
      redirect("/login");
    }
  }

  return <DashboardData />;
}
