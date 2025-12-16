# Production Deployment Setup Guide

Complete step-by-step guide for deploying the Insight Loop CRM application to Vercel with staging and production environments, including Google Cloud OAuth configuration and Firebase production setup.

## Architecture Overview

```
GitHub Repository
    ↓
Vercel (Auto-deploy on push)
    ├── Production (main branch) → production.vercel.app
    └── Preview/Staging (feature branches) → staging.vercel.app
    ↓
Firebase (Production Database)
    ├── Firestore
    ├── Authentication
    └── Service Account (Admin SDK)
    ↓
Google Cloud Console
    ├── OAuth 2.0 Client (with multiple redirect URIs)
    └── Gmail API (enabled)
```

## Part 1: Vercel Setup

### Step 1.1: Connect GitHub Repository
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository: `resonant-frequency-studio/insight-loop-crm`
4. Vercel will auto-detect Next.js framework

### Step 1.2: Configure Production Environment
1. In project settings, go to **Settings** → **Environment Variables**
2. Add all required environment variables (see `env.example`):

**Public Variables (NEXT_PUBLIC_*):**
- `NEXT_PUBLIC_CRM_NAME` - Your CRM name
- `NEXT_PUBLIC_FIREBASE_API_KEY` - From Firebase Console
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - From Firebase Console
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Your Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - From Firebase Console
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - From Firebase Console
- `NEXT_PUBLIC_FIREBASE_APP_ID` - From Firebase Console
- `NEXT_PUBLIC_ERROR_REPORTING_PROVIDER` - "console" or "sentry"

**Server-Side Variables:**
- `FIREBASE_ADMIN_PROJECT_ID` - Same as project ID
- `FIREBASE_ADMIN_CLIENT_EMAIL` - From Firebase service account JSON
- `FIREBASE_ADMIN_PRIVATE_KEY` - From Firebase service account JSON (keep newlines as `\n`)
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `GOOGLE_REDIRECT_URI` - Production callback URL (set after deployment)
- `GOOGLE_OAUTH_SCOPES` - `https://www.googleapis.com/auth/gmail.readonly`
- `GOOGLE_API_KEY` - Optional, for Gemini API
- `CRON_SECRET` - Random secret for cron job security

3. Set environment to **"Production"** for all variables
4. Click **"Save"**

### Step 1.3: Configure Staging Environment

**Important**: Vercel preview deployments get unique URLs for each branch/commit. You have two options:

#### Option A: Use Custom Staging Domain (Recommended)
1. In Vercel → **Settings** → **Domains**:
   - Add a custom domain for staging (e.g., `staging.yourdomain.com`)
   - Assign it to a specific branch (e.g., `staging` or `develop`)
   - This provides a stable URL for OAuth configuration

2. In the same **Environment Variables** section:
   - Add the same variables but with staging values:
     - `GOOGLE_REDIRECT_URI` - Will be `https://staging.yourdomain.com/api/oauth/gmail/callback`
     - Use same Firebase project (or separate staging project if preferred)
   - Set environment to **"Preview"** for staging-specific variables
   - Click **"Save"**

#### Option B: Use Dedicated Staging Branch
1. Create a `staging` branch in GitHub
2. In Vercel → **Settings** → **Git**:
   - Preview deployments from `staging` will use: `your-project-git-staging-username.vercel.app`
   - This URL is stable for that branch
3. In **Environment Variables**:
   - Set `GOOGLE_REDIRECT_URI` for Preview to: `https://your-project-git-staging-username.vercel.app/api/oauth/gmail/callback`
   - Note: This only works for deployments from that specific branch

### Step 1.4: Deploy and Get URLs
1. Go to **Deployments** tab
2. Deploy from `main` branch (production)
3. Note the production URL: `your-project.vercel.app`
4. Create a preview deployment from a feature branch
5. Note the preview/staging URL (if using custom domain, use that instead)

### Step 1.5: Configure Custom Domains (Optional but Recommended)
1. Go to **Settings** → **Domains**
2. Add your custom domain for production
3. Add staging subdomain (e.g., `staging.yourdomain.com`)
4. Follow DNS configuration instructions

