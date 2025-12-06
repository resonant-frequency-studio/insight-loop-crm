import type { Firestore } from "firebase-admin/firestore";

export async function findContactIdByEmail(
  db: Firestore,
  userId: string,
  email: string
): Promise<string | null> {
  if (!email) return null;

  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("contacts")
    .where("primaryEmail", "==", email)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].id;
}