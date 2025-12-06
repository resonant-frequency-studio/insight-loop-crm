import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";

export async function GET() {
  try {
    await getUserId();
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

