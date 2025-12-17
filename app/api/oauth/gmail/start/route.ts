import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const forceReauth = searchParams.get("force") === "true";
  
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    access_type: "offline",    // crucial for refresh tokens
    // Use "consent" to force re-authorization with new scopes, "select_account" for normal flow
    prompt: forceReauth ? "consent select_account" : "select_account",
    scope: process.env.GOOGLE_OAUTH_SCOPES!,
  });

  return NextResponse.redirect(
    "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString()
  );
}
