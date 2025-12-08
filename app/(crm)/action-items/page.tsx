import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import ActionItemsList from "./_components/ActionItemsList";

export const metadata: Metadata = {
  title: "Action Items | Insight Loop CRM",
  description: "Manage tasks and action items across all your contacts",
};

export default async function ActionItemsPage() {
  try {
    await getUserId();
  } catch {
    redirect("/login");
  }

  return <ActionItemsList />;
}
