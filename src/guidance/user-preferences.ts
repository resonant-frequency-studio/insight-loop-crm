import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import type { UserGuidancePreferences } from "@/types/guidance";
import { DEFAULT_GUIDANCE_PREFERENCES } from "@/types/guidance";

const GUIDANCE_SETTINGS_PATH = (userId: string) => `users/${userId}/settings/guidance`;

/**
 * Get user guidance preferences from Firestore
 */
export async function getUserGuidancePreferences(
  userId: string
): Promise<UserGuidancePreferences> {
  try {
    const docRef = doc(db, GUIDANCE_SETTINGS_PATH(userId));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return DEFAULT_GUIDANCE_PREFERENCES;
    }

    const data = docSnap.data();
    return {
      guidanceEnabled: data.guidanceEnabled ?? true,
      hasSeenDashboardOrientation: data.hasSeenDashboardOrientation ?? false,
      lastTourRouteKey: data.lastTourRouteKey ?? null,
      lastTourStepIndex: data.lastTourStepIndex ?? null,
      dismissedNudges: data.dismissedNudges ?? {},
    };
  } catch (error) {
    // If permission denied or other error, return defaults
    // This prevents the app from crashing if rules aren't deployed yet
    console.warn("Failed to load guidance preferences, using defaults:", error);
    return DEFAULT_GUIDANCE_PREFERENCES;
  }
}

/**
 * Update user guidance preferences in Firestore
 */
export async function updateUserGuidancePreferences(
  userId: string,
  updates: Partial<UserGuidancePreferences>
): Promise<void> {
  try {
    const docRef = doc(db, GUIDANCE_SETTINGS_PATH(userId));
    await setDoc(
      docRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // Log error but don't throw - preferences are non-critical
    console.warn("Failed to update guidance preferences:", error);
    // Re-throw so caller can handle if needed
    throw error;
  }
}

