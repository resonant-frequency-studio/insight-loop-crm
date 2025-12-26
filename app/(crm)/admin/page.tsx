"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loading from "@/components/Loading";
import Card from "@/components/Card";
import { Button } from "@/components/Button";

interface AdminPageLink {
  href: string;
  title: string;
  description: string;
}

const adminPages: AdminPageLink[] = [
      {
        href: "/admin/process-unknown-segment",
        title: "Process Segment Contacts",
        description: "Sync Gmail threads, generate contact insights, and create tags for contacts in a specific segment",
      },
  {
    href: "/admin/enrich-contacts",
    title: "Enrich Contacts with People API",
    description: "Bulk enrich contacts with first name, last name, company, and profile photos from Google People API",
  },
  {
    href: "/admin/enrich-single-contact",
    title: "Enrich Single Contact",
    description: "Enrich a single contact with data from Google People API by email address",
  },
  {
    href: "/admin/cleanup-tags",
    title: "Cleanup Tags",
    description: "Remove unused or duplicate tags from contacts to keep your tag list organized",
  },
  {
    href: "/admin/cleanup-touchpoints",
    title: "Cleanup Touchpoints",
    description: "Remove completed or outdated touchpoints from contacts",
  },
  {
    href: "/admin/cleanup-action-items",
    title: "Cleanup Action Items",
    description: "Remove completed or outdated action items from contacts",
  },
  {
    href: "/admin/bulk-unlink-events",
    title: "Bulk Unlink Events",
    description: "Unlink calendar events from contacts in bulk",
  },
  {
    href: "/admin/extract-names",
    title: "Extract Names from Emails",
    description: "Extract first and last names from email addresses and update contact records",
  },
  {
    href: "/admin/migrate-action-items",
    title: "Migrate Action Items",
    description: "Migrate action items between different data structures or formats",
  },
];

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return <Loading />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Admin Tools</h1>
        <p className="text-theme-dark text-lg">
          Administrative tools for managing and maintaining your CRM data
        </p>
      </div>

      {/* Reconnect Google Account */}
      <Card padding="lg" className="bg-warning-yellow-bg border-warning-yellow-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-warning-yellow-text-primary mb-2">
              Reconnect Google Account
            </h2>
            <p className="text-sm text-warning-yellow-text-secondary mb-4">
              If you&apos;re experiencing issues with Gmail, Calendar, or Contacts sync, you may need to reconnect your Google account. 
              This will refresh your OAuth permissions and restore access to Google services.
            </p>
            <a
              href="/api/oauth/gmail/start?force=true&redirect=/admin"
              className="inline-block"
            >
              <Button variant="primary" size="md">
                Reconnect Google Account
              </Button>
            </a>
          </div>
          <div className="hidden md:block">
            <svg
              className="w-24 h-24 text-warning-yellow-text-accent opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
        </div>
      </Card>

      {/* Admin Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminPages.map((page) => (
          <Link key={page.href} href={page.href}>
            <Card padding="md" className="h-full hover:shadow-md transition-shadow cursor-pointer border-theme-lighter hover:border-theme-light">
              <h3 className="text-lg font-semibold text-theme-darkest mb-2">
                {page.title}
              </h3>
              <p className="text-sm text-theme-dark leading-relaxed">
                {page.description}
              </p>
              <div className="mt-4 flex items-center text-sm text-theme-medium">
                <span>Go to tool</span>
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

