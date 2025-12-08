import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import ContactsList from "./_components/ContactsList";

export const metadata: Metadata = {
  title: "Contacts | Insight Loop CRM",
  description: "View and manage all your contacts",
};

export default async function ContactsPage() {
  try {
    await getUserId();
  } catch {
    redirect("/login");
  }

  return <ContactsList />;
}
