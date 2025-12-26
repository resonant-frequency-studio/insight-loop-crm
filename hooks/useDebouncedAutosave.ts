"use client";

import { useCallback, useRef, useEffect } from "react";
import { useContactAutosave } from "@/components/contacts/ContactAutosaveProvider";

interface UseDebouncedAutosaveOptions {
  delayMs?: number;
}

export function useDebouncedAutosave(options: UseDebouncedAutosaveOptions = {}) {
  const { delayMs = 5000 } = options; // Default to 5 seconds (5000ms) - save on blur or after 5s inactivity
  const { markDirty, markClean, registerPending, setError, registerFlushCallback } = useContactAutosave();
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const saveFunctionsRef = useRef<Map<string, () => Promise<void>>>(new Map());

  // Register flush callback with provider
  // Use a ref to store the latest flush function so it doesn't need to be in dependencies
  const flushAllRef = useRef<(() => Promise<void>) | null>(null);
  
  useEffect(() => {
    flushAllRef.current = async () => {
      const keysToFlush = Array.from(timersRef.current.keys());
      
      // Cancel all timers
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();

      // Execute all pending saves
      const promises = keysToFlush.map(async (k) => {
        const saveFn = saveFunctionsRef.current.get(k);
        if (saveFn) {
          try {
            const promise = saveFn();
            registerPending(promise, k);
            await promise;
            markClean(k);
            saveFunctionsRef.current.delete(k);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to save changes";
            setError({ message: errorMessage, key: k });
            // Don't mark clean on error
            saveFunctionsRef.current.delete(k);
          }
        }
      });

      await Promise.allSettled(promises);
    };

    registerFlushCallback(async () => {
      if (flushAllRef.current) {
        await flushAllRef.current();
      }
    });
  }, [registerFlushCallback, registerPending, markClean, setError]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const schedule = useCallback(
    (key: string, fn: () => Promise<void>, customDelay?: number) => {
      // Cancel existing timer for this key
      const existingTimer = timersRef.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Store the save function
      saveFunctionsRef.current.set(key, fn);

      // Mark as dirty
      markDirty(key);

      // Schedule new save
      const delay = customDelay ?? delayMs;
      const timer = setTimeout(async () => {
        const saveFn = saveFunctionsRef.current.get(key);
        if (!saveFn) return;

        try {
          const promise = saveFn();
          registerPending(promise, key);
          await promise;
          markClean(key);
          saveFunctionsRef.current.delete(key);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to save changes";
          setError({ message: errorMessage, key });
          // Don't mark clean on error - keep it dirty so user can retry
          saveFunctionsRef.current.delete(key);
        } finally {
          timersRef.current.delete(key);
        }
      }, delay);

      timersRef.current.set(key, timer);
    },
    [delayMs, markDirty, markClean, registerPending, setError, registerFlushCallback]
  );

  const flush = useCallback(
    async (key?: string): Promise<void> => {
      if (key) {
        // Flush specific key
        const timer = timersRef.current.get(key);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(key);
        }

        const saveFn = saveFunctionsRef.current.get(key);
        if (saveFn) {
          try {
            const promise = saveFn();
            registerPending(promise, key);
            await promise;
            markClean(key);
            saveFunctionsRef.current.delete(key);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to save changes";
            setError({ message: errorMessage, key });
            // Don't mark clean on error
            saveFunctionsRef.current.delete(key);
            throw error;
          }
        }
      } else {
        // Flush all keys
        const keysToFlush = Array.from(timersRef.current.keys());
        
        // Cancel all timers
        timersRef.current.forEach((timer) => clearTimeout(timer));
        timersRef.current.clear();

        // Execute all pending saves
        const promises = keysToFlush.map(async (k) => {
          const saveFn = saveFunctionsRef.current.get(k);
          if (saveFn) {
            try {
              const promise = saveFn();
              registerPending(promise, k);
              await promise;
              markClean(k);
              saveFunctionsRef.current.delete(k);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Failed to save changes";
              setError({ message: errorMessage, key: k });
              // Don't mark clean on error
              saveFunctionsRef.current.delete(k);
            }
          }
        });

        await Promise.allSettled(promises);
      }
    },
    [markClean, registerPending, setError]
  );

  const cancel = useCallback((key?: string) => {
    if (key) {
      const timer = timersRef.current.get(key);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(key);
      }
      saveFunctionsRef.current.delete(key);
      markClean(key);
    } else {
      // Cancel all
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      saveFunctionsRef.current.clear();
      // Note: We don't mark clean all keys here because they might still be dirty
      // The component should handle cleanup
    }
  }, [markClean]);

  return {
    schedule,
    flush,
    cancel,
  };
}

