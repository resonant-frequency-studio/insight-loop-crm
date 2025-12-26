import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { runExportJob } from "@/lib/google-contacts/export-contacts-runner";
import { reportException } from "@/lib/error-reporting";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();

    const { contactIds, groupId, groupName } = body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Group is optional - if neither provided, contacts will be created without adding to a group

    // Generate export job ID
    const exportJobId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start export job asynchronously (fire-and-forget pattern)
    runExportJob({
      userId,
      exportJobId,
      contactIds,
      groupId,
      groupName,
    }).catch((error) => {
      reportException(error, {
        context: "Error starting export job",
        tags: { component: "export-to-google-api", userId, exportJobId },
      });
    });

    // Return immediately with job ID
    return NextResponse.json({ exportJobId }, { status: 200 });
  } catch (error) {
    reportException(error, {
      context: "Export to Google API error",
      tags: { component: "export-to-google-api" },
    });

    return NextResponse.json(
      {
        error: "Failed to start export",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

