export interface Contact {
    contactId: string;
  
    // Identity
    primaryEmail: string;
    firstName?: string | null;
    lastName?: string | null;
  
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
  
    type: "initial" | "incremental";
    status: "pending" | "running" | "complete" | "error";
  
    startedAt: unknown;
    finishedAt?: unknown | null;
  
    processedThreads: number;
    processedMessages: number;
  
    gmailQuery?: string | null;
    errorMessage?: string | null;
  }
  