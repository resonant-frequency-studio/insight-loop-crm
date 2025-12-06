import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  const { idToken } = await req.json();

  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token" }, { status: 400 });
  }

  // Set 5-day session cookie
  const expiresIn = 5 * 24 * 60 * 60 * 1000;

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "__session",
    value: sessionCookie,
    httpOnly: true,
    maxAge: expiresIn / 1000,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "__session",
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
