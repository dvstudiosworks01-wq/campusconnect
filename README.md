# 🎓 CampusConnect — College Event Management Portal

> **An Advanced, Full-Stack, Responsive College Event Management Platform** built for single-college ecosystems with Google OAuth, PostgreSQL Row Level Security (RLS), time-limited QR attendance sessions, server-side collision checks, verifiable PDF certificates, dynamic leaderboards, and administrative analytics.

---

## 🌟 Key Highlights & Engineering Features

- **🔐 True Role-Based Access Control (RBAC):**
  - **Student:** Default role upon Google OAuth login. Register for individual or team events, invite and join teammates, view schedules, check attendance, download verifiable certificates, and track leaderboard points.
  - **Event Organizer:** Create and edit events, submit for administrative review, generate time-limited QR attendance sessions, view rosters, publish podium results, and issue eligible certificates.
  - **Administrator:** Executive control center, event approval queue, user role governance, category and scoring rule management, certificate monitoring/revocation, notification dispatch logs, and institutional audit trails.
- **⚡ Atomic Registration & Clash Detection:**
  - Server-side collision rule: `new_start < existing_end AND new_end > existing_start` prevents student double-booking.
  - Row-level lock (`FOR UPDATE`) guarantees strict adherence to event capacity limits and prevents overbooking race conditions.
- **🛡️ Cryptographic Time-Limited QR Attendance:**
  - Organizers generate a 32-character random session token.
  - Only the **SHA-256 hash** is stored in PostgreSQL (`event_qr_sessions`).
  - Scanned tokens expire automatically after the configured window (e.g., 5 to 30 mins) or can be instantly revoked.
  - Real-time attendance counter and built-in camera QR scanner using `html5-qrcode` with manual token fallback.
- **📜 Verifiable Digital Certificates:**
  - Automated PDF certificate generation using `jspdf` and `qrcode`.
  - Embedded verification QR code and unique certificate ID (e.g., `CERT-TECH-2026-XXXX`).
  - Public verification page (`/verify-certificate?cert=...`) that checks PostgreSQL records and detects revoked credentials.
- **🏆 Live Campus Leaderboard:**
  - Configurable scoring rules: 1st Place (10 pts), 2nd Place (7 pts), 3rd Place (5 pts), Attendance (1 pt).
  - Standings for both individual scholars and student teams.
- **📊 Real Administrative Telemetry:**
  - Interactive charts powered by `recharts`: Demographics by academic department, turnout utilization, and monthly engagement.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript + Vite |
| **Styling & Design Tokens** | Tailwind CSS (Navy sidebar `#0b1329`, slate-50 canvas, blue primary actions) |
| **Icons & UI Primitives** | Lucide React, Custom accessible Modals, Badges, Cards, and Toasts |
| **Database & Auth** | Supabase PostgreSQL with Google OAuth & Row Level Security (RLS) |
| **Forms & Validation** | Zod Schema Validation |
| **Attendance Scanning** | `html5-qrcode` (Camera Scanner) & `qrcode` (Generation) |
| **PDF Generation** | `jspdf` with QR code embedding & verification links |
| **Analytics & Charts** | `recharts` |
| **Server-Side Logic** | Supabase Edge Functions (Deno TypeScript) |
| **Email Infrastructure** | Resend API integration via Edge Functions |

---

## 📁 Project Architecture

```
CampusConnect/
├── public/                     # Static assets & icons
├── src/
│   ├── components/
│   │   ├── layout/             # Navbar, Sidebar, DashboardLayout, PublicLayout, ProtectedRoute
│   │   └── ui/                 # Button, Card, Badge, Input, Modal, Toast, Skeleton, EmptyState
│   ├── context/
│   │   └── AuthContext.tsx     # Google OAuth, profile sync, role state, and session listeners
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client initializer and configuration check
│   │   └── utils.ts            # CSS class merger, date formatters, time clash detection
│   ├── pages/
│   │   ├── public/             # LandingPage, EventsPage, EventDetailPage, CertificateVerifyPage, LeaderboardPage, LoginPage, AuthCallbackPage
│   │   ├── student/            # StudentDashboard, MyRegistrationsPage, TeamManagementPage, AttendanceStatusPage, MyCertificatesPage, ProfilePage
│   │   ├── organizer/          # OrganizerDashboard, OrganizerEventsPage, CreateEventPage, EditEventPage, EventRegistrationsPage, QRAttendancePage, AttendanceReportsPage, EventResultsPage, CertificateManagerPage
│   │   └── admin/              # AdminDashboard, EventApprovalQueue, UserRoleManagement, CategoryManagement, CertificateMonitoringPage, NotificationLogsPage, AuditLogsPage
│   ├── types/
│   │   └── database.types.ts   # Domain models matching Supabase schema
│   ├── App.tsx                 # Master routing tree with RBAC guards
│   ├── index.css               # Tailwind CSS directives and root styling
│   └── main.tsx                # React DOM root entry point
├── supabase/
│   ├── migrations/
│   │   ├── 20261015000001_initial_schema.sql         # Tables, constraints, foreign keys, indexes
│   │   ├── 20261015000002_rls_policies.sql           # RLS policies on all 12 tables
│   │   ├── 20261015000003_functions_and_triggers.sql # Profile trigger, atomic registration, QR check-in
│   │   └── 20261015000004_seed_data.sql              # Categories, scoring matrix, storage buckets
│   └── functions/
│       ├── create-event-qr/                          # Edge Function: Creates time-limited QR token session
│       ├── check-in/                                 # Edge Function: Validates attendance token
│       ├── issue-certificate/                        # Edge Function: Generates certificate record
│       └── send-notification/                        # Edge Function: Dispatches transactional email via Resend
├── .env.example                # Environment variable reference
├── package.json                # Project dependencies
└── tailwind.config.js          # Design palette & theme configuration
```

