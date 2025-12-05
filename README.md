# Resilient Leadership CRM

A modern, elegant Customer Relationship Management (CRM) application built with Next.js and Firebase, designed to help you manage contacts and relationships effectively.

## Features

### Contact Management
- **View All Contacts** - Browse and manage your contact list with real-time updates
- **Create New Contacts** - Manually add contacts with comprehensive information
- **Edit Contacts** - Update contact details, tags, segments, and more
- **Import Contacts** - Bulk import contacts from CSV files with flexible overwrite options
- **Delete Contacts** - Remove contacts with confirmation modal

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

### Data Visualization
- Modern, clean chart designs using Recharts
- Responsive layouts that work on all devices
- Interactive tooltips and legends
- Automatic grouping of small segments

### Authentication
- Google Sign-In integration
- Secure Firebase Authentication
- Protected routes and automatic redirects

### Search & Filtering
- Search by email, first name, or last name
- Filter by segment
- Filter by tags (multiple selection)
- Clear filters option

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Firebase (Firestore, Authentication)
- **Charts**: Recharts
- **CSV Parsing**: PapaParse

## Project Structure

```
├── app/
│   ├── (crm)/              # Protected CRM routes
│   │   ├── contacts/       # Contact management pages
│   │   └── page.tsx        # Dashboard
│   ├── login/              # Authentication page
│   └── layout.tsx          # Root layout
├── components/
│   ├── charts/             # Data visualization components
│   └── ...                 # UI components
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts
│   ├── useDashboardStats.ts
│   ├── useContactImportPage.ts
│   ├── useContactDetailPage.ts
│   ├── useNewContactPage.ts
│   └── useFilterContacts.ts
├── lib/                    # Library utilities
│   ├── firebase-client.ts
│   ├── firebase-admin.ts
│   ├── firestore-crud.ts
│   ├── firestore-paths.ts
│   └── contact-import.ts
├── types/                  # TypeScript type definitions
│   └── firestore.ts
└── util/                   # Utility functions
    ├── contact-utils.ts
    └── csv-utils.ts
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled
- Google OAuth credentials configured

### Installation

1. Clone the repository:
```bash
git clone https://github.com/resonant-frequency-studio/resilient-leadership-crm.git
cd resilient-leadership-crm
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase configuration:
   - Create a `.env.local` file in the root directory
   - Add your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. Configure Firestore security rules:
   - Ensure users can only read/write their own contacts
   - Rule should be: `match /users/{userId}/contacts/{contactId} { allow read, write: if request.auth != null && request.auth.uid == userId; }`

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

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

## Architecture Highlights

### Separation of Concerns
- **UI Components** - Pure presentation components
- **Custom Hooks** - Business logic and state management
- **Utility Functions** - Reusable data transformations
- **Library Functions** - Firestore operations and data access

### Code Organization
- Modular hook-based architecture
- Type-safe throughout with TypeScript
- Reusable utility functions
- Clean separation between UI and business logic

## License

Private project - All rights reserved
