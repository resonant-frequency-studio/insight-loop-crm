"use client";

import Card from "@/components/Card";

interface ActionItemsStatsProps {
  total: number;
  pending: number;
  overdue: number;
  today: number;
}

export default function ActionItemsStats({
  total,
  pending,
  overdue,
  today,
}: ActionItemsStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card padding="md">
        <p className="text-sm font-medium text-gray-500 mb-1">Total</p>
        <p className="text-2xl font-bold text-theme-darkest">{total}</p>
      </Card>
      <Card padding="md">
        <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
        <p className="text-2xl font-bold text-blue-600">{pending}</p>
      </Card>
      <Card padding="md">
        <p className="text-sm font-medium text-gray-500 mb-1">Overdue</p>
        <p className="text-2xl font-bold text-red-600">{overdue}</p>
      </Card>
      <Card padding="md">
        <p className="text-sm font-medium text-gray-500 mb-1">Due Today</p>
        <p className="text-2xl font-bold text-amber-600">{today}</p>
      </Card>
    </div>
  );
}

