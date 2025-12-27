import { Firestore, Timestamp } from "firebase-admin/firestore";
import { reportException } from "@/lib/error-reporting";

export interface CalendarChannel {
  userId: string;
  channelId: string;
  resourceId: string;
  expiration: Timestamp;
  calendarId: string; // Usually "primary"
  webhookToken: string; // Token for webhook validation
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Store a calendar channel subscription in Firestore
 */
export async function storeChannel(
  db: Firestore,
  channel: Omit<CalendarChannel, "createdAt" | "updatedAt">
): Promise<void> {
  try {
    const channelData: CalendarChannel = {
      ...channel,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await db
      .collection("calendarChannels")
      .doc(channel.channelId)
      .set(channelData);
  } catch (error) {
    reportException(error, {
      context: "Storing calendar channel",
      tags: { component: "channel-storage", userId: channel.userId },
    });
    throw error;
  }
}

/**
 * Get a channel by channelId
 */
export async function getChannel(
  db: Firestore,
  channelId: string
): Promise<CalendarChannel | null> {
  try {
    const doc = await db.collection("calendarChannels").doc(channelId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as CalendarChannel;
  } catch (error) {
    reportException(error, {
      context: "Getting calendar channel",
      tags: { component: "channel-storage", channelId },
    });
    throw error;
  }
}

/**
 * Get all channels for a user
 */
export async function getUserChannels(
  db: Firestore,
  userId: string
): Promise<CalendarChannel[]> {
  try {
    const snapshot = await db
      .collection("calendarChannels")
      .where("userId", "==", userId)
      .get();

    return snapshot.docs.map((doc) => doc.data() as CalendarChannel);
  } catch (error) {
    reportException(error, {
      context: "Getting user calendar channels",
      tags: { component: "channel-storage", userId },
    });
    throw error;
  }
}

/**
 * Get channel by webhook token
 */
export async function getChannelByToken(
  db: Firestore,
  webhookToken: string
): Promise<CalendarChannel | null> {
  try {
    const snapshot = await db
      .collection("calendarChannels")
      .where("webhookToken", "==", webhookToken)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as CalendarChannel;
  } catch (error) {
    reportException(error, {
      context: "Getting calendar channel by token",
      tags: { component: "channel-storage" },
    });
    throw error;
  }
}

/**
 * Delete a channel subscription
 */
export async function deleteChannel(
  db: Firestore,
  channelId: string
): Promise<void> {
  try {
    await db.collection("calendarChannels").doc(channelId).delete();
  } catch (error) {
    reportException(error, {
      context: "Deleting calendar channel",
      tags: { component: "channel-storage", channelId },
    });
    throw error;
  }
}

/**
 * Delete all channels for a user
 */
export async function deleteUserChannels(
  db: Firestore,
  userId: string
): Promise<void> {
  try {
    const channels = await getUserChannels(db, userId);
    const batch = db.batch();

    for (const channel of channels) {
      batch.delete(db.collection("calendarChannels").doc(channel.channelId));
    }

    await batch.commit();
  } catch (error) {
    reportException(error, {
      context: "Deleting user calendar channels",
      tags: { component: "channel-storage", userId },
    });
    throw error;
  }
}

/**
 * Get channels that are expiring soon (within the next day)
 */
export async function getExpiringChannels(
  db: Firestore,
  hoursBeforeExpiration: number = 24
): Promise<CalendarChannel[]> {
  try {
    const now = Timestamp.now();
    const expirationThreshold = new Date(
      now.toMillis() + hoursBeforeExpiration * 60 * 60 * 1000
    );
    const expirationThresholdTimestamp = Timestamp.fromDate(expirationThreshold);

    const snapshot = await db
      .collection("calendarChannels")
      .where("expiration", "<=", expirationThresholdTimestamp)
      .get();

    return snapshot.docs.map((doc) => doc.data() as CalendarChannel);
  } catch (error) {
    reportException(error, {
      context: "Getting expiring calendar channels",
      tags: { component: "channel-storage" },
    });
    throw error;
  }
}

/**
 * Update channel expiration
 */
export async function updateChannelExpiration(
  db: Firestore,
  channelId: string,
  expiration: Timestamp
): Promise<void> {
  try {
    await db
      .collection("calendarChannels")
      .doc(channelId)
      .update({
        expiration,
        updatedAt: Timestamp.now(),
      });
  } catch (error) {
    reportException(error, {
      context: "Updating channel expiration",
      tags: { component: "channel-storage", channelId },
    });
    throw error;
  }
}

