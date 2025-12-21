"use client";

import Card from "@/components/Card";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface ActionItemsStatsProps {
  total: number;
  pending: number;
  overdue: number;
  today: number;
  isLoading?: boolean;
}

export default function ActionItemsStats({
  total,
  pending,
  overdue,
  today,
  isLoading = false,
}: ActionItemsStatsProps) {
  // Animate numbers from 0 to target
  // Only show 0 when loading AND no data yet
  // Once we have data (even from cache), animate to the target values
  const animatedTotal = useAnimatedNumber(total);
  const animatedPending = useAnimatedNumber(pending);
  const animatedOverdue = useAnimatedNumber(overdue);
  const animatedToday = useAnimatedNumber(today);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card padding="md">
        <p className="text-sm font-medium text-gray-500 mb-1">Total</p>
        <p className="text-2xl font-bold text-theme-darkest">{animatedTotal}</p>
      </Card>
      <Card padding="md">
        <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
        <p className="text-2xl font-bold text-blue-600">{animatedPending}</p>
      </Card>
      <Card padding="md">
        <p className="text-sm font-medium text-gray-500 mb-1">Overdue</p>
        <p className="text-2xl font-bold text-red-600">{animatedOverdue}</p>
      </Card>
      <Card padding="md">
        <p className="text-sm font-medium text-gray-500 mb-1">Due Today</p>
        <p className="text-2xl font-bold text-amber-600">{animatedToday}</p>
      </Card>
    </div>
  );
}

