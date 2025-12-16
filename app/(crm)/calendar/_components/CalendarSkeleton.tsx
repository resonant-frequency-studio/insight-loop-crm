"use client";

import Card from "@/components/Card";

export default function CalendarSkeleton() {
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeks = 5; // Approximate number of weeks in a month view

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4">
        {/* Calendar Header Skeleton */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            {/* Navigation buttons skeleton */}
            <div className="flex gap-2">
              <div className="h-8 w-16 bg-theme-light rounded-sm animate-pulse" />
              <div className="h-8 w-16 bg-theme-light rounded-sm animate-pulse" />
              <div className="h-8 w-16 bg-theme-light rounded-sm animate-pulse" />
            </div>
            {/* Month/Year skeleton */}
            <div className="h-6 w-32 bg-theme-light rounded-sm animate-pulse" />
            {/* View buttons skeleton */}
            <div className="flex gap-1">
              <div className="h-8 w-16 bg-theme-light rounded-sm animate-pulse" />
              <div className="h-8 w-16 bg-theme-light rounded-sm animate-pulse" />
              <div className="h-8 w-16 bg-theme-light rounded-sm animate-pulse" />
              <div className="h-8 w-20 bg-theme-light rounded-sm animate-pulse" />
            </div>
          </div>
        </div>

        {/* Calendar Grid Skeleton */}
        <div className="border border-theme-light rounded-sm overflow-hidden" style={{ height: 600 }}>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-theme-light">
            {daysOfWeek.map((day, index) => (
              <div
                key={index}
                className="text-center font-medium text-theme-dark bg-selected-background border-r border-theme-light last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: weeks * 7 }).map((_, index) => {
              const isToday = index === 15; // Approximate "today" position
              const hasEvent = index % 7 === 0 || index % 7 === 3 || index % 7 === 5; // Some cells have events
              const eventCount = index % 7 === 0 ? 2 : index % 7 === 3 ? 1 : 0; // Varying event counts

              return (
                <div
                  key={index}
                  className={`min-h-[120px] border-r border-b border-theme-light last:border-r-0 p-2 ${
                    isToday ? "bg-selected-active" : "bg-background"
                  }`}
                >
                  {/* Date number skeleton */}
                  <div className={`h-5 w-6 mb-2 rounded-sm ${
                    isToday 
                      ? "bg-theme-medium animate-pulse" 
                      : "bg-theme-light animate-pulse"
                  }`} />

                  {/* Event blocks skeleton */}
                  {hasEvent && (
                    <div className="space-y-1">
                      {Array.from({ length: eventCount }).map((_, eventIndex) => {
                        // Use deterministic widths based on index to avoid React hydration issues
                        const widths = [75, 90, 65, 85];
                        const width = widths[eventIndex % widths.length];
                        return (
                          <div
                            key={eventIndex}
                            className="h-5 bg-card-tag rounded-sm animate-pulse opacity-60"
                            style={{ width: `${width}%` }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

