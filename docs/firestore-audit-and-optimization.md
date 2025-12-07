# Firestore Audit & Optimization Report

**Date:** 2024  
**Project:** CRM Coaching App  
**Goal:** Reduce Firestore read operations to stay within Spark plan limits and prepare for Blaze migration

---

## A. Firestore Schema & Access Patterns

### Collections & Subcollections

```
users/{userId}/
  ├── contacts/{contactId}          # CRM contacts
  │   └── actionItems/{actionItemId} # Action items subcollection
  ├── threads/{threadId}            # Gmail threads
  │   └── messages/{messageId}      # Messages within threads
  ├── syncJobs/{syncJobId}          # Sync job metadata
  └── settings/sync                 # User sync settings (lastHistoryId, etc.)

googleAccounts/{userId}             # OAuth tokens and account info
```

### Key Data Structures

- **Contact**: Primary CRM entity, linked to threads via `contactId` field on threads
- **Thread**: Gmail thread, contains `contactId` for linking to contacts`
- **Message**: Individual email messages, stored as subcollection of threads
- **ActionItem**: Tasks/action items, stored as subcollection of contacts
- **SyncJob**: Tracks Gmail sync operations

---

## B. High-Cost Read Patterns Identified

### 1. **Gmail Sync Route** (`/api/gmail/sync`) - OPTIMIZED ✅

**Previous Issues:**
- Read thread document to check existence before updating (1 read per message)
- Read thread to get `contactId` before deciding whether to update contact (1 read per message)
- Total: **~2 reads per message** in incremental sync

**Optimizations Applied:**
- **Eliminated thread existence checks**: Use blind upserts (`set` with `merge: true`) instead of reading first
- **Removed conditional reads**: Always attempt to find contactId and update thread/contact in one pass
- **Result**: Reduced from **~2 reads per message** to **~1 read per message** (only for finding contactId by email)

**Files Modified:**
- `lib/gmail/incremental-sync.ts` - Removed thread doc reads, use blind upserts

**Estimated Read Reduction:**
- Before: 2 reads × messages per sync
- After: 1 read × messages per sync
- **50% reduction in sync-related reads**

### 2. **Action Items Aggregation** (`getAllActionItemsForUser`)

**Current Pattern:**
- Reads all contacts (1 query)
- For each contact, reads action items subcollection (N queries where N = contact count)
- Total: **1 + N reads** where N can be large

**Status:** Already optimized with batching (10 contacts per batch, 50ms delays)

**Recommendation:** Consider denormalizing action item counts to contact documents if this becomes a bottleneck

### 3. **Client-Side Collection Scans**

**Issues:**
- `app/(crm)/contacts/page.tsx`: `onSnapshot` without limit - loads ALL contacts
- `app/(crm)/action-items/page.tsx`: `onSnapshot` without limit - loads ALL contacts  
- `hooks/useDashboardStats.ts`: `onSnapshot` without limit - loads ALL contacts

**Analysis:**
- These are client-side reads (count against overall Firestore quota, not just server-side)
- For a CRM, users may need to see all contacts, but this becomes expensive at scale
- `useSyncStatus.ts` already uses `limit(10)` - good example

**Recommendations:**
- Add pagination for contacts list (load 50-100 at a time)
- Consider server-side aggregation for dashboard stats instead of loading all contacts client-side
- Add virtual scrolling for large lists

**Note:** Client-side reads are necessary for real-time updates, but we can reduce the initial load size.

### 4. **Contact Lookup by Email** (`findContactIdByEmail`)

**Current Pattern:**
- Query contacts collection with `where("primaryEmail", "==", email).limit(1)`
- This is a necessary read and already optimized with `limit(1)`

**Status:** Already optimal - uses indexed query with limit

---

## C. Optimizations Implemented

### 1. Sync Route Optimizations

**File:** `lib/gmail/incremental-sync.ts`

**Changes:**
- Removed thread document read before updating (line 148-157)
- Changed from conditional updates to blind upserts
- Always attempt contact lookup and update, regardless of thread state
- Use `set(..., { merge: true })` for all writes

**Impact:**
- **~50% reduction in reads per sync operation**
- Faster sync operations (fewer round trips)
- More resilient to race conditions

### 2. Logging Infrastructure

**File:** `lib/firestore-logging.ts` (new)

**Purpose:**
- Temporary logging helpers to track Firestore reads
- Enable with `ENABLE_FIRESTORE_LOGGING=true` environment variable
- Logs all `getDoc()` and `getDocs()` operations with paths and document counts

**Usage:**
```typescript
import { loggedGetDoc, loggedGetDocs } from "@/lib/firestore-logging";