## Part 2: Google Cloud Console Setup

### Step 2.1: Access Google Cloud Console
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create new one)
3. Ensure billing is enabled (required for Gmail API)

### Step 2.2: Enable Required APIs
1. Go to **APIs & Services** → **Library**
2. Enable these APIs:
   - **Gmail API**
   - **Google OAuth2 API** (usually enabled automatically)
   - **Google Gemini API** (if using AI features)

### Step 2.3: Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have Google Workspace)
3. Fill in required fields:
   - App name: Your CRM name
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
5. Add test users (if app is in testing mode)
6. Submit for verification (if going public)

### Step 2.4: Create OAuth 2.0 Client ID for Production
1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Application type: **Web application**
4. Name: "Insight Loop CRM - Production"
5. **Authorized JavaScript origins:**
   - `https://your-project.vercel.app`
   - `https://your-custom-domain.com` (if using)
6. **Authorized redirect URIs:**
   - `https://your-project.vercel.app/api/oauth/gmail/callback`
   - `https://your-custom-domain.com/api/oauth/gmail/callback`
7. Click **"Create"**
8. **Copy the Client ID and Client Secret** - you'll need these for Vercel

### Step 2.5: Create OAuth 2.0 Client ID for Staging
1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Application type: **Web application**
4. Name: "Insight Loop CRM - Staging"
5. **Authorized JavaScript origins:**
   - `https://staging.yourdomain.com` (if using custom domain)
   - OR `https://your-project-git-staging-username.vercel.app` (if using dedicated branch)
6. **Authorized redirect URIs:**
   - `https://staging.yourdomain.com/api/oauth/gmail/callback` (if using custom domain)
   - OR `https://your-project-git-staging-username.vercel.app/api/oauth/gmail/callback` (if using dedicated branch)
7. Click **"Create"**
8. **Copy the Client ID and Client Secret** for staging

**Note**: Using separate OAuth clients allows you to track staging vs production usage separately and provides better security isolation.

### Step 2.6: Create API Key (Optional - for Gemini)
1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"API Key"**
3. Restrict the key:
   - Application restrictions: **HTTP referrers**
   - Add your Vercel domains
   - API restrictions: **Restrict key** → Select **Gemini API**
4. Copy the API key

## Part 3: Firebase Setup

### Step 3.1: Access Firebase Console
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Select your existing project

### Step 3.2: Configure Authentication
1. Go to **Authentication** → **Sign-in method**
2. Enable **Google** provider:
   - Enable toggle
   - Add your OAuth Client ID and Secret from Google Cloud (use production client)
   - Authorized domains: Add your Vercel domains
3. Enable **Email/Password** if using (optional)

