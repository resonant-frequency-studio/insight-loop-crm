# Firestore Indexes Required

This document lists all Firestore composite indexes required for optimal performance.

## Action Items Collection Group Query

**Purpose**: Optimize fetching all action items across all contacts for a user.

**Index Configuration**:
- Collection ID: `actionItems` (collection group)
- Fields:
  1. `userId` (Ascending)
  2. `createdAt` (Descending)

**How to Create**:

**Option 1: Use the Auto-Generated Link (Easiest)**
1. When you first load the action items page, you'll see an error message like:
   ```
   The query requires an index. You can create it here: [link]
   ```
2. Click the link in the error message - it will automatically open Firebase Console with the index pre-configured
3. Click **"Create Index"** in the Firebase Console
4. Wait for the index to build (usually a few minutes)

**Option 2: Manual Creation**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes**
4. Click **"Create Index"**
5. Select **Collection group** and enter `actionItems`
6. Add fields:
   - Field: `userId`, Order: Ascending
   - Field: `createdAt`, Order: Descending
7. Click **"Create"**

**Note**: Firestore automatically adds `__name__` as a third field - this is normal and expected.

**Performance Impact**:
- **Before**: 1 + N queries (1 for contacts + N for each contact's action items)
- **After**: 1 + ceil(N/10) queries (1 collection group query + batched contact lookups)
- **Example**: With 100 contacts, reduces from 101 queries to ~11 queries

**Fallback**: If the index is not available, the system automatically falls back to the per-contact query method (N+1 pattern). The page will still work, but may be slower until the index is created.

**Error Message**: If you see an error like:
```
FAILED_PRECONDITION: The query requires an index. You can create it here: [link]
```

This is expected! Click the link in the error message to automatically create the index in Firebase Console. The page will continue to work using the fallback method until the index is built.

## Other Indexes

### Action Items per Contact (Ordered by Created Date)

**Purpose**: Fetch action items for a specific contact, ordered by creation date.

**Index Configuration**:
- Collection ID: `actionItems` (subcollection under contacts)
- Fields:
  1. `createdAt` (Descending)

**Status**: Usually auto-created by Firestore when you first use `orderBy("createdAt", "desc")`. If you see an error, click the link in the error message to create it.

## Verifying Indexes

After creating indexes, you can verify they exist:
1. Go to **Firestore Database** → **Indexes**
2. Look for the index in the list
3. Status should show "Enabled" (may take a few minutes to build)

## Index Building Time

- Small datasets (< 1000 documents): Usually completes in seconds
- Medium datasets (1000-10000 documents): May take a few minutes
- Large datasets (> 10000 documents): May take 10-30 minutes

You can still use the application while indexes are building - Firestore will use the fallback method until the index is ready.

