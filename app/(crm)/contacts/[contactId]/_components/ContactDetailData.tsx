import { notFound } from "next/navigation";
import { getUserId } from "@/lib/auth-utils";
import { getContactForUser } from "@/lib/contacts-server";
import { isPlaywrightTest } from "@/util/test-utils";
import ContactDetailPageClientWrapper from "./ContactDetailPageClientWrapper";

interface ContactDetailDataProps {
  contactId: string;
}

export default async function ContactDetailData({ contactId }: ContactDetailDataProps) {
  // In E2E mode, try to get userId but don't fail if cookie isn't ready yet
  let userId: string | null = null;
  const decodedContactId = decodeURIComponent(contactId);

  if (isPlaywrightTest()) {
    try {
      userId = await getUserId();
    } catch {
      // In E2E mode, cookie might not be recognized by SSR yet
      userId = null;
    }
  } else {
    userId = await getUserId();
  }

  // Check if contact exists for metadata generation and initial notFound() handling
  // Client-side will use real-time listeners for data fetching
  if (userId) {
    const contact = await getContactForUser(userId, decodedContactId);
    if (!contact) {
      // In E2E mode, don't call notFound() immediately - let client-side handle it
      // This allows tests to create contacts and immediately navigate to them
      if (!isPlaywrightTest()) {
        notFound();
      }
      // In E2E mode, continue - the client-side component will fetch and handle notFound if needed
    }
  }

  // Client wrapper will get userId from useAuth and use Firebase real-time listeners
  return <ContactDetailPageClientWrapper contactId={decodedContactId} />;
}

