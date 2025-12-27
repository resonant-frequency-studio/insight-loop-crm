export interface UserGuidancePreferences {
  guidanceEnabled: boolean; // default true
  hasSeenDashboardOrientation: boolean; // default false
  lastTourRouteKey: string | null;
  lastTourStepIndex: number | null;
  dismissedNudges: {
    contactsEmpty?: boolean;
  };
}

export const DEFAULT_GUIDANCE_PREFERENCES: UserGuidancePreferences = {
  guidanceEnabled: true,
  hasSeenDashboardOrientation: false,
  lastTourRouteKey: null,
  lastTourStepIndex: null,
  dismissedNudges: {},
};

