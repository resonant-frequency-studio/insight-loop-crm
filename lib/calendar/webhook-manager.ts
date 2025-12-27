import { Firestore, Timestamp } from "firebase-admin/firestore";
import { getCalendarAccessToken } from "./get-access-token";
import {
  storeChannel,
  deleteChannel,
  getUserChannels,
  getExpiringChannels,
  CalendarChannel,
} from "./channel-storage";
import { reportException } from "@/lib/error-reporting";
import { randomBytes } from "crypto";

const CHANNEL_EXPIRATION_DAYS = 7;
const RENEWAL_BUFFER_HOURS = 24; // Renew channels 24 hours before expiration

/**
 * Generate a unique channel ID
 */
function generateChannelId(): string {
  return `channel_${Date.now()}_${randomBytes(8).toString("hex")}`;
}

/**
 * Generate a webhook token for validation
 */
function generateWebhookToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Subscribe to Google Calendar push notifications
 */
export async function subscribeToCalendar(
  db: Firestore,
  userId: string,
  calendarId: string = "primary"
): Promise<CalendarChannel> {
  try {
    const accessToken = await getCalendarAccessToken(userId);
    const channelId = generateChannelId();
    const webhookToken = generateWebhookToken();

    // Calculate expiration time (7 days from now)
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + CHANNEL_EXPIRATION_DAYS);
    const expirationTimestamp = Timestamp.fromDate(expiration);

    // Get the webhook URL from environment
    const webhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error(
        "GOOGLE_CALENDAR_WEBHOOK_URL environment variable is not set"
      );
    }

    // Subscribe to calendar changes using Google Calendar Push Notifications API
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
          token: webhookToken,
          expiration: expiration.getTime(), // Milliseconds since epoch
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error?.message || `Failed to subscribe: ${response.statusText}`;

      reportException(new Error(errorMessage), {
        context: "Subscribing to Google Calendar push notifications",
        tags: { component: "webhook-manager", userId, calendarId },
        extra: { status: response.status, errorData },
      });

      throw new Error(`Failed to subscribe to calendar: ${errorMessage}`);
    }

    const data = await response.json();
    const resourceId = data.resourceId;

    if (!resourceId) {
      throw new Error("No resourceId returned from Google Calendar API");
    }

    // Store channel in Firestore
    const channel: CalendarChannel = {
      userId,
      channelId,
      resourceId,
      expiration: expirationTimestamp,
      calendarId,
      webhookToken,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await storeChannel(db, channel);

    return channel;
  } catch (error) {
    reportException(error, {
      context: "Subscribing to calendar webhook",
      tags: { component: "webhook-manager", userId },
    });
    throw error;
  }
}

/**
 * Unsubscribe from Google Calendar push notifications
 */
export async function unsubscribeFromCalendar(
  db: Firestore,
  userId: string,
  channelId?: string
): Promise<void> {
  try {
    let channels: CalendarChannel[];

    if (channelId) {
      // Unsubscribe specific channel
      const channel = await getUserChannels(db, userId).then((channels) =>
        channels.find((c) => c.channelId === channelId)
      );
      if (!channel) {
        throw new Error(`Channel ${channelId} not found for user ${userId}`);
      }
      channels = [channel];
    } else {
      // Unsubscribe all channels for user
      channels = await getUserChannels(db, userId);
    }

    const accessToken = await getCalendarAccessToken(userId);

    // Stop watching each channel
    for (const channel of channels) {
      try {
        const response = await fetch(
          "https://www.googleapis.com/calendar/v3/channels/stop",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: channel.channelId,
              resourceId: channel.resourceId,
            }),
          }
        );

        if (!response.ok) {
          // Log but don't fail if channel already expired or doesn't exist
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error?.message || response.statusText;

          if (response.status !== 404 && response.status !== 410) {
            reportException(new Error(errorMessage), {
              context: "Unsubscribing from calendar webhook",
              tags: {
                component: "webhook-manager",
                userId,
                channelId: channel.channelId,
              },
              extra: { status: response.status, errorData },
            });
          }
        }
      } catch (error) {
        // Log but continue with other channels
        reportException(error, {
          context: "Error unsubscribing channel",
          tags: {
            component: "webhook-manager",
            userId,
            channelId: channel.channelId,
          },
        });
      }

      // Delete channel from Firestore
      await deleteChannel(db, channel.channelId);
    }
  } catch (error) {
    reportException(error, {
      context: "Unsubscribing from calendar",
      tags: { component: "webhook-manager", userId },
    });
    throw error;
  }
}

/**
 * Renew expiring channels
 */
export async function renewExpiringChannels(
  db: Firestore
): Promise<number> {
  try {
    const expiringChannels = await getExpiringChannels(
      db,
      RENEWAL_BUFFER_HOURS
    );

    let renewedCount = 0;

    for (const channel of expiringChannels) {
      try {
        // Unsubscribe old channel
        await unsubscribeFromCalendar(db, channel.userId, channel.channelId);

        // Subscribe new channel
        await subscribeToCalendar(db, channel.userId, channel.calendarId);

        renewedCount++;
      } catch (error) {
        reportException(error, {
          context: "Renewing expiring channel",
          tags: {
            component: "webhook-manager",
            userId: channel.userId,
            channelId: channel.channelId,
          },
        });
        // Continue with other channels
      }
    }

    return renewedCount;
  } catch (error) {
    reportException(error, {
      context: "Renewing expiring channels",
      tags: { component: "webhook-manager" },
    });
    throw error;
  }
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(
  db: Firestore,
  userId: string
): Promise<boolean> {
  try {
    const channels = await getUserChannels(db, userId);
    if (channels.length === 0) {
      return false;
    }

    // Check if any channel is not expired
    const now = Timestamp.now();
    return channels.some((channel) => channel.expiration > now);
  } catch (error) {
    reportException(error, {
      context: "Checking active subscription",
      tags: { component: "webhook-manager", userId },
    });
    return false;
  }
}

