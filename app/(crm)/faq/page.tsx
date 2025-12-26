import { Metadata } from "next";
import FAQPageClient from "./FAQPageClient";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  {
    category: "Getting Started",
    question: "How do I add contacts to my CRM?",
    answer: "You can add contacts in two ways: (1) Manually by clicking 'Add Contact' on the Contacts page and filling in the contact details, or (2) Import multiple contacts at once by going to 'Import Contacts' and uploading a CSV file. The CSV should include columns like Email, FirstName, LastName, and any other contact fields you want to include.",
  },
  {
    category: "Getting Started",
    question: "What information should I include when creating a contact?",
    answer: "At minimum, you need an email address. You can also add first name, last name, tags, segment, lead source, notes, and set a next touchpoint date. The more information you provide, the better the CRM can help you manage your relationships.",
  },
  {
    category: "Contacts",
    question: "How does the email integration work?",
    answer: "The CRM syncs with your Gmail account to automatically track email threads with your contacts. When emails are synced, you'll see the last email date, thread count, and engagement scores automatically calculated based on your email interactions.",
  },
  {
    category: "Contacts",
    question: "What is an engagement score and how is it calculated?",
    answer: "The engagement score (0-100) measures how actively engaged a contact is with your communications. It's calculated based on factors like email frequency, responses, email opens, and overall interaction patterns. Higher scores indicate more active engagement.",
  },
  {
    category: "Contacts",
    question: "How do segments work?",
    answer: "Segments help you categorize contacts into distinct groups based on shared characteristics like company size, industry, customer type, or market segment. You can assign segments manually or use bulk reassignment to update multiple contacts at once. Segments help you tailor your communication and sales strategies.",
  },
  {
    category: "Contacts",
    question: "What's the difference between tags and segments?",
    answer: "Tags are flexible labels you can use for any classification (e.g., 'Lacrosse', 'Tournament', 'VIP'). You can assign multiple tags to a contact. Segments are more structured categories used for strategic grouping (e.g., 'High Potential Prospect', 'Active Client'). A contact typically has one segment but can have multiple tags.",
  },
  {
    category: "AI Features",
    question: "What AI-powered insights are available?",
    answer: "The CRM provides AI-generated summaries of your contacts, sentiment analysis (Positive, Neutral, Negative), action items, pain points, relationship insights, and coaching themes. These insights are derived from your email interactions and help you understand your contacts better.",
  },
  {
    category: "AI Features",
    question: "How do I use the outreach draft feature?",
    answer: "The outreach draft field on each contact's page allows you to write and save draft messages for your next outreach. Click 'Save Draft' to save only the draft, or use 'Continue in Gmail' to automatically save your draft and open Gmail with the message pre-filled. The draft is saved independently from other contact changes and can be edited at any time.",
  },
  {
    category: "AI Features",
    question: "What does 'Continue in Gmail' do?",
    answer: "The 'Continue in Gmail' button appears when you have draft content and the contact has an email address. Clicking it will automatically save your draft, then open Gmail in a new tab with the contact's email address, your draft message, and a default subject line already filled in. This makes it easy to send your prepared outreach message directly from Gmail.",
  },
  {
    category: "Contact Management",
    question: "How do I filter and search for contacts?",
    answer: "Use the Filters & Search section on the Contacts page. You can search by email, first name, or last name. You can also filter by segment or tags. Multiple filters can be combined to narrow down your contact list. Clear filters at any time to see all contacts again.",
  },
  {
    category: "Contact Management",
    question: "Can I bulk update multiple contacts at once?",
    answer: "Yes! Select contacts using the checkboxes, then click 'Reassign Segment' in the bulk action bar. You can select all filtered contacts at once or choose individual contacts. You can select an existing segment or create a new one. This is perfect for organizing contacts after importing or when restructuring your segments.",
  },
  {
    category: "Contact Management",
    question: "What's the difference between 'Save Draft' and 'Save All Changes'?",
    answer: "'Save Draft' (in the Outreach Draft section) saves only the draft message. 'Save All Changes' (at the bottom of the page) saves all other contact fields like name, tags, segment, notes, and next touchpoint - but not the draft. This separation allows you to save your draft independently while you're still editing other contact information.",
  },
  {
    category: "Contact Management",
    question: "How do I export my contacts?",
    answer: "On the Contacts page, you have two export options: (1) Click 'Download Contacts' to export filtered contacts as a CSV file that you can use in other applications, or (2) Click 'Export to Google' to export filtered contacts directly to your Google Contacts with the option to add them to an existing or new contact group.",
  },
  {
    category: "Import/Export",
    question: "What CSV format should I use for importing?",
    answer: "Your CSV should include an 'Email' column (required), and optionally: FirstName, LastName, Tags (comma-separated), Segment, LeadSource, Notes, Summary, ActionItems, Sentiment, and other contact fields. Check the 'CSV Format Guide' on the Import page for detailed instructions.",
  },
  {
    category: "Import/Export",
    question: "What happens if I import contacts that already exist?",
    answer: "When importing, you can choose to 'Overwrite existing contacts' (updates existing contacts with new data) or 'Don't overwrite existing contacts' (only adds new contacts, skips duplicates). Duplicate detection is based on email address.",
  },
  {
    category: "Touchpoints",
    question: "How do I manage upcoming touchpoints?",
    answer: "On each contact's detail page, you can set a 'Next Touchpoint Date' and add a message about what to discuss. The Dashboard shows contacts with upcoming touchpoints in the next 60 days, helping you stay on top of your follow-ups.",
  },
  {
    category: "Touchpoints",
    question: "Where can I see all my upcoming touchpoints?",
    answer: "The Dashboard displays contacts with upcoming touchpoints at the top of the Recent Contacts section. Touchpoints within the next 60 days are shown, sorted by date. Click any contact to view full details and their touchpoint message.",
  },
  {
    category: "Dashboard",
    question: "What statistics are shown on the dashboard?",
    answer: "The dashboard displays total contacts, contacts with email threads, average engagement score, and visual charts showing contact distribution by segments, lead sources, engagement levels, top tags, and sentiment analysis. This gives you a comprehensive overview of your contact database.",
  },
  {
    category: "Dashboard",
    question: "How are 'Recent Contacts' determined?",
    answer: "Recent Contacts shows the 5 most recently updated contacts, sorted by their last update time. This helps you quickly see which contacts you've been working with most recently.",
  },
  {
    category: "Account & Security",
    question: "How does multi-user authentication work?",
    answer: "The CRM uses secure session-based authentication. Each user logs in with their Google account, and the system creates a secure session cookie that identifies you for all server operations. Your Gmail sync, contacts, and data are completely separate from other users. Each user's data is stored securely and privately.",
  },
  {
    category: "Account & Security",
    question: "How long does my session last?",
    answer: "Your session lasts for 5 days. After that time, you'll need to log in again for security. If your session expires while you're using the CRM, you'll be automatically redirected to the login page with a message indicating your session has expired.",
  },
  {
    category: "Account & Security",
    question: "Can multiple people use the CRM at the same time?",
    answer: "Yes! The CRM supports multiple users. Each user logs in with their own Google account, and all data (contacts, emails, summaries) is kept completely separate. You and your wife (or other users) can use the CRM simultaneously without seeing each other's data.",
  },
  {
    category: "Account & Security",
    question: "How do I sign out?",
    answer: "Click the 'Sign Out' button at the bottom of the left sidebar. This will clear your Firebase authentication and session cookie, then redirect you to the login page. Your data remains safe and secure - you'll just need to log in again to access it.",
  },
  {
    category: "Account & Security",
    question: "Why do I see my name and email in the sidebar?",
    answer: "The sidebar displays your profile information (name and email) so you can always confirm which account you're logged into. This is especially helpful in multi-user environments to ensure you're viewing your own data.",
  },
];

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Insight Loop CRM",
  description: "Find answers to common questions about using Insight Loop CRM",
};

export default function FAQPage() {
  const categories = Array.from(new Set(faqData.map((item) => item.category)));

  return <FAQPageClient faqData={faqData} categories={categories} />;
}
