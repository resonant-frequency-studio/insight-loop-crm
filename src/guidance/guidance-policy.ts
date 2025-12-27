/**
 * Zones that should never be targeted by tour steps
 * These are admin, config, debug, or metadata-heavy UI elements
 */
export const NEVER_GUIDE_ZONES: string[] = [
  "dashboard-sync-status",
  "dashboard-import-contacts",
  "dashboard-faq",
  "dashboard-admin-metrics",
  "#sync-status",
  "#import-contacts",
  "#admin",
];

/**
 * Check if a selector targets a forbidden zone
 */
export function isForbiddenZone(selector: string): boolean {
  return NEVER_GUIDE_ZONES.some((zone) => {
    // Check if selector matches zone (with or without #)
    const normalizedSelector = selector.startsWith("#") ? selector : `#${selector}`;
    const normalizedZone = zone.startsWith("#") ? zone : `#${zone}`;
    return normalizedSelector === normalizedZone || normalizedSelector.includes(zone);
  });
}

