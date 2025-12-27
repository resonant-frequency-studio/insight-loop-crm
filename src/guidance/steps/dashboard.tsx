"use client";

import type { StepType } from "@reactour/tour";

export const dashboardSteps: StepType[] = [
  {
    selector: "#dashboard-root",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          Welcome back. This is your relationship workspace.
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed">
          This dashboard isn&apos;t a to-do list. It&apos;s a snapshot of the relationships that need your attention right now.
          You don&apos;t need to act on everything here—just notice what stands out.
        </p>
      </div>
    ),
    position: "bottom",
  },
  {
    selector: "#dashboard-root",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          How to read this page
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed mb-2">
          Think in three rhythms:
        </p>
        <ul className="text-theme-darker text-sm space-y-1 list-disc list-inside">
          <li>Today — meetings, touchpoints, and commitments that are timely</li>
          <li>Follow-through — action items you&apos;ve promised to complete</li>
          <li>Awareness — relationships that may need a gentle check-in</li>
        </ul>
      </div>
    ),
    position: "bottom",
  },
  {
    selector: "#dashboard-root",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          A good day
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed">
          If you leave with one clear next step, this page did its job.
          Consistency beats completeness.
        </p>
      </div>
    ),
    position: "bottom",
  },
  {
    selector: "#dashboard-root",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          You don&apos;t need to learn this all now.
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed">
          Start where the energy feels easiest.
        </p>
      </div>
    ),
    position: "bottom",
  },
  {
    selector: "[data-tour=\"nav-insights\"]",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          Insights help you notice patterns
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed">
          When you&apos;re ready, visit Insights to see which relationships need attention. It&apos;s a thoughtful reflection on your active connections.
        </p>
      </div>
    ),
    position: "right",
  },
  {
    selector: "[data-tour=\"nav-schedule\"]",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          Your calendar lives here
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed">
          Schedule shows your meetings, touchpoints, and commitments. Link events to contacts to see everything in one place.
        </p>
      </div>
    ),
    position: "right",
  },
  {
    selector: "[data-tour=\"nav-contacts\"]",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          Your relationship database
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed">
          Contacts is where you manage everyone you stay close to. Add people, track touchpoints, and see your full relationship history.
        </p>
      </div>
    ),
    position: "right",
  },
  {
    selector: "[data-tour=\"nav-action-items\"]",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          What you&apos;ve promised to do
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed">
          Action Items shows tasks you&apos;ve committed to across all your relationships. Follow through on what matters most.
        </p>
      </div>
    ),
    position: "right",
  },
  {
    selector: "#dashboard-root",
    content: (
      <div>
        <h3 className="text-lg font-semibold text-theme-darkest mb-2">
          You don&apos;t need to learn this all now.
        </h3>
        <p className="text-theme-darker text-sm leading-relaxed">
          Start where the energy feels easiest. You can always restart this tour from your profile menu.
        </p>
      </div>
    ),
    position: "bottom",
  },
];

