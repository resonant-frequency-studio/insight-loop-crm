# Insight Loop CRM

A modern, elegant Customer Relationship Management (CRM) application built with Next.js and Firebase, designed to help you manage contacts and relationships effectively.

## Features

### Contact Management
- **View All Contacts** - Browse and manage your contact list with real-time updates
- **Create New Contacts** - Manually add contacts with comprehensive information
- **Edit Contacts** - Update contact details, tags, segments, and more
- **Import Contacts** - Bulk import contacts from CSV files or Google Contacts with flexible overwrite options
- **Delete Contacts** - Remove contacts with confirmation modal
- **Export Contacts** - Export contacts to CSV or Google Contacts
- **Bulk Operations** - Bulk update segments, tags, and other fields across multiple contacts

### Schedule & Calendar Management
- **Multiple Calendar Views** - Month, week, day, and agenda views for flexible scheduling
- **Event Filtering** - Filter events by segment, tags, linked contacts, or search terms
- **Event Types** - Categorize events as sessions, follow-ups, prep time, admin tasks, focus time, or hold slots
- **Create & Manage Events** - Create new calendar events directly in the CRM
- **Link Events to Contacts** - Associate calendar events with specific contacts for relationship tracking
- **Theme-Aware Styling** - Calendar adapts to light/dark mode with optimized visibility
- **Real-Time Sync** - Calendar events sync automatically from Google Calendar
- **Touchpoint Integration** - View and manage touchpoints alongside calendar events

### Contact Information
- Identity fields (email, first name, last name)
- CRM fields (tags, segments, lead source, engagement score, notes)
- Next touchpoint tracking
- AI-generated summaries and insights
- Sentiment analysis
- Email thread tracking

### Dashboard & Analytics
- **Interactive Charts** - Visualize your contact data with elegant charts:
  - Segment distribution (pie chart)
  - Lead source breakdown (pie chart)
  - Engagement levels (bar chart)
  - Sentiment analysis (pie chart)
  - Top tags (horizontal bar chart)
- **Real-time Statistics** - View key metrics at a glance:
  - Total contacts
  - Active email threads
  - Average engagement score
  - Upcoming touchpoints
- **Recent Contacts** - Quick access to recently updated contacts
- **Touchpoint Overview** - See contacts with upcoming touchpoints in the next 60 days

### Insights
- **Relationship Health Analysis** - Identify relationships that need attention
- **Suggested Focus Areas** - AI-powered recommendations for which contacts to prioritize
- **Coverage Analysis** - Track segment, tag, and lead source coverage across your database
- **Sentiment Alerts** - Get notified about contacts with negative sentiment trends
- **Engagement Insights** - Understand engagement patterns and opportunities
- **Data Quality Metrics** - Identify missing information and data gaps

### Data Visualization
- Modern, clean chart designs using Recharts
- Responsive layouts that work on all devices
- Interactive tooltips and legends
- Automatic grouping of small segments

### Authentication
- Google Sign-In integration
- Secure Firebase Authentication
- Protected routes and automatic redirects

### Touchpoints Management
- **Today's Touchpoints** - View and manage all touchpoints due today
- **Overdue Touchpoints** - Track and follow up on missed touchpoints
- **Upcoming Touchpoints** - Plan ahead with upcoming touchpoint view
- **Bulk Actions** - Update touchpoint statuses across multiple contacts
- **Status Management** - Mark touchpoints as completed, rescheduled, or cancelled
- **Touchpoint Reminders** - Never miss a follow-up with organized touchpoint tracking

### Search & Filtering
- Search by email, first name, or last name
- Filter by segment
- Filter by tags (multiple selection)
- Clear filters option

### Google Integration
- **Gmail Sync**:
  - Automatic email thread synchronization
  - Incremental sync - only syncs new messages since last sync
  - Contact matching - automatically matches emails to existing contacts
  - Thread tracking - tracks conversation threads per contact
  - Scheduled sync - automatic background synchronization (every 15-30 minutes via cron)
- **Google Calendar Sync**:
  - Automatic calendar event synchronization
  - Event-to-contact linking
  - Calendar subscription management
  - Daily automatic sync via cron
- **Google Contacts Integration**:
  - Direct import from Google Contacts (People API)
  - Automatic contact enrichment with missing data (names, company, photos)
  - Daily automatic sync via cron
  - People API enrichment for contacts missing first name, last name, company, or profile photos

