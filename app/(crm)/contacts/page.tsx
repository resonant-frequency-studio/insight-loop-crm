"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase-client";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Contact } from "@/types/firestore";
import ExportContactsButton from "@/components/ExportContactsButton";
import ContactsFilter from "@/components/ContactsFilter";
import { useFilterContacts } from "@/hooks/useFilterContacts";
import Loading from "@/components/Loading";
import { getInitials, getDisplayName } from "@/util/contact-utils";

interface ContactWithId extends Contact {
  id: string;
}

export default function ContactsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactWithId[]>([]);
  
  // Use filtering hook
  const filterContacts = useFilterContacts(contacts);
  const { filteredContacts, hasActiveFilters } = filterContacts;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/contacts`),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const contactsData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ContactWithId));
      setContacts(contactsData);
    });

    return () => unsub();
  }, [user, loading, router]);



  if (loading) {
    return <Loading />;
  }
  
  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Contacts</h1>
          <p className="text-gray-600 text-lg">
            {filteredContacts.length} of {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
            {hasActiveFilters && " (filtered)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportContactsButton contacts={filteredContacts} />
          <Link
            href="/contacts/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Contact
          </Link>
        </div>
      </div>

      {/* Filters Section */}
      <ContactsFilter contacts={contacts} {...filterContacts} />

      {/* Contacts Grid */}
      {filteredContacts.length === 0 && contacts.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900 mb-2">No contacts match your filters</p>
          <p className="text-sm text-gray-500 mb-6">
            Try adjusting your search criteria or clear filters to see all contacts
          </p>
          <button
            onClick={filterContacts.onClearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium text-sm"
          >
            Clear Filters
          </button>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900 mb-2">No contacts yet</p>
          <p className="text-sm text-gray-500 mb-6">
            Start by importing contacts from a CSV file
          </p>
          <Link
            href="/contacts/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium text-sm"
          >
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
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Import Contacts
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredContacts.map((contact) => (
            <Link
              key={contact.id}
              href={`/contacts/${contact.id}`}
              className="block bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="shrink-0">
                  <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-sm">
                    {getInitials(contact)}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {getDisplayName(contact)}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
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
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        {contact.primaryEmail}
                      </p>
                    </div>

                    {/* Tags */}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 shrink-0">
                        {contact.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 3 && (
                          <span className="px-2 py-1 text-xs font-medium text-gray-500">
                            +{contact.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  {contact.summary && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                      {contact.summary}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    {contact.threadCount && contact.threadCount > 0 && (
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        {contact.threadCount} {contact.threadCount === 1 ? "thread" : "threads"}
                      </span>
                    )}
                    {contact.segment && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {contact.segment}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow Icon */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg
                    className="w-5 h-5 text-gray-400"
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
