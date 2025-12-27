"use client";

import { useState } from "react";
import CollapsibleSection from "./CollapsibleSection";

interface JoinLink {
  type: string;
  url: string;
}

interface EventJoinInfoSectionProps {
  joinLinks: JoinLink[];
  defaultExpanded?: boolean;
}

export default function EventJoinInfoSection({
  joinLinks,
  defaultExpanded = false,
}: EventJoinInfoSectionProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyLink = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error: unknown) {
      // Silently fail - clipboard errors are usually user permission issues
    }
  };

  const joinInfoIcon = (
    <svg
      className="w-5 h-5 text-theme-medium"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );

  if (joinLinks.length === 0) {
    return null;
  }

  const preview = joinLinks.length > 0 ? "Join link" : undefined;

  return (
    <CollapsibleSection
      title="Join Information"
      defaultExpanded={defaultExpanded}
      preview={preview}
      icon={joinInfoIcon}
    >
      <div className="space-y-3">
        {joinLinks.map((link, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium capitalize text-theme-darkest">
                  {link.type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm truncate flex-1 min-w-0 focus:outline-none"
                  style={{
                    color: 'var(--link)',
                    textDecorationColor: 'var(--divider)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--link-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--link)';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring)';
                    e.currentTarget.style.borderRadius = '0.25rem';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {link.url}
                </a>
                <button
                  onClick={() => handleCopyLink(link.url, index)}
                  className="p-1 rounded-sm transition-colors shrink-0 focus:outline-none"
                  style={{
                    color: 'var(--text-muted)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  aria-label="Copy link"
                  title="Copy link"
                >
                  {copiedIndex === index ? (
                    <svg
                      className="w-4 h-4 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

