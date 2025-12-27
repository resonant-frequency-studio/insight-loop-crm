import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";

/**
 * Hook to handle authentication redirect logic
 */
export function useAuthRedirect(
  isLoginPage: boolean,
  loading: boolean,
  user: User | null,
  hasSessionCookie: boolean | null
) {
  const router = useRouter();

  // Redirect to login if not authenticated and not on login page
  // Allow page to render if session cookie is valid (for E2E tests)
  useEffect(() => {
    if (isLoginPage) return;
    
    // Wait for auth state and session cookie check to complete
    if (loading || (hasSessionCookie === null && !user)) {
      return; // Still checking
    }
    
    // Redirect if not authenticated (no Firebase user and no valid session cookie)
    if (!user && hasSessionCookie !== true) {
      router.push("/login");
    }
  }, [isLoginPage, loading, user, router, hasSessionCookie]);
}