### Step 3.3: Configure Firestore
1. Go to **Firestore Database**
2. If not created, click **"Create database"**
3. Choose **Production mode** (start in production)
4. Select location closest to your users
5. Review security rules (ensure they're production-ready)

### Step 3.4: Update Authorized Domains
1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your Vercel production domain
3. Add your Vercel staging domain (or custom staging domain)
4. Add custom domains if using

### Step 3.5: Get Firebase Client Config
1. Go to **Project Settings** (gear icon)
2. Scroll to **"Your apps"** section
3. If no web app exists, click **"Add app"** → **Web** (</> icon)
4. Register app with nickname: "Production Web App"
5. Copy the config values:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

### Step 3.6: Create Service Account (for Admin SDK)
1. Go to **Project Settings** → **Service Accounts**
2. Click **"Generate new private key"**
3. Click **"Generate key"** in the dialog
4. **IMPORTANT**: Save the JSON file securely
5. Extract values for Vercel:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (keep `\n` characters)

**Important**: When pasting `FIREBASE_ADMIN_PRIVATE_KEY` into Vercel:
- The private key should include the full key with `\n` characters
- Format: `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`
- Vercel will handle the newlines correctly

### Step 3.7: Set Up Firestore Security Rules
1. Go to **Firestore Database** → **Rules**
2. Ensure production rules are secure (example):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Google accounts (OAuth tokens)
    match /googleAccounts/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Part 4: Final Configuration

### Step 4.1: Update Vercel Environment Variables
After getting all URLs, update in Vercel:

**Production:**
- `GOOGLE_CLIENT_ID` - Production OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Production OAuth client secret
- `GOOGLE_REDIRECT_URI` - `https://your-project.vercel.app/api/oauth/gmail/callback` (or custom domain)

**Staging/Preview:**
- `GOOGLE_CLIENT_ID` - Staging OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Staging OAuth client secret
- `GOOGLE_REDIRECT_URI` - `https://staging.yourdomain.com/api/oauth/gmail/callback` (if using custom domain) OR `https://your-project-git-staging-username.vercel.app/api/oauth/gmail/callback`

### Step 4.2: Configure Vercel Build Settings
1. Go to **Settings** → **General**
2. Verify:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### Step 4.3: Set Up Branch Deployments
1. Go to **Settings** → **Git**
2. Configure:
   - **Production Branch**: `main` (or `master`)
   - **Preview Deployments**: Enabled
   - **Automatic deployments**: Enabled for all branches

### Step 4.4: Test Deployment
1. Push to `main` branch → triggers production deployment
2. Push to feature branch → creates preview deployment
3. Test OAuth flow on both environments
4. Verify Gmail sync works

## Part 5: Security Checklist

- [ ] All environment variables set in Vercel (not in code)
- [ ] Firebase service account key stored securely in Vercel
- [ ] OAuth redirect URIs match exactly (no trailing slashes)
- [ ] Firestore security rules are production-ready
- [ ] Authorized domains configured in Firebase
- [ ] API keys restricted in Google Cloud Console
- [ ] CRON_SECRET set to random value
- [ ] Error reporting configured (Sentry or console)
- [ ] Separate OAuth clients for staging and production
- [ ] Custom staging domain configured (recommended)

## Part 6: Monitoring & Maintenance

### Set Up Monitoring
1. **Vercel Analytics**: Enable in project settings
2. **Error Tracking**: Configure Sentry if using
3. **Firebase Monitoring**: Check Firebase Console → Usage

### Regular Maintenance
1. Monitor Vercel usage and limits
2. Review Firebase quotas
3. Check Google Cloud API quotas
4. Rotate secrets periodically
5. Review security rules quarterly

## Troubleshooting

### OAuth redirect_uri_mismatch
- Verify redirect URI in Google Cloud Console matches exactly
- Check Vercel environment variable `GOOGLE_REDIRECT_URI`
- Ensure no trailing slashes
- Verify the correct OAuth client is being used (production vs staging)

### Firebase authentication errors
- Verify authorized domains in Firebase Console
- Check `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` matches your domain
- Ensure OAuth client ID/secret match in Firebase Authentication settings

### Build failures - "Service account object must contain a string 'project_id' property"
- Verify `FIREBASE_ADMIN_PROJECT_ID` is set in Vercel environment variables
- Ensure the value matches your Firebase project ID
- Check that the variable is set for the correct environment (Production/Preview)
- The value should be the same as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

### Gmail API errors
- Verify Gmail API is enabled in Google Cloud
- Check OAuth scopes include `gmail.readonly`
- Ensure billing is enabled on Google Cloud project
- Verify OAuth consent screen is configured

### Staging URL changes on each deployment
- **Solution**: Use a custom staging domain (see Step 1.3, Option A)
- This provides a stable URL for OAuth configuration
- Alternatively, use a dedicated staging branch for stable preview URLs

## Environment Variable Reference

### Production Environment Variables
All variables from `env.example` should be set with production values:
- Firebase client config (NEXT_PUBLIC_*)
- Firebase Admin config (FIREBASE_ADMIN_*)
- Google OAuth production client (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- Production redirect URI

### Staging/Preview Environment Variables
Set these with staging-specific values:
- `GOOGLE_CLIENT_ID` - Staging OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Staging OAuth client secret
- `GOOGLE_REDIRECT_URI` - Staging callback URL

All other variables can be shared between environments (or use separate Firebase project for staging if preferred).

