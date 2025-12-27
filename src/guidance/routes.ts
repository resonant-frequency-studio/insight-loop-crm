export type RouteKey =
  | "dashboard"
  | "schedule"
  | "contacts"
  | "contact_detail"
  | "insights"
  | "action_items"
  | "sync"
  | "faq";

/**
 * Map pathname to stable route key
 */
export function getRouteKeyFromPathname(pathname: string): RouteKey | null {
  // Exact matches
  if (pathname === "/") return "dashboard";
  if (pathname === "/schedule") return "schedule";
  if (pathname === "/contacts") return "contacts";
  if (pathname === "/insights") return "insights";
  if (pathname === "/action-items") return "action_items";
  if (pathname === "/sync") return "sync";
  if (pathname === "/faq") return "faq";

  // Pattern matches
  if (pathname.startsWith("/contacts/") && pathname !== "/contacts/new" && pathname !== "/contacts/import") {
    return "contact_detail";
  }

  return null;
}

