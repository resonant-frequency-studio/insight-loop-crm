import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getAccessToken } from "@/lib/gmail/get-access-token";

/**
 * Proxy endpoint for Google People API contact photos
 * Fetches the photo with proper authentication and serves it
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const photoUrl = searchParams.get("url");

    if (!photoUrl) {
      return NextResponse.json({ error: "Missing photo URL" }, { status: 400 });
    }

    const userId = await getUserId();
    const accessToken = await getAccessToken(userId);

    // Fetch the photo with authentication
    const photoResponse = await fetch(photoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!photoResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch photo" },
        { status: photoResponse.status }
      );
    }

    // Get the image data
    const imageBuffer = await photoResponse.arrayBuffer();
    const contentType = photoResponse.headers.get("content-type") || "image/jpeg";

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    // If authentication fails, return 404 to trigger fallback to initials
    if (error instanceof Error && error.message.includes("No Gmail account linked")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to fetch photo" },
      { status: 500 }
    );
  }
}

