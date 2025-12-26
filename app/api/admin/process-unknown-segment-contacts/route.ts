import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { reportException } from "@/lib/error-reporting";
import { runProcessUnknownSegmentJob } from "@/lib/admin/process-unknown-segment-runner";

/**
 * POST /api/admin/process-unknown-segment-contacts
 * Start a background job to process all "Unknown" segment contacts
 * Returns immediately with jobId for progress tracking
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    const { dryRun = false, segment = "Unknown", limit = 10000, batchSize = 5 } = await request.json();

    if (!segment || typeof segment !== "string" || !segment.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Segment is required",
        },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const jobId = `process_segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start the job asynchronously (fire-and-forget)
    runProcessUnknownSegmentJob({
      userId,
      jobId,
      dryRun,
      segment: segment.trim(),
      limit: limit === "" ? 10000 : parseInt(limit, 10),
      batchSize,
    }).catch((error) => {
      reportException(error, {
        context: "Background process unknown segment job error",
        tags: { component: "process-unknown-segment-api", jobId },
      });
    });

    return NextResponse.json({
      ok: true,
      jobId,
      message: "Processing job started. Track progress via admin job status.",
    });
  } catch (error) {
    reportException(error as Error, {
      context: "Error starting process unknown segment job",
      tags: { component: "process-unknown-segment-api" },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
