import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getUserId } from "@/lib/auth-utils";
import { reportException } from "@/lib/error-reporting";

/**
 * POST /api/oauth/gmail/disconnect
 * Clear Google account tokens to force re-authentication
 */
export async function POST() {
  try {
    const userId = await getUserId();
    
    // Delete the Google account document to force re-authentication
    await adminDb.collection("googleAccounts").doc(userId).delete();
    
    return NextResponse.json({ 
      success: true,
      message: "Google account disconnected. You can reconnect with updated permissions."
    });
  } catch (error) {
    reportException(error, {
      context: "Disconnecting Google account",
      tags: { component: "oauth-disconnect" },
    });
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