### Action Items
- **AI-Generated Action Items** - Extract action items from email conversations
- **Manage Tasks** - Track and manage follow-up tasks for each contact
- **Import from Text** - Create action items from plain text
- **Filter & Search** - Find action items by contact, status, or date
- **Bulk Management** - Update multiple action items at once

### Sync Management
- **Sync Status Page** - Comprehensive dashboard for all sync operations
- **Manual Sync Triggers** - Manually trigger Gmail, Calendar, or Contacts sync
- **Automatic Sync Jobs** - Cron-based automatic synchronization:
  - Gmail sync: Every 15-30 minutes
  - Calendar sync: Daily
  - Contacts sync: Daily
- **Sync History** - View detailed history of all sync operations
- **Error Tracking** - Monitor and troubleshoot sync failures
- **Real-Time Status** - See sync progress and status in real-time

### Admin Tools
- **Data Management** - Administrative tools for maintaining your CRM data
- **Bulk Operations** - Clean up tags, touchpoints, and action items
- **Contact Enrichment** - Bulk enrich contacts with People API data
- **Data Cleanup** - Remove duplicate or outdated data
- **Event Management** - Bulk unlink calendar events from contacts
- **Segment Processing** - Process contacts in specific segments with Gmail sync and insights generation
- **Google Account Reconnection** - Reconnect your Google account if sync issues occur

### Theme & Customization
- **Light/Dark Mode** - Toggle between light and dark themes
- **Theme-Aware Components** - All components adapt to your selected theme
- **Customizable CRM Name** - Configure the application name via environment variables
- **Brand Identity** - Easy to rebrand for different organizations
- **Coaching-First Language** - Executive-coach focused terminology throughout the interface

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Firebase (Firestore, Authentication)
- **Data Fetching**: TanStack Query (React Query) v5
- **Charts**: Recharts
- **CSV Parsing**: PapaParse

## Project Structure

```
├── app/
│   ├── (crm)/              # Protected CRM routes
│   │   ├── _components/   # Server components with SSR data prefetching
│   │   ├── contacts/       # Contact management pages
│   │   ├── schedule/       # Calendar/Schedule pages
│   │   ├── insights/       # Insights page
│   │   ├── touchpoints/    # Touchpoints pages (today, overdue, upcoming)
│   │   ├── action-items/   # Action items page
│   │   ├── sync/           # Sync status page
│   │   ├── admin/          # Admin tools pages
│   │   ├── faq/            # FAQ page
│   │   └── page.tsx        # Dashboard
│   ├── login/              # Authentication page
│   ├── layout.tsx          # Root layout
│   └── providers.tsx       # React Query provider setup
├── components/
│   ├── charts/             # Data visualization components
│   ├── layout/             # Layout components (sidebar, navigation, etc.)
│   └── ...                 # UI components
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts          # Authentication hook
│   ├── useContacts.ts      # React Query hook for contacts
│   ├── useDashboardStats.ts # React Query hook for dashboard
│   ├── useActionItems.ts   # React Query hook for action items
│   ├── useSyncJobs.ts      # React Query hook for sync jobs
│   ├── useCalendarEventsRealtime.ts # Real-time calendar events
│   ├── useSidebarState.ts  # Sidebar state management
│   ├── useMobileMenu.ts    # Mobile menu state
│   ├── useSessionManagement.ts # Session validation
│   └── ...                 # Other hooks
├── lib/                    # Library utilities
│   ├── app-config.ts       # Application configuration (white-labeling)
│   ├── query-client.ts     # React Query client for SSR
│   ├── contacts-server.ts  # Server-side data fetching
│   ├── dashboard-stats-server.ts # Server-side stats fetching
│   ├── navigation-config.tsx # Navigation configuration
│   ├── layout-utils.ts     # Layout utility functions
│   ├── firebase-client.ts
│   ├── firebase-admin.ts
│   ├── firestore-crud.ts
│   ├── firestore-paths.ts
│   ├── contact-import.ts
│   └── gmail/              # Gmail sync utilities
├── types/                  # TypeScript type definitions
│   ├── firestore.ts
│   └── layout.ts           # Layout-related types
└── util/                   # Utility functions
    ├── contact-utils.ts
    └── csv-utils.ts
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled
- Google Cloud Console project with:
  - OAuth 2.0 credentials configured for Gmail access
  - Google API Key with Gemini API enabled (for AI features)
  - Gmail API enabled

### Deployment

For production deployment instructions, see the [Deployment Guide](docs/deployment.md). This guide covers:
- Setting up Vercel for staging and production environments
- Configuring Google Cloud OAuth with proper redirect URIs
- Firebase production setup and security
- Environment variable configuration
- Troubleshooting common deployment issues

#### Automatic Sync Jobs (Cron Configuration)

The CRM supports automatic background synchronization via cron jobs. Configure the following endpoints in your cron service (e.g., Vercel Cron Jobs):

1. **Gmail Sync** (Recommended: Every 15-30 minutes)
   - Endpoint: `POST /api/gmail/sync-scheduled`
   - Headers: `Authorization: Bearer {CRON_SECRET}`
   - Syncs email threads for all users

2. **Calendar Sync** (Recommended: Daily)
   - Endpoint: `POST /api/calendar/sync-scheduled`
   - Headers: `Authorization: Bearer {CRON_SECRET}`
   - Syncs calendar events for all users

3. **Contacts Sync** (Recommended: Daily)
   - Endpoint: `POST /api/contacts/sync-scheduled`
   - Headers: `Authorization: Bearer {CRON_SECRET}`
   - Syncs contacts from Google Contacts and enriches with People API data

**Note**: Set the `CRON_SECRET` environment variable to secure these endpoints. The secret should match in both your environment variables and the Authorization header of your cron job requests.

### Installation

1. Clone the repository:
```bash
git clone https://github.com/resonant-frequency-studio/insight-loop-crm.git
cd insight-loop-crm
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment configuration:
   - Copy `env.example` to `.env.local`:
   ```bash
   cp env.example .env.local
   ```
   - Edit `.env.local` and fill in your configuration values:
     - **Required**: Firebase client configuration (for authentication and database)
     - **Required**: Firebase Admin configuration (for server-side operations)
     - **Required**: Google OAuth credentials (for Gmail sync)
     - **Required**: Google API Key (for AI/Gemini features)
     - **Optional**: CRM name customization (defaults to "Insight Loop CRM")
     - **Optional**: Cron secret and logging settings
   - See `env.example` for detailed comments on each variable

