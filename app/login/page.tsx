"use client";

import { auth, googleProvider } from "@/lib/firebase-client";
import { signInWithPopup } from "firebase/auth";
import { useState } from "react";
import ThemedSuspense from "@/components/ThemedSuspense";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { appConfig } from "@/lib/app-config";
import { reportException } from "@/lib/error-reporting";

const features = [
  {
    title: "Contacts",
    iconBgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    ),
  },
  {
    title: "Gmail Sync",
    iconBgColor: "bg-green-100",
    iconColor: "text-green-600",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    ),
  },
  {
    title: "AI Insights",
    iconBgColor: "bg-purple-100",
    iconColor: "text-purple-600",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    ),
  },
];

function LoginContent() {
  const searchParams = useSearchParams();
  const expired = searchParams?.get("expired") === "true";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      // Send ID token to session route to create session cookie
      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create session");
      }

      // Verify session was created successfully before redirecting
      const verifyResponse = await fetch("/api/auth/check", {
        credentials: "include",
      });
      
      if (!verifyResponse.ok) {
        throw new Error("Session verification failed");
      }

      // Use router.push instead of window.location.href for smoother navigation
      window.location.href = "/";
    } catch (e) {
      reportException(e, {
        context: "Login failed",
        tags: { component: "LoginPage" },
      });
      setError(
        e instanceof Error ? e.message : "Login failed. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-radial from-neutral-200 via-neutral-100 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#212B36] rounded-2xl mb-6 shadow-lg">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-3">
            {appConfig.crmName}
          </h1>
          <p className="text-theme-dark text-lg">
            Manage your contacts and relationships with ease
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#EEEEEC] rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-theme-darkest mb-2">
              Welcome back
            </h2>
            <p className="text-gray-500">
              Sign in with your Google account to continue
            </p>
          </div>

          {expired && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-sm">
              <p className="text-sm text-amber-800">
                Your session has expired. Please sign in again.
              </p>
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={loading}
            loading={loading}
            variant="outline"
            size="lg"
            fullWidth
            icon={
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            }
            className="border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 shadow-sm hover:shadow-md"
            error={error}
          >
            Sign in with Google
          </Button>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-[#EEEEEC]/60 backdrop-blur-sm rounded-xl">
            <div className="w-10 h-10 bg-blue-100 rounded-sm flex items-center justify-center mx-auto mb-2">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <p className="text-xs font-medium text-theme-darker">Contacts</p>
          </div>
          <div className="p-4 bg-[#EEEEEC]/60 backdrop-blur-sm rounded-xl">
            <div className="w-10 h-10 bg-green-100 rounded-sm flex items-center justify-center mx-auto mb-2">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-xs font-medium text-theme-darker">Gmail Sync</p>
          </div>
          <div className="p-4 bg-[#EEEEEC]/60 backdrop-blur-sm rounded-xl">
            <div className="w-10 h-10 bg-purple-100 rounded-sm flex items-center justify-center mx-auto mb-2">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <p className="text-xs font-medium text-theme-darker">AI Insights</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ThemedSuspense fallback={
      <div className="min-h-screen bg-radial from-neutral-200 via-neutral-100 to-blue-100 flex items-center justify-center">
        <div className="text-theme-dark">Loading...</div>
      </div>
    }>
      <LoginContent />
    </ThemedSuspense>
  );
}
