import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { isPlaywrightTest } from "@/util/test-utils";
import ChartsPageClient from "./ChartsPageClient";

export const metadata: Metadata = {
  title: "Charts | Insight Loop CRM",
  description: "Visual analytics and insights for your contacts",
};

export default async function ChartsPage() {
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

  return <ChartsPageClient userId={userId} />;
}

