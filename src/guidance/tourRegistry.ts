import type { RouteKey } from "./routes";
import { dashboardSteps } from "./steps/dashboard";
import type { StepType } from "@reactour/tour";

export type TourStep = StepType;

export const TOUR_STEPS: Record<RouteKey, TourStep[]> = {
  dashboard: dashboardSteps,
  schedule: [],
  contacts: [],
  contact_detail: [],
  insights: [],
  action_items: [],
  sync: [],
  faq: [],
};

