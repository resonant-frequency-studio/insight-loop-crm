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
    answer: "The CRM syncs with your Gmail account to automatically track email threads with your contacts. Gmail sync runs automatically every 15-30 minutes via cron jobs, or you can manually trigger a sync from the Sync Status page. When emails are synced, you'll see the last email date, thread count, and engagement scores automatically calculated based on your email interactions.",
  },
  {
    category: "Schedule & Calendar",
    question: "How do I view my calendar events?",
    answer: "Navigate to the 'Schedule' page from the sidebar. You can view your calendar in four different views: Month (overview of the entire month), Week (detailed weekly view), Day (single day focus), or Agenda (list of upcoming events). Switch between views using the view selector at the top of the calendar.",
  },
  {
    category: "Schedule & Calendar",
    question: "What calendar views are available?",
    answer: "The Schedule page offers four views: (1) Month view - see all events in a monthly grid, (2) Week view - detailed weekly schedule with time slots, (3) Day view - focus on a single day with hourly breakdown, and (4) Agenda view - list format showing upcoming events sorted by date. Your view preference is saved and will be remembered when you return.",
  },
  {
    category: "Schedule & Calendar",
    question: "How do I filter calendar events?",
    answer: "Use the filter bar above the calendar to narrow down events. You can filter by segment (to see events linked to contacts in specific segments), by tags (to find events related to contacts with certain tags), search by title or client name, show only events linked to contacts, or show only touchpoint events. Multiple filters can be combined for precise filtering.",
  },
  {
    category: "Schedule & Calendar",
    question: "How do I create a new calendar event?",
    answer: "Click the 'Create Event' button at the top of the Schedule page. Fill in the event details including title, start and end times, and optionally link it to a contact. You can also set the event type (session, follow-up, prep, admin, focus, or hold) to help categorize your schedule. The event will be created in your Google Calendar and sync automatically.",
  },
  {
    category: "Schedule & Calendar",
    question: "How do I link a calendar event to a contact?",
    answer: "When creating or editing an event, use the 'Link to Contact' field to search for and select a contact. Linked events will appear on the contact's detail page in their timeline, and you can filter the calendar to show only events linked to contacts. This helps you see all interactions with a specific contact in one place.",
  },
  {
    category: "Schedule & Calendar",
    question: "What are event types and how are they used?",
    answer: "Event types help categorize your calendar events: Session (client meetings), Follow-up (follow-up calls/meetings), Prep (preparation time), Admin (administrative tasks), Focus (focused work time), and Hold (blocked time). Event types are visually distinguished in the calendar with different colors and styles, making it easy to see at a glance what type of activities fill your schedule.",
  },
  {
    category: "Schedule & Calendar",
    question: "How does calendar sync work?",
    answer: "Calendar events automatically sync from your Google Calendar on a daily schedule via cron jobs. You can also manually trigger a calendar sync from the Sync Status page. When events are synced, they appear in your Schedule view and can be linked to contacts. Changes made in Google Calendar will appear in the CRM after the next sync.",
  },
  {
    category: "Insights",
    question: "What is the Insights page?",
    answer: "The Insights page provides a thoughtful reflection on your active relationships and where they may benefit from attention. It analyzes your contact database to identify relationships needing attention, data quality issues, and opportunities for better engagement. The page is organized into suggested focus areas and coverage analysis sections.",
  },
  {
    category: "Insights",
    question: "What insights are provided?",
    answer: "The Insights page shows: (1) Relationships Needing Attention - contacts with declining engagement or negative sentiment, (2) Sentiment Alerts - contacts with negative sentiment trends, (3) Segment Coverage - distribution of contacts across segments, (4) Tag Coverage - most and least used tags, (5) Missing Lead Sources - contacts without lead source data, and (6) Engagement Insights - patterns in contact engagement levels.",
  },
  {
    category: "Insights",
    question: "How do I use suggested focus areas?",
    answer: "The 'Suggested Focus' section at the top of the Insights page highlights contacts and relationships that may need your attention. These are prioritized based on factors like declining engagement, negative sentiment, or missing data. Click on any insight card to see the specific contacts and take action, such as scheduling a touchpoint or updating contact information.",
  },
  {
    category: "Insights",
    question: "What is relationship health analysis?",
    answer: "Relationship health analysis evaluates the strength and quality of your relationships with contacts. It considers factors like engagement scores, sentiment trends, email frequency, and recency of interactions. Contacts with declining health indicators appear in the 'Relationships Needing Attention' section, helping you proactively maintain important relationships.",
  },
  {
    category: "Insights",
    question: "How often are insights updated?",
    answer: "Insights are calculated in real-time based on your current contact data. As you add contacts, sync emails, update engagement scores, or modify contact information, the insights automatically reflect these changes. There's no need to manually refresh - the page always shows current analysis of your relationship data.",
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
    category: "Sync & Integration",
    question: "How does automatic sync work?",
    answer: "The CRM automatically syncs your data from Google services on a schedule: Gmail sync runs every 15-30 minutes, Calendar sync runs daily, and Contacts sync runs daily. These automatic syncs are handled by cron jobs configured in your deployment. You can also manually trigger syncs from the Sync Status page at any time.",
  },
  {
    category: "Sync & Integration",
    question: "What is the Sync Status page?",
    answer: "The Sync Status page is your central dashboard for monitoring all synchronization operations. It shows the last sync time for Gmail, Calendar, and Contacts, sync history with success/failure status, and allows you to manually trigger syncs. You can also view detailed error messages if a sync fails and track sync progress in real-time.",
  },
  {
    category: "Sync & Integration",
    question: "How do I manually trigger a sync?",
    answer: "Navigate to the 'Sync Status' page and use the 'Sync Gmail', 'Sync Calendar', or 'Sync Contacts' buttons to manually trigger a sync. Manual syncs are useful when you want immediate updates or if you're troubleshooting sync issues. The page will show the sync progress and notify you when it completes.",
  },
  {
    category: "Sync & Integration",
    question: "How does Google Calendar sync work?",
    answer: "Calendar events automatically sync from your Google Calendar on a daily schedule. When events are synced, they appear in your Schedule view. You can link calendar events to contacts for better relationship tracking. Changes made in Google Calendar will appear in the CRM after the next sync, and events created in the CRM will be added to your Google Calendar.",
  },
  {
    category: "Sync & Integration",
    question: "How do I import contacts from Google Contacts?",
    answer: "Navigate to 'Import Contacts' and look for the 'Import from Google Contacts' section. Click the import button to sync contacts directly from your Google Contacts. The import will add new contacts and can optionally update existing contacts. Contacts imported without first name, last name, company, or profile photos will be automatically enriched using Google People API.",
  },
  {
    category: "Sync & Integration",
    question: "What is People API enrichment?",
    answer: "People API enrichment automatically fills in missing contact information using Google's People API. When contacts are imported without first name, last name, company, or profile photos, the CRM automatically attempts to enrich them with this data from your Google Contacts. This happens during the Contacts sync process and helps keep your contact database complete.",
  },
  {
    category: "Sync & Integration",
    question: "How often do syncs run automatically?",
    answer: "Automatic syncs run on different schedules: Gmail sync runs every 15-30 minutes (configurable via cron), Calendar sync runs once daily, and Contacts sync runs once daily. These schedules ensure your data stays up-to-date without manual intervention. You can check the Sync Status page to see when the last sync occurred for each service.",
  },
  {
    category: "Sync & Integration",
    question: "What happens if a sync fails?",
    answer: "If a sync fails, you'll see an error message on the Sync Status page with details about what went wrong. Common issues include expired OAuth tokens (requiring reconnection), network errors, or API rate limits. You can try manually triggering the sync again, or if the issue persists, use the 'Reconnect Google Account' option in the Admin tools to refresh your OAuth permissions.",
  },
  {
    category: "Sync & Integration",
    question: "Can I see the history of sync operations?",
    answer: "Yes! The Sync Status page shows a detailed history of all sync operations, including the date and time, status (success or failure), number of items processed, and any error messages. This history helps you track sync performance over time and identify any patterns in sync issues.",
  },
  {
    category: "Sync & Integration",
    question: "Do I need to set up cron jobs for automatic sync?",
    answer: "Yes, for automatic syncing you'll need to configure cron jobs in your deployment platform (e.g., Vercel Cron Jobs). Set up three cron jobs: one for Gmail sync (every 15-30 minutes), one for Calendar sync (daily), and one for Contacts sync (daily). Each cron job should call the respective sync endpoint with the CRON_SECRET in the Authorization header. See the Deployment Guide for detailed setup instructions.",
  },
  {
    category: "Touchpoints",
    question: "How do I manage upcoming touchpoints?",
    answer: "On each contact's detail page, you can set a 'Next Touchpoint Date' and add a message about what to discuss. You can also view and manage touchpoints on dedicated pages: 'Touchpoints: Today' for touchpoints due today, 'Touchpoints: Overdue' for missed touchpoints, and 'Touchpoints: Upcoming' for future touchpoints. The Dashboard also shows contacts with upcoming touchpoints in the next 60 days.",
  },
  {
    category: "Touchpoints",
    question: "Where can I see all my upcoming touchpoints?",
    answer: "You can view touchpoints in several places: (1) The 'Touchpoints: Upcoming' page shows all future touchpoints sorted by date, (2) The Dashboard displays contacts with upcoming touchpoints in the next 60 days at the top of the Recent Contacts section, and (3) Each contact's detail page shows their next touchpoint. Click any contact to view full details and their touchpoint message.",
  },
  {
    category: "Touchpoints",
    question: "How do I view today's touchpoints?",
    answer: "Navigate to 'Touchpoints: Today' from the sidebar to see all touchpoints that are due today. This page helps you focus on your immediate follow-ups. You can see the contact name, touchpoint message, and take actions like marking as completed or rescheduling directly from this page.",
  },
  {
    category: "Touchpoints",
    question: "What are overdue touchpoints?",
    answer: "Overdue touchpoints are touchpoints that have passed their scheduled date without being marked as completed. Visit the 'Touchpoints: Overdue' page to see all missed touchpoints. This helps you catch up on follow-ups you may have missed and ensures important relationships don't fall through the cracks.",
  },
  {
    category: "Touchpoints",
    question: "Can I bulk update touchpoints?",
    answer: "Yes! On the touchpoint pages (Today, Overdue, Upcoming), you can select multiple contacts using checkboxes and use bulk actions to update their touchpoint statuses. You can mark multiple touchpoints as completed, reschedule them, or update their status all at once. This is especially useful for managing large numbers of touchpoints efficiently.",
  },
  {
    category: "Touchpoints",
    question: "How do touchpoint statuses work?",
    answer: "Touchpoints can have different statuses: Pending (scheduled for the future), Completed (you've completed the follow-up), Rescheduled (moved to a new date), or Cancelled (no longer needed). You can update touchpoint statuses individually on contact pages or in bulk on the touchpoint management pages.",
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
  {
    category: "Admin Tools",
    question: "What admin tools are available?",
    answer: "The Admin page provides several tools for managing and maintaining your CRM data: Process Segment Contacts (sync Gmail threads and generate insights for specific segments), Enrich Contacts (bulk enrich contacts with People API data), Cleanup Tags/Touchpoints/Action Items (remove duplicate or outdated data), Bulk Unlink Events (unlink calendar events from contacts), Extract Names (extract names from email addresses), and Migrate Action Items (migrate between data structures).",
  },
  {
    category: "Admin Tools",
    question: "When should I use admin tools?",
    answer: "Admin tools are useful for: (1) Bulk operations when you need to update many contacts at once, (2) Data cleanup when you want to remove duplicate tags or outdated touchpoints, (3) Contact enrichment when you have many contacts missing names or photos, (4) Troubleshooting when you need to reconnect your Google account or fix sync issues. Use these tools carefully as they can affect large amounts of data.",
  },
  {
    category: "Admin Tools",
    question: "How do I reconnect my Google account?",
    answer: "If you're experiencing sync issues with Gmail, Calendar, or Contacts, you may need to reconnect your Google account. Navigate to the Admin page and click the 'Reconnect Google Account' button. This will refresh your OAuth permissions and restore access to Google services. After reconnecting, your syncs should work normally again.",
  },
  {
    category: "Admin Tools",
    question: "Are admin tools safe to use?",
    answer: "Admin tools are designed to help you manage your data efficiently, but they can affect large amounts of data. Always review what the tool will do before running it. Some tools provide previews or confirmations before making changes. If you're unsure about using an admin tool, it's best to test it on a small subset of data first or contact support for guidance.",
  },
  {
    category: "Customization",
    question: "How do I switch between light and dark mode?",
    answer: "Click on your profile photo/name at the bottom of the sidebar to open the user menu. In the menu, you'll see a 'Light Mode' or 'Dark Mode' option depending on your current theme. Click it to toggle between themes. Your theme preference is saved and will persist across sessions. All components, including the calendar, will adapt to your selected theme.",
  },
  {
    category: "Customization",
    question: "Can I customize the CRM name?",
    answer: "Yes! You can customize the CRM name by setting the NEXT_PUBLIC_CRM_NAME environment variable in your .env.local file. The custom name will appear in page titles, the login page, sidebar navigation, FAQ descriptions, and throughout the interface. If not set, it defaults to 'Insight Loop CRM'. After setting the variable, restart your development server for changes to take effect.",
  },
  {
    category: "Customization",
    question: "Does the calendar adapt to my theme preference?",
    answer: "Yes! The calendar is fully theme-aware and adapts to both light and dark modes. When you switch themes, the calendar colors, grid lines, event styling, and all visual elements automatically adjust for optimal visibility in your selected theme. This ensures the calendar remains readable and visually appealing regardless of your theme preference.",
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
