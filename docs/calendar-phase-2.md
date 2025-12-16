# Calendar Phase 2: Contact Integration & Touchpoint Sync

## Overview
Phase 2 integrates calendar events with contacts, enabling intelligent matching, touchpoint synchronization, and CRM insights within the calendar view.

## Goals
- Match calendar events to contacts automatically
- Sync touchpoints from contacts to calendar events
- Display contact context on calendar events
- Provide quick navigation from events to contact details
- Color-code events by contact attributes (segment, tags, etc.)

## Architecture

### Event-to-Contact Matching

**File:** `lib/calendar/match-event-to-contact.ts`

```typescript
export interface EventContactMatch {
  eventId: string;
  contactId: string | null;
  confidence: 'high' | 'medium' | 'low';
  matchMethod: 'email' | 'name' | 'domain' | 'manual';
}

export function matchEventToContact(
  event: CalendarEvent,
  contacts: Contact[]
): EventContactMatch
```

**Matching Strategies:**
1. **Email Matching (High Confidence)**
   - Match attendee emails to `contact.primaryEmail`
   - Exact match = high confidence

2. **Name Matching (Medium Confidence)**
   - Extract names from event title/description
   - Fuzzy match against `contact.firstName` + `contact.lastName`
   - Use string similarity (Levenshtein distance)

3. **Domain Matching (Low Confidence)**
   - Match attendee email domains to known contact domains
   - Useful for company-wide meetings

4. **Manual Matching**
   - Allow users to manually link events to contacts
   - Store in `calendarEvents/{eventId}/linkedContactId`

### Touchpoint Sync

**File:** `lib/calendar/sync-touchpoints.ts`

```typescript
export async function syncTouchpointToCalendar(
  db: Firestore,
  userId: string,
  contactId: string,
  touchpointDate: Date,
  message?: string
): Promise<string | null> // Returns calendar event ID
```

**Sync Logic:**
- When `contact.nextTouchpointDate` is set, create calendar event
- Event title: `"Follow up: {contactName}"`
- Event description: `{nextTouchpointMessage}`
- Store `isTouchpointEvent: true` flag on calendar event
- Store `contactId` on calendar event

**File:** `lib/calendar/sync-touchpoint-status.ts`

```typescript
export async function syncCalendarEventToTouchpoint(
  db: Firestore,
  userId: string,
  eventId: string,
  contactId: string
): Promise<void>
```

**Reverse Sync:**
- When calendar event marked complete/cancelled, update touchpoint status
- When touchpoint status changes, update calendar event

### Data Model Updates

**File:** `types/firestore.ts`

Update `CalendarEvent` interface:

```typescript
export interface CalendarEvent {
  // ... existing fields
  
  // Contact relationship
  contactId?: string | null;
  isTouchpointEvent?: boolean;
  matchConfidence?: 'high' | 'medium' | 'low';
  matchMethod?: 'email' | 'name' | 'domain' | 'manual';
  
  // Contact metadata (cached for performance)
  contactName?: string | null;
  contactSegment?: string | null;
  contactTags?: string[];
}
```

### API Routes

**File:** `app/api/calendar/events/[eventId]/link-contact/route.ts`

```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
)
```

- Manually link event to contact
- Updates event with `contactId` and `matchMethod: 'manual'`

**File:** `app/api/calendar/events/match-contacts/route.ts`

```typescript
export async function POST(req: Request)
```

- Batch match events to contacts
- Returns array of matches with confidence scores
- Allows user to review and confirm matches

### UI Components

**File:** `app/(crm)/calendar/_components/EventContactCard.tsx`

- Display contact info when event is linked
- Show contact name, email, segment, tags
- Link to contact detail page
- Allow unlinking contact

**File:** `app/(crm)/calendar/_components/ContactMatchSuggestions.tsx`

- Show suggested contact matches for event
- Display confidence scores
- Allow user to select match or dismiss

**File:** `app/(crm)/calendar/_components/TouchpointEventBadge.tsx`

- Badge indicating event is from touchpoint
- Different styling for touchpoint events
- Quick action to mark touchpoint complete

### Calendar View Enhancements

**File:** `app/(crm)/calendar/_components/CalendarView.tsx`

**Updates:**
- Color-code events by contact segment
- Show contact name in event title
- Hover tooltip with contact details
- Filter events by contact/segment
- Group events by contact

**Event Colors:**
- Use contact segment colors (if defined)
- Default color for unmatched events
- Special color for touchpoint events

### Hooks

**File:** `hooks/useCalendarEventContact.ts`

```typescript
export function useCalendarEventContact(
  eventId: string,
  contactId: string | null
)
```

- Fetch contact data for event
- Handle loading/error states

**File:** `hooks/useLinkEventToContact.ts`

```typescript
export function useLinkEventToContact()
```

- Mutation hook to link/unlink event to contact
- Optimistic updates
- Cache invalidation

### Background Jobs

**File:** `lib/calendar/background-matching.ts`

```typescript
export async function runBackgroundContactMatching(
  userId: string
): Promise<{ matched: number; unmatched: number }>
```

- Periodic job to match unmatched events
- Runs after calendar sync
- Updates events with matches

### Integration Points

**File:** `hooks/useContactMutations.ts`

Update `useUpdateContact` to sync touchpoints:

```typescript
onSuccess: (updatedContact, variables) => {
  // ... existing code
  
  // If touchpoint date changed, sync to calendar
  if (variables.updates.nextTouchpointDate) {
    syncTouchpointToCalendar(/* ... */);
  }
}
```

**File:** `hooks/useContactMutations.ts`

Update `useUpdateTouchpointStatus` to sync calendar:

```typescript
onSuccess: (data) => {
  // ... existing code
  
  // If touchpoint completed, update calendar event
  if (data.status === 'completed') {
    syncTouchpointStatusToCalendar(/* ... */);
  }
}
```

## Implementation Steps

1. Create event-to-contact matching logic
2. Add contact fields to CalendarEvent type
3. Create touchpoint sync functions
4. Update calendar sync to include contact matching
5. Create UI components for contact display
6. Add color-coding by contact segment
7. Create manual linking interface
8. Add background matching job
9. Integrate with contact mutations
10. Test matching accuracy and performance

## Success Criteria

- Events automatically matched to contacts when possible
- Touchpoints create calendar events
- Calendar events show contact context
- Users can manually link/unlink events
- Events color-coded by contact attributes
- Touchpoint status syncs bidirectionally
- Performance: Matching completes in < 5s for 100 events

## Future Enhancements

- AI-powered matching using contact history
- Bulk matching interface
- Match confidence scoring UI
- Contact relationship visualization
- Meeting notes integration

