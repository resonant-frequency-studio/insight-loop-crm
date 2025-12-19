export interface Contact {
    contactId: string;
  
    // Identity
    primaryEmail: string;
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
  
    // Gmail-derived
    lastEmailDate?: unknown | null; // Firestore timestamp
    threadCount?: number;
  
    // CRM fields
    tags?: string[];
    notes?: string | null;
    leadSource?: string | null;
    segment?: string | null;
    engagementScore?: number | null;
  
    // Next touchpoint
    nextTouchpointDate?: unknown | null;
    nextTouchpointMessage?: string | null;
    touchpointStatus?: "pending" | "completed" | "cancelled" | null;
    touchpointStatusUpdatedAt?: unknown | null;
    touchpointStatusReason?: string | null;
    // Touchpoint ↔ Calendar Event linkage
    linkedGoogleEventId?: string | null;
    linkedGoogleCalendarId?: string | null;
    linkStatus?: "none" | "linked" | "broken" | null;
  
    // AI fields
    summary?: string | null;
    actionItems?: string | null;
    sentiment?: string | null;
    relationshipInsights?: string | null;
    painPoints?: string | null;
    coachingThemes?: string | null;
    outreachDraft?: string | null;
  
    // Meta
    summaryUpdatedAt?: unknown | null;
    needsSummaryRefresh?: boolean;
    archived?: boolean; // If true, contact is archived (hidden from main view but still exists for duplicate checking)
  
    createdAt: unknown;
    updatedAt: unknown;
  }
  
  export interface Thread {
    threadId: string;
    gmailThreadId: string;
  
    subject?: string | null;
    snippet?: string | null;
  
    firstMessageAt: unknown;
    lastMessageAt: unknown;
  
    contactIds: string[];
    rawLabels?: string[];
  
    summary?: string | null;
    summaryUpdatedAt?: unknown | null;
    needsSummaryRefresh?: boolean;
  
    createdAt: unknown;
    updatedAt: unknown;
  }
  
  export interface Message {
    messageId: string;
    gmailMessageId: string;
  
    from: string;
    to: string[];
    cc: string[];
  
    sentAt: unknown;
  
    bodyPlain?: string | null;
    bodyHtml?: string | null;
  
    isFromUser: boolean;
  
    createdAt: unknown;
    updatedAt: unknown;
  }
  
  export interface SyncJob {
    syncJobId: string;
    userId: string;
    service: "gmail" | "calendar"; // Which service this sync job is for
  
    type: "initial" | "incremental";
    status: "pending" | "running" | "complete" | "error";
  
    startedAt: unknown;
    finishedAt?: unknown | null;
  
    // Gmail-specific fields
    processedThreads?: number;
    processedMessages?: number;
    gmailQuery?: string | null;
  
    // Calendar-specific fields
    processedEvents?: number;
    rangeDays?: number; // Number of days synced (30, 60, 90, or 180)
  
    errorMessage?: string | null;
  }

  export interface ActionItem {
    actionItemId: string;
    contactId: string;
    userId: string;
    
    text: string;
    status: "pending" | "completed";
    
    dueDate?: unknown | null; // Firestore timestamp or date string
    completedAt?: unknown | null; // Firestore timestamp
    
    createdAt: unknown;
    updatedAt: unknown;
  }

  export interface CalendarEvent {
    eventId: string;
    googleEventId: string;
    userId: string;
    
    // Event details
    title: string;
    description?: string | null;
    startTime: unknown; // Firestore timestamp
    endTime: unknown;
    location?: string | null;
    attendees?: Array<{ email: string; displayName?: string }>;
    
    // Sync metadata
    lastSyncedAt: unknown;
    etag?: string; // For future conflict detection
    googleUpdated?: unknown; // Google's updated timestamp (Firestore timestamp)
    sourceOfTruth?: "google" | "crm_touchpoint"; // Where event originated
    isDirty?: boolean; // Has local changes not synced to Google
    
    // Contact matching
    matchedContactId?: string | null;
    matchConfidence?: "high" | "medium" | "low";
    matchMethod?: "email" | "name" | "domain" | "manual";
    matchOverriddenByUser?: boolean; // User manually changed match
    matchDeniedContactIds?: string[]; // Contacts user explicitly rejected
    contactSnapshot?: {
      name: string;
      segment?: string | null;
      tags?: string[];
      primaryEmail: string;
      engagementScore?: number | null;
      snapshotUpdatedAt: unknown;
    } | null;
    
    // Meeting Insights (AI-generated)
    meetingInsights?: {
      summary: string;
      suggestedNextStep: string;
      suggestedTouchpointDate?: string; // ISO date string
      suggestedTouchpointRationale?: string;
      suggestedActionItems?: string[];
      followUpEmailDraft?: string;
      generatedAt: unknown; // Firestore timestamp
      dataSignature: string; // Hash of relevant data for staleness detection
    } | null;
    
    createdAt: unknown;
    updatedAt: unknown;
  }

  export interface CalendarSyncSettings {
    userId: string;
    lastSyncToken?: string | null; // Google Calendar syncToken for incremental sync
    lastSyncAt?: unknown | null;
    calendarId?: string; // Default: 'primary'
  }

  export type TimelineItemType = "calendar_event" | "touchpoint" | "action_item" | "email";

  export interface TimelineItem {
    id: string;
    type: TimelineItemType;
    timestamp: unknown; // Firestore timestamp
    title: string;
    description?: string | null;
    // Type-specific fields
    eventId?: string;
    touchpointId?: string;
    actionItemId?: string;
    threadId?: string;
    // Additional metadata for rendering
    location?: string | null;
    attendees?: Array<{ email: string; displayName?: string }>;
    status?: string; // For action items: "pending" | "completed"
    isFromUser?: boolean; // For emails
  }
  