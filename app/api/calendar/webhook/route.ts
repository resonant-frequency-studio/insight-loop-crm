import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getChannelByToken } from "@/lib/calendar/channel-storage";
import { reportException } from "@/lib/error-reporting";

/**
 * POST /api/calendar/webhook
 * Webhook endpoint to receive Google Calendar push notifications
 * 
 * Google Calendar sends notifications when calendar events change.
 * We validate the request and then process the notification.
 */
export async function POST(req: Request) {
  try {
    // Get webhook token from header
    const webhookToken = req.headers.get("X-Goog-Channel-Token");
    
    // Validate webhook secret if configured (optional additional security layer)
    // Note: Google Calendar doesn't send custom headers, so this secret won't be
    // validated for Google's direct webhook calls. It's useful if you're using
    // a proxy or want additional validation for internal calls.
    // Primary security is via X-Goog-Channel-Token validation below.
    const webhookSecret = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = req.headers.get("X-Webhook-Secret");
      // If secret is provided, validate it (for proxy/internal use cases)
      if (providedSecret && providedSecret !== webhookSecret) {
        reportException(new Error("Invalid webhook secret"), {
          context: "Calendar webhook validation",
          tags: { component: "calendar-webhook" },
        });
        return NextResponse.json(
          { error: "Unauthorized - invalid webhook secret" },
          { status: 401 }
        );
      }
    }

    if (!webhookToken) {
      // Google sends a sync notification without token on initial subscription
      // We should handle this gracefully if secret validation passed
      const body = await req.json().catch(() => ({}));
      if (body.type === "sync") {
        // Initial sync notification - acknowledge it
        return NextResponse.json({ ok: true, message: "Sync notification received" });
      }
      
      return NextResponse.json(
        { error: "Missing X-Goog-Channel-Token header" },
        { status: 401 }
      );
    }

    // Validate token and get channel
    const channel = await getChannelByToken(adminDb, webhookToken);
    if (!channel) {
      reportException(new Error("Invalid webhook token"), {
        context: "Calendar webhook validation",
        tags: { component: "calendar-webhook" },
        extra: { webhookToken: webhookToken.substring(0, 8) + "..." },
      });
      return NextResponse.json(
        { error: "Invalid webhook token" },
        { status: 401 }
      );
    }

    // Get notification headers
    const channelId = req.headers.get("X-Goog-Channel-ID");
    const resourceId = req.headers.get("X-Goog-Resource-ID");
    const resourceState = req.headers.get("X-Goog-Resource-State");

    // Validate channel ID matches
    if (channelId !== channel.channelId) {
      reportException(new Error("Channel ID mismatch"), {
        context: "Calendar webhook validation",
        tags: { 
          component: "calendar-webhook", 
          channelId: channelId || "missing", 
          expectedChannelId: channel.channelId 
        },
      });
      return NextResponse.json(
        { error: "Channel ID mismatch" },
        { status: 400 }
      );
    }

    // Handle different notification types
    if (resourceState === "sync") {
      // Initial sync notification - acknowledge it
      // We don't need to process events here, just acknowledge
      return NextResponse.json({ ok: true, message: "Sync notification acknowledged" });
    }

    if (resourceState === "exists" || resourceState === "not_exists") {
      // Calendar events have changed - we need to sync
      // Process the notification asynchronously
      const { processWebhookNotification } = await import("@/lib/calendar/process-webhook-notification");
      
      // Process in background (don't await to return quickly)
      processWebhookNotification(
        adminDb,
        channel.userId,
        resourceId || channel.resourceId
      ).catch((error) => {
        reportException(error, {
          context: "Background webhook processing",
          tags: { component: "calendar-webhook", userId: channel.userId },
        });
      });

      // Return 200 immediately to acknowledge receipt
      return NextResponse.json({ ok: true, message: "Notification received" });
    }

    // Unknown resource state - log but acknowledge
    reportException(new Error(`Unknown resource state: ${resourceState || "missing"}`), {
      context: "Calendar webhook notification",
      tags: { 
        component: "calendar-webhook", 
        userId: channel.userId, 
        resourceState: resourceState || "missing" 
      },
    });

    return NextResponse.json({ ok: true, message: "Notification acknowledged" });
  } catch (error) {
    reportException(error, {
      context: "Processing calendar webhook",
      tags: { component: "calendar-webhook" },
    });

    // Always return 200 to prevent Google from retrying
    // We'll handle errors internally
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 200 }
    );
  }
}

/**
 * GET /api/calendar/webhook
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ ok: true, message: "Calendar webhook endpoint is active" });
}

