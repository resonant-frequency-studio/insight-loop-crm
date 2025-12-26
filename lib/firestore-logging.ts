/**
 * Temporary Firestore read logging helpers
 * 
 * These wrappers log all Firestore read operations to help identify high-cost patterns.
 * Set ENABLE_FIRESTORE_LOGGING=true in environment to enable.
 * 
 * TODO: Remove or disable these before production deployment
 */

import type { Firestore } from "firebase-admin/firestore";
import type {
  DocumentReference,
  Query,
  QuerySnapshot,
  DocumentSnapshot,
} from "firebase-admin/firestore";

const ENABLE_LOGGING = process.env.ENABLE_FIRESTORE_LOGGING === "true";

/**
 * Log a Firestore read operation
 */
function logRead(operation: string, path: string, count?: number) {
  if (!ENABLE_LOGGING) return;
  
  // Logging disabled - use error reporting system if needed
  // const countStr = count !== undefined ? ` (${count} docs)` : "";
  // console.log(`[FIRESTORE READ ${operation}]: ${path}${countStr}`);
}

/**
 * Wrapper for DocumentReference.get()
 */
export function loggedGetDoc<T = unknown>(
  ref: DocumentReference<T>
): Promise<DocumentSnapshot<T>> {
  logRead("getDoc", ref.path);
  return ref.get();
}

/**
 * Wrapper for Query.get()
 */
export function loggedGetDocs<T = unknown>(
  query: Query<T>
): Promise<QuerySnapshot<T>> {
  // Try to extract path info from query
  const queryWithOptions = query as unknown as { _queryOptions?: { parentPath?: string } };
  const path = queryWithOptions._queryOptions?.parentPath || "query";
  logRead("getDocs", path);
  
  return query.get().then((snapshot) => {
    if (ENABLE_LOGGING) {
      logRead("getDocs", path, snapshot.size);
    }
    return snapshot;
  });
}

/**
 * Helper to wrap adminDb operations
 */
export function createLoggedFirestore(db: Firestore) {
  return {
    ...db,
    collection: (path: string) => {
      const coll = db.collection(path);
      // Logging disabled - use error reporting system if needed
      // if (ENABLE_LOGGING) {
      //   console.log(`[FIRESTORE COLLECTION]: ${path}`);
      // }
      return coll;
    },
  };
}


