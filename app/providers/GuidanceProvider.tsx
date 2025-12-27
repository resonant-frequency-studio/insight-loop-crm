"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, startTransition } from "react";
import { usePathname } from "next/navigation";
import { TourProvider, useTour } from "@reactour/tour";
import { useAuth } from "@/hooks/useAuth";
import { getRouteKeyFromPathname } from "@/src/guidance/routes";
import { TOUR_STEPS } from "@/src/guidance/tourRegistry";
import { getUserGuidancePreferences, updateUserGuidancePreferences } from "@/src/guidance/user-preferences";
import { isForbiddenZone } from "@/src/guidance/guidance-policy";
import type { RouteKey } from "@/src/guidance/routes";
import type { UserGuidancePreferences } from "@/types/guidance";
import "@/app/providers/tour-styles.css";

interface GuidanceContextValue {
  startTour: (mode?: "fromHere" | "fromBeginning") => void;
  closeTour: (markAsSeen?: boolean) => void;
  isTourOpen: boolean;
}

const GuidanceContext = createContext<GuidanceContextValue | null>(null);

export function useGuidance() {
  const context = useContext(GuidanceContext);
  if (!context) {
    throw new Error("useGuidance must be used within GuidanceProvider");
  }
  return context;
}

function GuidanceProviderInner({ children }: { children: React.ReactNode }) {
  const { setIsOpen, setCurrentStep, setSteps, currentStep, isOpen } = useTour();
  const pathname = usePathname();
  const { user } = useAuth();
  const [currentRouteKey, setCurrentRouteKey] = useState<RouteKey | null>(null);
  const [preferences, setPreferences] = useState<UserGuidancePreferences | null>(null);
  const preferencesLoadedRef = useRef(false);
  const previousPathnameRef = useRef(pathname);
  const previousRouteKeyRef = useRef<RouteKey | null>(null);

  // Load user preferences
  useEffect(() => {
    if (!user?.uid || preferencesLoadedRef.current) return;

    getUserGuidancePreferences(user.uid)
      .then((prefs) => {
        setPreferences(prefs);
        preferencesLoadedRef.current = true;
      })
      .catch((error) => {
        console.error("Failed to load guidance preferences:", error);
        preferencesLoadedRef.current = true;
      });
  }, [user?.uid]);

  const startTour = useCallback(
    (mode: "fromHere" | "fromBeginning" = "fromHere") => {
      if (!currentRouteKey) {
        // Show toast if no tour for current route
        // For now, just log - can add toast component later
        console.log("There's no tour for this page yet. Try the Dashboard.");
        return;
      }

      const steps = TOUR_STEPS[currentRouteKey];
      if (!steps || steps.length === 0) {
        console.log("There's no tour for this page yet. Try the Dashboard.");
        return;
      }

      // Filter out forbidden zones
      const filteredSteps = steps.filter((step) => {
        if (step.selector && typeof step.selector === "string" && isForbiddenZone(step.selector)) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`Tour step targets forbidden zone: ${step.selector}`);
          }
          return false;
        }
        return true;
      });

      if (filteredSteps.length === 0) {
        console.log("No valid tour steps for this page.");
        return;
      }

      if (setSteps) {
        setSteps(filteredSteps);
      }
      if (setCurrentStep) {
        setCurrentStep(mode === "fromBeginning" ? 0 : 0);
      }
      if (setIsOpen) {
        setIsOpen(true);
      }
    },
    [currentRouteKey, setSteps, setCurrentStep, setIsOpen]
  );

  const closeTour = useCallback(async (markAsSeen: boolean = false) => {
    if (setIsOpen) {
      setIsOpen(false);
    }

    // Save tour state
    if (user?.uid && currentRouteKey) {
      try {
        const updates: Partial<UserGuidancePreferences> = {
          lastTourRouteKey: currentRouteKey,
          lastTourStepIndex: currentStep ?? null,
        };

        // If this is the dashboard tour and user completed it, mark as seen
        if (currentRouteKey === "dashboard" && markAsSeen) {
          updates.hasSeenDashboardOrientation = true;
        }

        await updateUserGuidancePreferences(user.uid, updates);
        
        // Update local state
        if (markAsSeen && currentRouteKey === "dashboard") {
          setPreferences((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              hasSeenDashboardOrientation: true,
            };
          });
        }
      } catch (error) {
        console.error("Failed to save tour state:", error);
      }
    }
  }, [setIsOpen, user, currentRouteKey, currentStep]);

  // Update route key when pathname changes
  useEffect(() => {
    const routeKey = getRouteKeyFromPathname(pathname);
    
    // Only update if route key actually changed
    // Use startTransition to mark this as a non-urgent update
    if (routeKey !== previousRouteKeyRef.current) {
      previousRouteKeyRef.current = routeKey;
      startTransition(() => {
        setCurrentRouteKey(routeKey);
      });
    }

    // Close tour if route changes while tour is open
    if (isOpen && previousPathnameRef.current !== pathname) {
      startTransition(() => {
        closeTour();
      });
    }
    previousPathnameRef.current = pathname;
  }, [pathname, isOpen, closeTour]);

  // Auto-show dashboard tour for first-time users
  useEffect(() => {
    if (
      !user?.uid ||
      !preferences ||
      preferencesLoadedRef.current === false ||
      isOpen ||
      currentRouteKey !== "dashboard"
    ) {
      return;
    }

    if (
      preferences.guidanceEnabled &&
      !preferences.hasSeenDashboardOrientation &&
      currentRouteKey === "dashboard"
    ) {
      // Small delay to ensure page is rendered
      const timer = setTimeout(() => {
        startTour("fromHere");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user?.uid, preferences, currentRouteKey, isOpen, startTour]);

  // Mark dashboard tour as seen when it completes (reaches last step and closes)
  useEffect(() => {
    if (!isOpen && user?.uid && currentRouteKey === "dashboard" && preferences) {
      const steps = TOUR_STEPS.dashboard;
      // If we were on the last step and tour closed, mark as seen
      if (currentStep === steps.length - 1 && !preferences.hasSeenDashboardOrientation) {
        updateUserGuidancePreferences(user.uid, {
          hasSeenDashboardOrientation: true,
        }).then(() => {
          setPreferences((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              hasSeenDashboardOrientation: true,
            };
          });
        }).catch((error) => {
          console.error("Failed to mark dashboard tour as seen:", error);
        });
      }
    }
  }, [isOpen, user?.uid, currentRouteKey, currentStep, preferences]);

  const contextValue: GuidanceContextValue = {
    startTour,
    closeTour,
    isTourOpen: isOpen,
  };

  return (
    <GuidanceContext.Provider value={contextValue}>
      {children}
    </GuidanceContext.Provider>
  );
}

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider
      steps={[]}
      afterOpen={(target) => {
        // Scroll to target element
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }}
      onClickClose={({ setIsOpen }) => {
        // Handle close button click - mark as seen if on dashboard tour
        if (setIsOpen) {
          setIsOpen(false);
        }
      }}
      onClickMask={({ setIsOpen }) => {
        // Handle mask click - allow closing
        if (setIsOpen) {
          setIsOpen(false);
        }
      }}
      styles={{
        popover: (base) => ({
          ...base,
          backgroundColor: "var(--card-highlight-light)",
          border: "1px solid var(--theme-light)",
          borderRadius: "8px",
          padding: "20px",
          maxWidth: "400px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }),
        maskArea: (base) => ({
          ...base,
          rx: 8,
        }),
        badge: (base) => ({
          ...base,
          backgroundColor: "var(--theme-light)",
          color: "var(--foreground)",
        }),
        controls: (base) => ({
          ...base,
          marginTop: "16px",
        }),
        close: (base) => ({
          ...base,
          right: "8px",
          top: "8px",
          color: "var(--theme-dark)",
        }),
      }}
      showCloseButton={true}
      showNavigation={true}
      showBadge={true}
      className="guidance-tour"
    >
      <GuidanceProviderInner>{children}</GuidanceProviderInner>
    </TourProvider>
  );
}

