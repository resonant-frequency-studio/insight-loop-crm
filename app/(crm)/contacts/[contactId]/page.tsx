import { redirect, notFound } from "next/navigation";
import { Metadata } from "next";
import { getUserId } from "@/lib/auth-utils";
import { getContactForUser } from "@/lib/contacts-server";
import { getDisplayName } from "@/util/contact-utils";
import ContactDetailData from "./_components/ContactDetailData";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ contactId: string }>;
}): Promise<Metadata> {
  let userId: string;
  try {
    userId = await getUserId();
  } catch {
    return {
      title: "Contact | Insight Loop CRM",
    };
  }

  const { contactId } = await params;
  const decodedContactId = decodeURIComponent(contactId);
  const contact = await getContactForUser(userId, decodedContactId);

  if (!contact) {
    return {
      title: "Contact Not Found | Insight Loop CRM",
    };
  }

  const displayName = getDisplayName(contact);

  return {
    title: `${displayName} | Insight Loop CRM`,
    description: `View and manage ${displayName}'s contact information and action items`,
  };
}

interface ContactDetailPageProps {
  params: Promise<{
    contactId: string;
  }>;
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  try {
    await getUserId();
  } catch {
    redirect("/login");
  }

  const { contactId } = await params;
  
  if (!contactId) {
    notFound();
  }

  return <ContactDetailData contactId={contactId} />;
}