// Replace adminDb.doc(...).get() with:
await loggedGetDoc(adminDb.doc(...));
```

**Note:** Remove or disable before production deployment

---

## D. Cost Estimation (Blaze Plan)

### Assumptions

**Per User Per Sync:**
- **Threads processed**: 50-100 (initial sync), 5-20 (incremental)
- **Messages per thread**: 3-5 average
- **Total messages per sync**: 150-500 (initial), 15-100 (incremental)
- **Reads per sync** (after optimization):
  - Initial: ~150-500 reads (1 per message for contact lookup)
  - Incremental: ~15-100 reads
- **Writes per sync**: ~200-600 (threads + messages + contacts)

**User Activity:**
- **Active users**: 1-10 initially, scaling to 50
- **Syncs per user per day**: 2-4 (auto + manual)
- **Daily dashboard views**: 1-3 per user (loads all contacts)

### Monthly Read/Write Estimates

**Per User:**
- **Sync reads**: 2 syncs/day × 100 reads/sync × 30 days = **6,000 reads/month**
- **Dashboard reads**: 2 views/day × 100 contacts × 30 days = **6,000 reads/month**
- **Other operations**: ~2,000 reads/month (action items, contact details, etc.)
- **Total reads per user**: ~**14,000 reads/month**
- **Sync writes**: 2 syncs/day × 300 writes/sync × 30 days = **18,000 writes/month**
- **Other writes**: ~2,000 writes/month
- **Total writes per user**: ~**20,000 writes/month**

**At Scale:**
- **10 users**: 140,000 reads, 200,000 writes/month
- **50 users**: 700,000 reads, 1,000,000 writes/month

### Blaze Pricing (as of 2024)

**Firestore Blaze Plan:**
- **Reads**: $0.06 per 100,000 documents
- **Writes**: $0.18 per 100,000 documents
- **Storage**: $0.18 per GB/month
- **Free tier**: 50,000 reads/day, 20,000 writes/day (Spark plan limits)

**Monthly Cost Estimates:**

| Users | Reads/Month | Writes/Month | Read Cost | Write Cost | Total/Month |
|-------|-------------|--------------|------------|------------|-------------|
| 1     | 14,000      | 20,000       | $0.01      | $0.04      | **~$0.05**  |
| 10    | 140,000     | 200,000      | $0.08      | $0.36      | **~$0.44** |
| 50    | 700,000     | 1,000,000    | $0.42      | $1.80      | **~$2.22** |

**Storage Cost:**
- Estimated 1-2 GB for 50 users with full Gmail sync
- Storage cost: ~$0.18-0.36/month

**Total Estimated Monthly Cost:**
- **1 user**: ~$0.05-0.10/month
- **10 users**: ~$0.50-0.80/month
- **50 users**: ~$2.50-3.00/month

**Note:** These estimates assume:
- Average email volume (not power users)
- Efficient sync operations (using incremental sync when possible)
- Reasonable contact list sizes (<500 contacts per user)

**When costs might increase:**
- Power users with 10,000+ emails
- Very frequent syncs (>4 per day)
- Large contact lists (>1000 contacts)
- Heavy use of real-time listeners

---

## E. Recommendations for Further Optimization

### 1. **Pagination for Contacts List**
- Load contacts in pages of 50-100
- Use `limit()` and `startAfter()` for pagination
- Reduces initial load from potentially thousands to hundreds

### 2. **Server-Side Dashboard Aggregation**
- Create a summary document that aggregates dashboard stats
- Update on contact changes (via Cloud Functions or API routes)
- Dashboard reads 1 document instead of all contacts

### 3. **Denormalize Action Item Counts**
- Store `actionItemCount` on contact documents
- Update on action item create/delete
- Reduces need to scan all action item subcollections

### 4. **Batch Operations**
- Use Firestore batch writes for multiple operations
- Group thread/message/contact updates in single batch
- Reduces write overhead (though doesn't reduce reads)

### 5. **Cache Frequently Accessed Data**
- Cache contact lookups by email (in-memory or Redis)
- Cache dashboard stats with TTL
- Reduces redundant reads

### 6. **Optimize Client-Side Queries**
- Add `limit()` to all `onSnapshot` queries where possible
- Use virtual scrolling for large lists
- Consider server-side pagination API instead of client-side queries

---

## F. Testing & Verification

### How to Test Sync Optimizations

1. **Enable logging:**
   ```bash
   ENABLE_FIRESTORE_LOGGING=true npm run dev
   ```

2. **Run a test sync:**
   ```bash
   curl http://localhost:3000/api/gmail/sync?type=incremental
   ```

3. **Check logs for read operations:**
   - Look for `[FIRESTORE READ getDoc]` and `[FIRESTORE READ getDocs]` messages
   - Count total reads per sync operation
   - Compare before/after optimization

4. **Verify in Firebase Console:**
   - Go to Firestore → Usage tab
   - Check daily read counts
   - Should see ~50% reduction in sync-related reads

### Expected Results

**Before Optimization:**
- Incremental sync with 20 messages: ~40 reads (2 per message)
- Full sync with 100 messages: ~200 reads

**After Optimization:**
- Incremental sync with 20 messages: ~20 reads (1 per message)
- Full sync with 100 messages: ~100 reads

---

## G. Migration Checklist

- [x] Audit all Firestore collections and access patterns
- [x] Create logging infrastructure
- [x] Optimize Gmail sync route (eliminate existence checks)
- [x] Document high-cost patterns
- [x] Create cost estimates
- [ ] Add pagination to contacts list (recommended)
- [ ] Add server-side dashboard aggregation (recommended)
- [ ] Test optimizations in staging
- [ ] Monitor Firestore usage after deployment
- [ ] Remove logging helpers before production

---

## H. Summary

### Key Achievements

1. **Reduced sync reads by ~50%** by eliminating unnecessary existence checks
2. **Identified all high-cost patterns** for future optimization
3. **Created cost estimates** showing Blaze plan is very affordable at small scale
4. **Established logging infrastructure** for ongoing monitoring

### Next Steps

1. **Immediate:** Test optimizations and verify read reduction
2. **Short-term:** Add pagination to contacts list
3. **Medium-term:** Implement server-side dashboard aggregation
4. **Long-term:** Consider caching layer for frequently accessed data

### Cost Outlook

At current usage patterns, Blaze plan costs are **negligible** (<$5/month for 50 users). The main concern is staying within Spark plan limits during development/testing. With these optimizations, the app should be able to handle moderate usage on Spark plan, and scale comfortably on Blaze plan.

---

**Last Updated:** 2024  
**Next Review:** After implementing pagination and dashboard aggregation


