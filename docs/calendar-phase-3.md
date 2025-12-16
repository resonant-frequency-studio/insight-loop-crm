# Calendar Phase 3: Two-Way Sync & Event Management

## Overview
Phase 3 enables full two-way synchronization between Google Calendar and the CRM, allowing users to create, edit, and delete events from within the application while maintaining data consistency.

## Goals
- Create calendar events from touchpoints
- Edit calendar events (title, time, attendees, location)
- Delete calendar events
- Handle sync conflicts gracefully
- Real-time updates via webhooks (optional)
- Support for recurring events

## Architecture

### Event Creation

**File:** `lib/calendar/create-calendar-event.ts`

```typescript
export interface CreateEventOptions {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[]; // Email addresses
  contactId?: string; // Link to contact
  isTouchpointEvent?: boolean;
}

export async function createCalendarEvent(
  accessToken: string,
  options: CreateEventOptions,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent>
```

**Flow:**
1. Create event in Google Calendar via API
2. Store event in Firestore cache
3. If `contactId` provided, link to contact
4. Return created event

### Event Updates

**File:** `lib/calendar/update-calendar-event.ts`

```typescript
export interface UpdateEventOptions {
  eventId: string;
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
}

export async function updateCalendarEvent(
  accessToken: string,
  googleEventId: string,
  options: UpdateEventOptions,
  etag: string, // For conflict detection
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent>
```

**Conflict Handling:**
- Use `etag` from Google Calendar API
- If `etag` mismatch, event was modified elsewhere
- Show conflict resolution UI
- Allow user to choose: overwrite, merge, or cancel

### Event Deletion

**File:** `lib/calendar/delete-calendar-event.ts`

```typescript
export async function deleteCalendarEvent(
  accessToken: string,
  googleEventId: string,
  calendarId: string = 'primary'
): Promise<void>
```

**Flow:**
1. Delete from Google Calendar
2. Remove from Firestore cache
3. If linked to touchpoint, update touchpoint status

### Conflict Resolution

**File:** `lib/calendar/conflict-resolution.ts`

```typescript
export interface ConflictInfo {
  localEvent: CalendarEvent;
  remoteEvent: GoogleCalendarEvent;
  conflictFields: string[];
}

export async function detectConflict(
  localEvent: CalendarEvent,
  remoteEvent: GoogleCalendarEvent
): Promise<ConflictInfo | null>
```

**Conflict Detection:**
- Compare `etag` values
- If different, compare field-by-field
- Return list of conflicting fields
- Present resolution options to user

**File:** `app/(crm)/calendar/_components/ConflictResolutionModal.tsx`

- Modal showing local vs remote changes
- Options: Keep Local, Keep Remote, Merge
- Preview of merged result
- Save resolution

### Sync Strategy

**File:** `lib/calendar/two-way-sync.ts`

```typescript
export interface SyncDirection {
  direction: 'push' | 'pull' | 'bidirectional';
  eventId: string;
}

export async function performTwoWaySync(
  db: Firestore,
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<SyncResult>
```

**Sync Logic:**
1. Fetch events from Google Calendar
2. Fetch cached events from Firestore
3. Compare by `googleEventId`
4. Identify:
   - New events (in Google, not in cache) → Pull
   - Deleted events (in cache, not in Google) → Remove from cache
   - Modified events (etag mismatch) → Detect conflicts
   - Local changes (dirty flag) → Push to Google

**Dirty Flag:**
- Add `isDirty: boolean` to CalendarEvent
- Set to `true` when user makes local changes
- Cleared after successful push

### Webhook Support (Optional)

**File:** `app/api/calendar/webhook/route.ts`

```typescript
export async function POST(req: Request)
```

**Google Calendar Push Notifications:**
- Register webhook channel with Google Calendar
- Receive notifications when events change
- Update Firestore cache immediately
- Invalidate React Query cache

**Setup:**
1. Create webhook channel via Google Calendar API
2. Store channel ID and resource ID in Firestore
3. Handle webhook notifications
4. Renew channel before expiration (7 days)

### Recurring Events

**File:** `lib/calendar/recurring-events.ts`

```typescript
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  count?: number;
  until?: Date;
  byDay?: string[]; // ['MO', 'WE', 'FR']
  byMonth?: number[];
}

export function parseRecurrenceRule(
  rrule: string
): RecurrenceRule | null
```

**Handling:**
- Parse RRULE from Google Calendar
- Display recurring pattern in UI
- Allow editing individual instances
- Sync recurring touchpoints

### API Routes

**File:** `app/api/calendar/events/route.ts`

Add POST method:

```typescript
export async function POST(req: Request)
```