---

## 🚀 Quickstart Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/CampusConnect.git
cd CampusConnect
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Frontend Supabase Credentials (Safe for public client)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

*(Never paste your Supabase `service_role` key or email provider secret into the frontend `.env` file!)*

### 3. Run Database Migrations in Supabase

Open your **Supabase Dashboard** -> **SQL Editor**, and run the SQL scripts located in `supabase/migrations/` in order:

1. `20261015000001_initial_schema.sql` (Creates all tables, constraints, foreign keys, and indexes)
2. `20261015000002_rls_policies.sql` (Enforces Row Level Security across all tables)
3. `20261015000003_functions_and_triggers.sql` (Stored procedures for profile creation, atomic clash checks, QR check-ins)
4. `20261015000004_seed_data.sql` (Populates event categories and leaderboard point rules)

---

## 🔑 Initial Administrator Setup Procedure

To prevent privilege escalation, all users who sign in via Google OAuth receive the **Student** role by default.

To promote your account to **Administrator** or **Event Organizer**:

1. Start the application (`npm run dev`) and click **Sign In** -> **Continue with Google**.
2. Once signed in, open the **Supabase Dashboard** -> **SQL Editor**.
3. Run the following command using your Google email address:

```sql
-- Promote your user account to Administrator
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-google-email@college.edu';
```

*(Alternatively, set `role = 'organizer'` to test the Event Organizer perspective).*

4. Refresh your browser; you will now have complete access to the Administrative Control Center at `/admin`.
5. From the `/admin/users` page, administrators can promote other users to **Organizer** or **Admin** directly through the UI.

---

## 🔐 Google OAuth Setup Guide

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and configure the **OAuth consent screen** (User Type: External, Add scopes `email`, `profile`, `openid`).
3. Under **Credentials**, click **Create Credentials** -> **OAuth client ID** (Application type: *Web application*).
4. Add Authorized redirect URIs:
   - Supabase Auth Callback: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Local testing redirect: `http://localhost:5173/auth/callback`
5. Copy your **Client ID** and **Client Secret**.
6. Open your **Supabase Dashboard** -> **Authentication** -> **Providers** -> **Google**:
   - Enable Google.
   - Paste the **Client ID** and **Client Secret**.
   - Save changes.

---

## 📧 Transactional Notifications & Edge Functions

Edge Functions in `supabase/functions/` run in Deno.

### Required Secrets (Supabase Dashboard -> Edge Functions -> Secrets):
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
RESEND_API_KEY=re_123456789
COLLEGE_NAME="Kongu Engineering College"
FROM_EMAIL="CampusConnect <notifications@kongu.edu>"
```

### Deploying Edge Functions via Supabase CLI:
```bash
supabase functions deploy create-event-qr
supabase functions deploy check-in
supabase functions deploy issue-certificate
supabase functions deploy send-notification
```

*(Note: If email credentials are not configured during development, the portal automatically operates in safe fallback mode without blocking registrations or check-ins).*

---

## 💻 Development & Production Build

```bash
# Start development server
npm run dev

# Run TypeScript check and production build
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 Production Deployment

- **Frontend:** Deploy to [Vercel](https://vercel.com/) or Netlify by pointing to the repository with framework preset `Vite`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Environment Variables.
- **Backend:** Managed PostgreSQL database, Storage, and Edge Functions hosted on [Supabase](https://supabase.com/).
