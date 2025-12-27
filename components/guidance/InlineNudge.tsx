"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import Card from "@/components/Card";

interface InlineNudgeProps {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  onDismiss: () => void;
}

export function InlineNudge({ title, body, ctaLabel, ctaHref, onDismiss }: InlineNudgeProps) {
  return (
    <Card padding="md" className="bg-card-highlight-light border-theme-light">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-theme-darkest mb-2">{title}</h3>
          <p className="text-sm text-theme-darker leading-relaxed mb-4">{body}</p>
          <Link href={ctaHref}>
            <Button size="sm" variant="primary">
              {ctaLabel}
            </Button>
          </Link>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 text-theme-medium hover:text-theme-darkest transition-colors"
          aria-label="Dismiss"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </Card>
  );
}

