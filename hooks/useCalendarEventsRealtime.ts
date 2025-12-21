"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { CalendarEvent } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

interface UseCalendarEventsRealtimeReturn {
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
}

/**
 * Helper function to convert Date to Firestore Timestamp
 */
function toFirestoreTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/**
 * Hook to fetch calendar events for a date range using Firebase real-time listener
 * Updates automatically when events change in Firestore
 * 
 * @param userId - The user ID
 * @param timeMin - Minimum date for events (inclusive)
 * @param timeMax - Maximum date for events (inclusive)
 * 
 * @requires Firestore composite index on:
 * - Collection: `users/{userId}/calendarEvents`
 * - Fields: `startTime` (Ascending)
 * 
 * Firebase will automatically prompt to create this index when the query first runs,
 * or you can create it manually in Firebase Console.
 */
export function useCalendarEventsRealtime(
  userId: string | null,
  timeMin: Date | null,
  timeMax: Date | null
): UseCalendarEventsRealtimeReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || !timeMin || !timeMax) {
      // Defer setState to avoid cascading renders
      queueMicrotask(() => {
        setLoading(false);
        setEvents([]);
      });
      return;
    }

    let isMounted = true;

    try {
      // Convert Date to Firestore Timestamp for query
      const timeMinTimestamp = toFirestoreTimestamp(timeMin);
      const timeMaxTimestamp = toFirestoreTimestamp(timeMax);

      const eventsQuery = query(
        collection(db, `users/${userId}/calendarEvents`),
        where("startTime", ">=", timeMinTimestamp),
        where("startTime", "<=", timeMaxTimestamp),
        orderBy("startTime", "asc")
      );

      const unsubscribe = onSnapshot(
        eventsQuery,
        (snapshot) => {
          if (!isMounted) return;

          const eventsData = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              ...data,
              eventId: doc.id,
            } as CalendarEvent;
          });

          setEvents(eventsData);
          setLoading(false);
          setError(null);
        },
        (err) => {
          if (!isMounted) return;

          // Check if this is an index error and extract the creation link
          const errorMessage = err instanceof Error ? err.message : String(err);
          const indexErrorMatch = errorMessage.match(/You can create it here: (https:\/\/[^\s]+)/);
          
          if (indexErrorMatch) {
            // This is an index error - create a more helpful error message
            const indexUrl = indexErrorMatch[1];
            const helpfulError = new Error(
              `Firestore index required for calendar events. Click here to create it: ${indexUrl}`
            );
            reportException(helpfulError, {
              context: "Fetching calendar events (real-time) - index required",
              tags: { component: "useCalendarEventsRealtime", userId, indexUrl },
            });
            setError(helpfulError);
          } else {
            reportException(err, {
              context: "Fetching calendar events (real-time)",
              tags: { component: "useCalendarEventsRealtime", userId },
            });
            setError(err);
          }
          
          setLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      if (!isMounted) return;

      const error = err instanceof Error ? err : new Error(String(err));
      reportException(error, {
        context: "Setting up calendar events listener",
        tags: { component: "useCalendarEventsRealtime", userId },
      });

      // Defer setState to avoid cascading renders
      queueMicrotask(() => {
        if (isMounted) {
          setError(error);
          setLoading(false);
        }
      });
    }
  }, [userId, timeMin, timeMax]);

  return { events, loading, error };
}

