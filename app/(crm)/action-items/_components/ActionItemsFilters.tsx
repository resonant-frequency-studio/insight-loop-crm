"use client";

import Card from "@/components/Card";
import Select from "@/components/Select";
import { useActionItemsFilters, FilterStatus, FilterDate } from "./ActionItemsFiltersContext";
import { Contact } from "@/types/firestore";

interface ActionItemsFiltersProps {
  contacts: Array<[string, Contact]>;
  uniqueContactIds: string[];
}

export default function ActionItemsFilters({
  contacts,
  uniqueContactIds,
}: ActionItemsFiltersProps) {
  const {
    filterStatus,
    setFilterStatus,
    filterDate,
    setFilterDate,
    selectedContactId,
    setSelectedContactId,
  } = useActionItemsFilters();

  const contactsMap = new Map(contacts);

  return (
    <Card padding="md">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="filter-status" className="block text-sm font-medium text-theme-darker mb-2">
            Filter by Status
          </label>
          <Select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="filter-date" className="block text-sm font-medium text-theme-darker mb-2">
            Filter by Date
          </label>
          <Select
            id="filter-date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value as FilterDate)}
          >
            <option value="all">All Dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="thisWeek">Due This Week</option>
            <option value="upcoming">Upcoming</option>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="filter-contact" className="block text-sm font-medium text-theme-darker mb-2">
            Filter by Contact
          </label>
          <Select
            id="filter-contact"
            value={selectedContactId ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedContactId(value === "" ? null : value);
            }}
          >
            <option value="">All Contacts</option>
            {uniqueContactIds.map((contactId) => {
              const contact = contactsMap.get(contactId);
              const name = contact
                ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                  contact.primaryEmail
                : "";
              if (!name) return null; // Don't show empty option
              return (
                <option key={contactId} value={contactId}>
                  {name}
                </option>
              );
            })}
          </Select>
        </div>
      </div>
    </Card>
  );
}

