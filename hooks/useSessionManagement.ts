import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { reportException } from "@/lib/error-reporting";
import type { User } from "firebase/auth";

/**
 * Hook to manage session validation and cookie checking
 */
export function useSessionManagement(
  isLoginPage: boolean,
  loading: boolean,
  user: User | null
) {
  const router = useRouter();
  const [hasSessionCookie, setHasSessionCookie] = useState<boolean | null>(null);

  // Check session validity periodically (not immediately to avoid race conditions after login)
  useEffect(() => {
    if (isLoginPage || loading || !user) return;

    let intervalId: NodeJS.Timeout | null = null;
    let failureCount = 0;
    const MAX_FAILURES = 2; // Allow 2 failures before redirecting (to account for timing issues)

    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/check", {
          credentials: "include", // Ensure cookies are sent
        });
        if (!res.ok) {
          failureCount++;
          // Only redirect after multiple failures (to avoid false positives after login)
          if (failureCount >= MAX_FAILURES) {
            router.push("/login?expired=true");
          }
        } else {
          // Reset failure count on success
          failureCount = 0;
        }
      } catch (error) {
        reportException(error, {
          context: "Session check failed",
          tags: { component: "CrmLayoutWrapper" },
        });
        // Don't increment failure count on network errors
      }
    };

    // Delay initial check to avoid race condition with cookie being set after login
    // Longer delay to ensure cookie is fully available
    const initialDelay = setTimeout(() => {
      checkSession();
      // Check session every 5 minutes
      intervalId = setInterval(checkSession, 5 * 60 * 1000);
    }, 2000); // Wait 2 seconds after mount before first check

    return () => {
      clearTimeout(initialDelay);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isLoginPage, loading, user, router]);

  // Check session cookie when there's no Firebase user (for E2E tests that use session cookies only)
  useEffect(() => {
    if (!user && !loading) {
      fetch("/api/auth/check", {
        credentials: "include",
      })
        .then((response) => {
          setHasSessionCookie(response.ok);
        })
        .catch(() => {
          setHasSessionCookie(false);
        });
    } else {
      setHasSessionCookie(user ? true : null);
    }
  }, [user, loading]);

  return {
    hasSessionCookie,
  };
}

