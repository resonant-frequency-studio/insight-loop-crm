import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getAccessToken } from "@/lib/gmail/get-access-token";
import { listContactGroups } from "@/lib/google-people/contact-groups";
import { reportException } from "@/lib/error-reporting";

export async function GET() {
  try {
    const userId = await getUserId();
    const accessToken = await getAccessToken(userId);

    const groups = await listContactGroups(accessToken);

    return NextResponse.json({
      groups: groups.map((group) => ({
        resourceName: group.resourceName,
        name: group.name || group.formattedName || "",
      })),
    });
  } catch (error) {
    reportException(error, {
      context: "Fetching contact groups",
      tags: { component: "contacts-groups-api" },
    });

    return NextResponse.json(
      {
        error: "Failed to fetch contact groups",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

