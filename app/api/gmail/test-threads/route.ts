import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/gmail/get-access-token";
import { getUserId } from "@/lib/auth-utils";

export async function GET() {
  const userId = await getUserId();
  const accessToken = await getAccessToken(userId);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=10",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await res.json();

  return NextResponse.json(data);
}