4. Configure Firestore security rules:
   - Deploy the `firestore.rules` file to your Firebase project
   - Rules allow authenticated users to read/write their own data in:
     - `users/{userId}/contacts/{contactId}`
     - `users/{userId}/calendarEvents/{eventId}`
     - `users/{userId}/syncJobs/{syncJobId}`
     - `users/{userId}/threads/{threadId}` and subcollections
     - `users/{userId}/contacts/{contactId}/actionItems/{actionItemId}`
   - To deploy: `firebase deploy --only firestore:rules` (requires Firebase CLI)
   - Or manually copy the rules from `firestore.rules` to Firebase Console > Firestore Database > Rules

5. Create required Firestore indexes:
   - See [Firestore Indexes Documentation](docs/firestore-indexes.md) for required composite indexes
   - The action items page requires a collection group index for optimal performance

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Testing

### Unit Tests (Jest)

Run unit tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

Coverage:
```bash
npm run test:coverage
```

### E2E Tests (Playwright)

**IMPORTANT**: E2E tests require a separate Firebase test project to ensure they never interact with production data.

1. **Install Playwright browsers** (first time only):
   ```bash
   npx playwright install
   ```

2. **Set up test environment**:
   - Create a separate Firebase project for testing
   - Copy `env.test.local.example` to `.env.test.local`
   - Fill in your test Firebase project credentials

3. **Run E2E tests**:
   ```bash
   npm run test:e2e
   ```

4. **Other test commands**:
   - `npm run test:e2e:ui` - Interactive UI mode
   - `npm run test:e2e:headed` - Run with visible browser
   - `npm run test:e2e:debug` - Debug mode

See [tests/e2e/README.md](tests/e2e/README.md) for detailed E2E testing documentation.

## Usage

### Adding Contacts
- Click "Add Contact" from the contacts page or dashboard
- Fill in contact information (email is required)
- Save to create the contact

### Importing Contacts
- Navigate to "Import Contacts" from the dashboard or contacts page
- Upload a CSV file with contact data
- Choose to overwrite existing contacts or skip them
- Monitor import progress in real-time

### Viewing Analytics
- Visit the dashboard to see visualizations of your contact data
- Charts update automatically as you add or modify contacts
- Hover over chart elements for detailed information

### Schedule & Calendar
- Navigate to "Schedule" to view your calendar
- Switch between month, week, day, and agenda views
- Filter events by segment, tags, or search terms
- Create new events and link them to contacts
- Calendar events sync automatically from Google Calendar

### Insights
- Visit the "Insights" page for relationship health analysis
- Review suggested focus areas to prioritize your outreach
- Check coverage analysis for segments, tags, and lead sources
- Monitor sentiment alerts and engagement insights

