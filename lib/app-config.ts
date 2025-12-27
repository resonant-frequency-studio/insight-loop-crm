/**
 * Application configuration
 * Reads from environment variables with sensible defaults
 */

export const appConfig = {
  /**
   * The name of the CRM application
   * Can be overridden via NEXT_PUBLIC_CRM_NAME environment variable
   */
  crmName: process.env.NEXT_PUBLIC_CRM_NAME || "Insight Loop CRM",
  /**
   * Logo URL for the sidebar
   * Can be overridden via NEXT_PUBLIC_CRM_LOGO environment variable
   * If not provided, a placeholder logo will be used
   */
  logoUrl: process.env.NEXT_PUBLIC_CRM_LOGO || null,
} as const;

