"use client";

import { useState } from "react";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { appConfig } from "@/lib/app-config";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface FAQPageClientProps {
  faqData: FAQItem[];
  categories: string[];
}

export default function FAQPageClient({ faqData, categories }: FAQPageClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filteredFAQs = selectedCategory
    ? faqData.filter((item) => item.category === selectedCategory)
    : faqData;

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Frequently Asked Questions</h1>
        <p className="text-theme-dark text-lg">
          Find answers to common questions about using the {appConfig.crmName}
        </p>
      </div>

      {/* Category Filters */}
      <Card padding="md">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setSelectedCategory(null)}
            variant={selectedCategory === null ? "primary" : "outline"}
            size="sm"
          >
            All Categories
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                setOpenIndex(null);
              }}
              variant={selectedCategory === category ? "primary" : "outline"}
              size="sm"
            >
              {category}
            </Button>
          ))}
        </div>
      </Card>

      {/* FAQ List */}
      <div className="space-y-4">
        {filteredFAQs.map((faq) => {
          const actualIndex = faqData.indexOf(faq);
          const isOpen = openIndex === actualIndex;

          return (
            <Card
              key={actualIndex}
              padding="none"
              className="overflow-hidden"
            >
              <Button
                onClick={() => toggleFAQ(actualIndex)}
                variant="outline"
                className="w-full px-6 py-5 text-left flex items-start justify-between gap-4 hover:bg-gray-50 group cursor-pointer"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-sm">
                      {faq.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-theme-darkest group-hover:text-blue-600 transition-colors">
                    {faq.question}
                  </h3>
                </div>
                <div className="shrink-0 mt-1">
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                      isOpen ? "transform rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </Button>
              <div
                className={`transition-all duration-300 ease-in-out ${
                  isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                } overflow-hidden`}
              >
                <div className="px-6 pb-5 pt-0">
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-theme-darker leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Contact Support */}
      <Card padding="lg" className="bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <div className="w-12 h-12 bg-blue-600 rounded-sm flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-theme-darkest mb-2">Still have questions?</h3>
            <p className="text-theme-darker mb-4">
              Can&apos;t find what you&apos;re looking for? Our support team is here to help you get the most out of your CRM.
            </p>
            <p className="text-sm text-theme-dark">
              Reach out through your normal support channels or check your account documentation for additional resources.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