### Touchpoints
- View "Touchpoints: Today" for all touchpoints due today
- Check "Touchpoints: Overdue" for missed follow-ups
- Review "Touchpoints: Upcoming" to plan ahead
- Use bulk actions to update multiple touchpoints at once

### Sync Management
- Navigate to "Sync Status" to view sync progress and history
- Manually trigger Gmail, Calendar, or Contacts sync
- Automatic syncs run in the background:
  - Gmail: Every 15-30 minutes
  - Calendar: Daily
  - Contacts: Daily
- First sync may take longer depending on your data volume
- Monitor sync history and errors on the Sync Status page

### Managing Action Items
- Action items are automatically extracted from email conversations using AI
- View all action items on the "Action Items" page
- Filter and manage tasks across all contacts

## CSV Import Format

### Required Columns
- `Email` - Contact email address

### Optional Columns
- `FirstName`, `LastName` - Contact names
- `Summary`, `Notes` - Text fields
- `Tags` - Comma-separated tags
- `Segment`, `LeadSource` - Classification fields
- `EngagementScore` - Number (0-100)
- `NextTouchpointDate`, `NextTouchpointMessage` - Future actions
- Other CRM fields as needed

## Theme & Customization

### Light/Dark Mode

The CRM includes a built-in theme toggle that switches between light and dark modes:
- Click your profile in the sidebar to access the theme toggle
- Theme preference is saved and persists across sessions
- All components, including the calendar, adapt to your selected theme

### White-Labeling

The CRM name can be easily customized for your organization:

1. Open your `.env.local` file
2. Set the `NEXT_PUBLIC_CRM_NAME` variable:
   ```
   NEXT_PUBLIC_CRM_NAME=Your Company CRM
   ```
3. Restart your development server

The custom name will appear in:
- Page titles and metadata
- Login page heading
- Sidebar navigation
- FAQ page descriptions
- All other UI locations

**Note**: If `NEXT_PUBLIC_CRM_NAME` is not set, it defaults to "Insight Loop CRM".

## Architecture Highlights

### Server-Side Rendering (SSR) & React Query
The application is optimized for performance using Next.js App Router's server-side rendering combined with TanStack Query (React Query):

- **Server-Side Data Prefetching**: All major pages prefetch data on the server before rendering
  - Dashboard stats, contacts, action items, and sync jobs are fetched server-side
  - Data is fetched directly from Firestore using Firebase Admin SDK
  - Prevents client-side loading states and improves initial page load performance

- **React Query Integration**: 
  - Server-prefetched data is hydrated into React Query's cache using `HydrationBoundary`
  - Client components use React Query hooks (`useQuery`) that automatically use prefetched data
  - Optimized query configuration:
    - 10-minute stale time (data considered fresh for 10 minutes)
    - 30-minute garbage collection time
    - No automatic refetching on window focus, mount, or reconnect
    - Reduces unnecessary API calls and improves performance

- **Query Client Pattern**:
  - Uses React's `cache()` function to ensure one QueryClient per request
  - Prevents data leakage between requests in SSR
  - Consistent query state across server and client

- **Benefits**:
  - Faster initial page loads with server-rendered content
  - Reduced client-side data fetching
  - Better SEO with fully rendered pages
  - Improved user experience with instant data display
  - Efficient caching and data synchronization

### Separation of Concerns
- **Server Components** - Handle data prefetching and SSR
- **Client Components** - Interactive UI using React Query hooks
- **Custom Hooks** - React Query-based data fetching with automatic caching
- **Utility Functions** - Reusable data transformations
- **Library Functions** - Server-side Firestore operations and data access

### Code Organization
- Modular hook-based architecture with React Query
- Type-safe throughout with TypeScript
- Reusable utility functions
- Clean separation between server-side data fetching and client-side state management
- Server/client component pattern for optimal performance

## Environment Variables

### Required Variables

**Firebase Client** (Public, exposed to browser):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

**Firebase Admin** (Server-side only):
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

**Google OAuth** (Server-side only):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_OAUTH_SCOPES`

**Google API**:
- `GOOGLE_API_KEY` (for Gemini/AI features)

### Optional Variables

- `NEXT_PUBLIC_CRM_NAME` - Customize the application name (default: "Insight Loop CRM")
- `CRON_SECRET` - Secret for securing scheduled sync endpoints
- `ENABLE_FIRESTORE_LOGGING` - Enable/disable Firestore operation logging (default: false)

See `env.example` for a complete template with all variables.

## License

Private project - All rights reserved