- Create new calendar event
- Returns created event

**File:** `app/api/calendar/events/[eventId]/route.ts`

```typescript
export async function PATCH(req: Request, { params })
export async function DELETE(req: Request, { params })
```

- Update event
- Delete event
- Handle conflicts

**File:** `app/api/calendar/events/[eventId]/conflict/route.ts`

```typescript
export async function POST(req: Request, { params })
```

- Resolve conflict
- Accepts resolution choice
- Applies resolution

### UI Components

**File:** `app/(crm)/calendar/_components/CreateEventModal.tsx`

- Form to create new event
- Fields: title, date/time, location, attendees, description
- Option to link to contact
- Option to create from touchpoint

**File:** `app/(crm)/calendar/_components/EditEventModal.tsx`

- Edit existing event
- Show conflict warning if detected
- Allow editing all event fields
- Save changes

**File:** `app/(crm)/calendar/_components/DeleteEventModal.tsx`

- Confirm deletion
- Warn if linked to touchpoint
- Option to update touchpoint status

**File:** `app/(crm)/calendar/_components/ConflictResolutionModal.tsx`

- Show local vs remote changes side-by-side
- Highlight differences
- Resolution options
- Preview merged result

### Hooks

**File:** `hooks/useCreateCalendarEvent.ts`

```typescript
export function useCreateCalendarEvent()
```

- Mutation hook for creating events
- Optimistic updates
- Cache invalidation

**File:** `hooks/useUpdateCalendarEvent.ts`

```typescript
export function useUpdateCalendarEvent()
```

- Mutation hook for updating events
- Conflict detection
- Optimistic updates with rollback

**File:** `hooks/useDeleteCalendarEvent.ts`

```typescript
export function useDeleteCalendarEvent()
```

- Mutation hook for deleting events
- Optimistic updates

**File:** `hooks/useCalendarSync.ts`

```typescript
export function useCalendarSync()
```

- Manual sync trigger
- Shows sync progress
- Handles sync errors

### Integration with Touchpoints

**File:** `hooks/useContactMutations.ts`

Update `useUpdateContact`:

```typescript
onMutate: async ({ contactId, updates }) => {
  // ... existing code
  
  // If creating touchpoint, create calendar event
  if (updates.nextTouchpointDate && !previousContact?.nextTouchpointDate) {
    await createTouchpointEvent(contactId, updates.nextTouchpointDate);
  }
}
```

**File:** `lib/calendar/touchpoint-integration.ts`

```typescript
export async function createTouchpointEvent(
  db: Firestore,
  userId: string,
  contactId: string,
  touchpointDate: Date,
  message?: string
): Promise<string> // Returns event ID
```

### Error Handling

**Error Types:**
- `CALENDAR_PERMISSION_DENIED` - User needs to grant write access
- `CALENDAR_EVENT_NOT_FOUND` - Event deleted elsewhere
- `CALENDAR_CONFLICT` - Event modified elsewhere
- `CALENDAR_RATE_LIMIT` - Too many requests
- `CALENDAR_INVALID_EVENT` - Invalid event data

**User-Friendly Messages:**
- Show clear error messages
- Provide actionable steps
- Link to reconnect if permission denied
- Offer conflict resolution UI

### Performance Considerations

**Batching:**
- Batch multiple event updates when possible
- Use Google Calendar batch API for bulk operations

**Caching:**
- Cache events aggressively
- Use `etag` to detect changes without full fetch
- Invalidate cache on mutations

**Rate Limiting:**
- Respect Google Calendar API quotas
- Implement exponential backoff
- Queue operations if rate limited

## Implementation Steps

1. Update OAuth scopes to include `calendar` (write access)
2. Create event creation/update/delete functions
3. Implement conflict detection and resolution
4. Create UI components for event management
5. Add mutation hooks with optimistic updates
6. Integrate with touchpoint creation
7. Implement two-way sync logic
8. Add error handling and user feedback
9. Test conflict scenarios
10. Optional: Set up webhook notifications

## Success Criteria

- Users can create events from calendar page
- Users can edit event details
- Users can delete events
- Changes sync to Google Calendar
- Conflicts detected and resolved gracefully
- Touchpoints create calendar events automatically
- Performance: Event operations complete in < 2s
- Error handling provides clear feedback

## Security Considerations

- Verify user owns calendar before allowing edits
- Validate event data before sending to API
- Sanitize user input (title, description, location)
- Rate limit mutation operations
- Audit log of all calendar changes

## Future Enhancements

- Support for multiple calendars
- Event templates
- Bulk event operations
- Event attachments
- Meeting room booking
- Time zone handling improvements
- Event reminders sync
- Calendar sharing permissions

