import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

export async function getUserId(): Promise<string> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("__session")?.value;
  if (!cookie) {
    throw new Error("No session cookie found.");
  }
  const decoded = await adminAuth.verifySessionCookie(cookie);
  return decoded.uid;
}

