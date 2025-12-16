import { reportException } from "@/lib/error-reporting";

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string; // ISO 8601 for timed events
    date?: string; // YYYY-MM-DD for all-day events
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  etag: string;
  status?: string;
}

export interface GoogleCalendarEventsResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

/**
 * Fetch calendar events from Google Calendar API
 */
export async function getCalendarEventsFromGoogle(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEventsResponse> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '2500'); // Google Calendar API max

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Failed to fetch calendar events: ${response.statusText}`;
      
      reportException(new Error(errorMessage), {
        context: "Fetching calendar events from Google",
        tags: { component: "get-calendar-events", calendarId },
        extra: { status: response.status, errorData },
      });
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data as GoogleCalendarEventsResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    reportException(error, {
      context: "Error fetching calendar events",
      tags: { component: "get-calendar-events", calendarId },
    });
    throw new Error(`Failed to fetch calendar events: ${errorMessage}`);
  }
}

