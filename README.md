# Campus WiFi Teacher Attendance System 📋

> **A complete, zero-cost teacher attendance system — attendance is marked automatically when teachers connect to campus WiFi.**

Built with **React + Vite + Tailwind** (Vercel), **Supabase** (PostgreSQL + Auth), and **Flutter** (Android).

**💰 Cost: ₹0 / $0 — Runs 24/7 for FREE on generous free tiers.**

---

## 🏗️ Architecture

```
┌───────────────────────┐          ┌──────────────────────────────────┐
│  Teacher Phone        │          │  Supabase (PostgreSQL + Auth)    │
│  (Flutter Android)    │──WiFi──▶ │  • attendance_records            │
│  Auto-detects SSID    │  check   │  • teachers, departments         │
│  Sends GPS + BSSID    │          │  • wifi_config, daily_summaries  │
└───────────────────────┘          │  • reports (Storage bucket)      │
                                   └────────────┬─────────────────────┘
                                                │
┌───────────────────────┐                       │
│  Admin Dashboard      │──────────────────────▶│
│  (React + Vite)       │  Vercel Serverless    │
│  Deployed on Vercel   │  Functions (Node.js)  │
└───────────────────────┘                       │
                                                │
┌───────────────────────┐                       │
│  GitHub Actions       │──────────────────────▶│
│  • Daily Excel Report │  (6 PM IST cron)      │
│  • Keep-Alive Ping    │  (6 AM IST cron)      │
└───────────────────────┘
```

**Data Flow:**
1. Teacher opens Flutter app → app reads connected WiFi SSID + BSSID
2. If SSID matches campus WiFi → app sends check-in to Supabase via Vercel API
3. Admin views real-time dashboard on Vercel-hosted React app
4. GitHub Actions generates daily Excel report at 6 PM IST and uploads to Supabase Storage

---

## 🛠️ Tech Stack

| Layer | Technology | Hosting | Cost |
|-------|-----------|---------|------|
| **Frontend** | React 18 + Vite + Tailwind CSS | Vercel Hobby (Free) | $0 |
| **Backend** | Vercel Serverless Functions (Node.js) | Vercel Hobby (Free) | $0 |
| **Database** | Supabase PostgreSQL + Auth + Storage + Realtime | Supabase Free | $0 |
| **Mobile App** | Flutter 3.10+ (Android APK) | Google Drive / WhatsApp | $0 |
| **Reports** | ExcelJS (.xlsx in serverless function) | Vercel + Supabase Storage | $0 |
| **Automation** | GitHub Actions (daily cron) | GitHub Free | $0 |
| **Total** | | | **$0** |

> **No always-on server required.** All backend logic runs as Vercel Serverless Functions that spin up on demand.

---

## 📋 Features

### 👨‍💼 Admin Features
- **Real-time Dashboard** — See who's present, absent, and on-leave right now
- **Teacher Management** — Add, edit, deactivate teachers with department assignment
- **Department Management** — Create and manage academic departments
- **Attendance Reports** — View daily/weekly/monthly attendance with filters
- **Excel Export** — Download `.xlsx` reports with summary, detailed, and department sheets
- **WiFi Configuration** — Set campus SSID, BSSID whitelist, IP range, and demo mode
- **Manual Override** — Mark attendance manually for special cases
- **Leave Management** — Approve/reject leave requests from teachers
- **Daily Email Reports** — Automated Excel report generated at 6 PM IST via GitHub Actions
- **Bulk Teacher Import** — Add multiple teachers at once (CSV upload)
- **Audit Trail** — All attendance changes are logged with timestamps

### 👩‍🏫 Teacher Features
- **Auto Check-in** — Attendance marked automatically when connected to campus WiFi
- **Auto Check-out** — Recorded when teacher disconnects from campus WiFi
- **Manual Check-in/out** — Fallback option when WiFi detection fails
- **Attendance History** — View personal attendance records with calendar view
- **Leave Requests** — Submit and track leave applications
- **Profile Management** — Update personal details and notification preferences
- **Dashboard** — Personal stats: hours today, streak, monthly summary

### ⚙️ System Features
- **WiFi-based Geofencing** — Validates SSID + BSSID + IP range for spoof prevention
- **Demo Mode** — Test the system without actual campus WiFi (configurable test SSID)
- **Keep-Alive Ping** — GitHub Actions pings the Vercel app at 6 AM IST to prevent cold starts
- **Realtime Updates** — Supabase Realtime subscriptions for live dashboard updates
- **Role-Based Access** — Admin and Teacher roles with appropriate permissions
- **Responsive Design** — Dashboard works on desktop, tablet, and mobile browsers
- **Dark/Light Mode** — Tailwind-based theme support

---

## 🚀 Setup Guide (Step by Step)

### Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Flutter SDK 3.10+** — [Install Guide](https://docs.flutter.dev/get-started/install)
- **Git** — [Download](https://git-scm.com/)
- **GitHub Account** (free) — [Sign Up](https://github.com/)
- **Vercel Account** (free) — [Sign Up with GitHub](https://vercel.com/)
- **Supabase Account** (free) — [Sign Up](https://supabase.com/)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/teacher-attendance-system.git
cd teacher-attendance-system
```

---

### Step 2: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **"New Project"**
3. Fill in:
   - **Name:** `teacher-attendance`
   - **Database Password:** (set a strong password — save it!)
   - **Region:** Choose the closest to your campus
4. Click **"Create new project"** and wait 2-3 minutes for provisioning
5. Once ready, go to **Settings → API** and note down:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **`anon` public key** (starts with `eyJ...`)
   - **`service_role` secret key** (starts with `eyJ...`) — ⚠️ Keep this secret!

---

### Step 3: Run Database Migrations

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Open the file `supabase/migrations/001_initial_schema.sql` from this repo
4. Copy the entire contents and paste into the SQL Editor
5. Click **"Run"** (or press `Ctrl+Enter`)
6. You should see "Success. No rows returned" — this means all tables were created

> **Verify:** Go to **Table Editor** in Supabase. You should see these tables:
> - `teachers`
> - `departments`
> - `attendance_records`
> - `daily_summaries`
> - `wifi_config`
> - `leave_requests`

---

### Step 4: Create Supabase Auth Users

1. In Supabase dashboard, go to **Authentication → Users**
2. Click **"Add user" → "Create new user"**
3. Create the **admin** account:
   - **Email:** `admin@school.com`
   - **Password:** `admin123`
   - **Auto Confirm User:** ✅ Toggle ON
4. Create a **teacher** account (for testing with T001):
   - **Email:** `muneeb@school.com`
   - **Password:** `teacher123`
   - **Auto Confirm User:** ✅ Toggle ON
5. Repeat for each teacher as needed

> **Important:** The email used here must match the `email` field in the `teachers` table for the WiFi attendance link to work.

---

### Step 5: Create Supabase Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Click **"New bucket"**
3. Set:
   - **Name:** `reports`
   - **Public bucket:** ✅ Toggle ON (so admins can download reports via URL)
4. Click **"Create bucket"**

This bucket stores the daily Excel attendance reports generated by GitHub Actions.

---

### Step 6: Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click **"Add New..." → "Project"**
   - Select your `teacher-attendance-system` repository
   - Framework Preset: **Vite** (should auto-detect)
   - Root Directory: **`frontend`**

3. **Set Environment Variables** in Vercel Dashboard → Project Settings → Environment Variables:

   | Variable | Value | Notes |
   |----------|-------|-------|
   | `VITE_SUPABASE_URL` | `https://abcdefgh.supabase.co` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Your Supabase anon/public key |
   | `SUPABASE_URL` | `https://abcdefgh.supabase.co` | Same URL (for serverless functions) |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Your Supabase service_role key |

4. Click **"Deploy"**
5. ✅ Your site will be live at `https://your-project.vercel.app`

> **Note:** The `VITE_` prefixed variables are exposed to the React frontend. The `SUPABASE_SERVICE_ROLE_KEY` is only accessible to serverless functions (never exposed to the browser).

---

### Step 7: Configure GitHub Actions

1. In your GitHub repository, go to **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"** and add each:

   | Secret Name | Value |
   |-------------|-------|
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_ANON_KEY` | Your Supabase anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
   | `VERCEL_APP_URL` | `https://your-project.vercel.app` |

3. Go to **Actions** tab in your repository
4. If prompted, click **"I understand my workflows, go ahead and enable them"**
5. The workflows will now run on schedule:
   - **Daily Excel Report:** Runs at 6:00 PM IST (12:30 PM UTC) every day
   - **Keep-Alive Ping:** Runs at 6:00 AM IST (12:30 AM UTC) every day

> **Test manually:** Go to Actions → select a workflow → click "Run workflow" → "Run workflow"

---

### Step 8: Build Flutter APK

1. Navigate to the mobile app directory:
   ```bash
   cd mobile-app
   ```

2. Edit the configuration file `lib/config.dart`:
   ```dart
   class AppConfig {
     static const String supabaseUrl = 'https://abcdefgh.supabase.co';  // ← Your URL
     static const String supabaseAnonKey = 'eyJ...';                     // ← Your anon key
   }
   ```

3. Install dependencies:
   ```bash
   flutter pub get
   ```

4. Build the release APK:
   ```bash
   flutter build apk --release
   ```

5. The APK will be generated at:
   ```
   build/app/outputs/flutter-apk/app-release.apk
   ```

6. **Distribute to teachers** via:
   - Upload to Google Drive and share the link
   - Send directly via WhatsApp
   - Host on your school's internal network

> **Note:** The APK is ~15-20 MB. Teachers install it by enabling "Install from Unknown Sources" in Android Settings.

---

### Step 9: Configure WiFi Settings

1. Open your admin dashboard at `https://your-project.vercel.app`
2. Login with `admin@school.com` / `admin123`
3. Navigate to **WiFi Settings** (sidebar)
4. Configure:
   - **Campus WiFi SSID:** e.g., `Woxsen_Campus_WiFi` (exact match, case-sensitive)
   - **BSSID Whitelist:** Add MAC addresses of your campus access points (e.g., `AA:BB:CC:DD:EE:FF`)
   - **Campus IP Range:** e.g., `10.0.0.0/16` or `192.168.1.0/24`
   - **Check-in Cooldown:** Minimum minutes between check-ins (default: 5)
5. **For testing**, toggle **Demo Mode ON** and set a test SSID (e.g., `TestWiFi`)

---

## 📊 Database Schema

### `departments`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `name` | TEXT | Department name (e.g., "Computer Science") |
| `code` | TEXT (UNIQUE) | Short code (e.g., "CS") |
| `created_at` | TIMESTAMPTZ | Auto-set |

### `teachers`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `teacher_id` | TEXT (UNIQUE) | Employee code (e.g., "T001") |
| `name` | TEXT | Full name |
| `email` | TEXT (UNIQUE) | Login email (matches Supabase Auth) |
| `department_id` | UUID (FK) | References `departments.id` |
| `designation` | TEXT | Role (e.g., "Assistant Professor") |
| `is_active` | BOOLEAN | Soft delete flag (default: true) |
| `created_at` | TIMESTAMPTZ | Auto-set |

### `attendance_records`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `teacher_id` | UUID (FK) | References `teachers.id` |
| `date` | DATE | Attendance date |
| `check_in` | TIMESTAMPTZ | First WiFi detection timestamp |
| `check_out` | TIMESTAMPTZ | Last WiFi detection / disconnect |
| `status` | TEXT | `present`, `late`, `half_day`, `absent` |
| `wifi_ssid` | TEXT | Connected WiFi network name |
| `wifi_bssid` | TEXT | Access point MAC address |
| `ip_address` | TEXT | Device IP on campus network |
| `is_manual` | BOOLEAN | True if admin marked manually |
| `notes` | TEXT | Optional remarks |
| `created_at` | TIMESTAMPTZ | Auto-set |

### `daily_summaries`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `date` | DATE (UNIQUE) | Summary date |
| `total_teachers` | INTEGER | Total active teachers |
| `present_count` | INTEGER | Teachers present |
| `absent_count` | INTEGER | Teachers absent |
| `late_count` | INTEGER | Teachers late |
| `on_leave_count` | INTEGER | Teachers on approved leave |
| `report_url` | TEXT | Supabase Storage URL to Excel file |
| `created_at` | TIMESTAMPTZ | Auto-set |

### `wifi_config`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `campus_ssid` | TEXT | Expected WiFi SSID |
| `allowed_bssids` | TEXT[] | Array of valid access point MACs |
| `campus_ip_range` | TEXT | CIDR notation (e.g., `10.0.0.0/16`) |
| `check_in_cooldown_minutes` | INTEGER | Min gap between check-ins |
| `demo_mode` | BOOLEAN | Enable test SSID |
| `demo_ssid` | TEXT | Test SSID for development |
| `updated_at` | TIMESTAMPTZ | Last config change |

### `leave_requests`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `teacher_id` | UUID (FK) | References `teachers.id` |
| `start_date` | DATE | Leave start |
| `end_date` | DATE | Leave end |
| `reason` | TEXT | Leave reason |
| `status` | TEXT | `pending`, `approved`, `rejected` |
| `approved_by` | UUID | Admin who approved/rejected |
| `created_at` | TIMESTAMPTZ | Auto-set |

---

## 📱 How WiFi Attendance Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUTTER APP FLOW                             │
│                                                                 │
│  1. App launches / runs background service                      │
│     ↓                                                           │
│  2. Reads current WiFi SSID from Android WiFi API               │
│     ↓                                                           │
│  3. Compares SSID with campus_ssid from wifi_config              │
│     ↓                                                           │
│  4. ┌─ Match? ────────────────┐  ┌─ No Match? ───────────┐     │
│     │ Read BSSID + IP address │  │ Skip (not on campus)   │     │
│     │ Validate against        │  │ If was checked-in →    │     │
│     │ allowed_bssids &        │  │   auto check-out       │     │
│     │ campus_ip_range         │  └────────────────────────┘     │
│     └─────────┬───────────────┘                                 │
│               ↓                                                 │
│  5. All valid → POST /api/attendance/check-in                   │
│     {                                                           │
│       teacher_email, wifi_ssid, wifi_bssid,                     │
│       ip_address, timestamp                                     │
│     }                                                           │
│               ↓                                                 │
│  6. Serverless function validates:                              │
│     • Teacher exists & is active                                │
│     • SSID matches config                                       │
│     • BSSID in whitelist (if configured)                        │
│     • IP in campus range (if configured)                        │
│     • Cooldown period respected                                 │
│               ↓                                                 │
│  7. Insert/update attendance_records for today                  │
│     • First call → check_in timestamp                           │
│     • Subsequent → update check_out timestamp                   │
│               ↓                                                 │
│  8. Return { success: true, status: "present" }                 │
│     App shows ✅ "Checked In" notification                      │
└─────────────────────────────────────────────────────────────────┘
```

### Anti-Spoofing Measures
- **BSSID Validation:** Checks the MAC address of the access point — connecting to a hotspot with the same SSID name but different BSSID will be rejected
- **IP Range Check:** Verifies the device's IP is within the campus network CIDR range
- **Cooldown Period:** Prevents rapid duplicate check-ins (configurable, default 5 minutes)
- **Server-Side Validation:** All checks happen on the Vercel serverless function, not on the device

### Background Service (Android)
- The Flutter app runs a lightweight background service that checks WiFi status every 5 minutes
- Uses `WorkManager` for reliable background execution
- Battery-friendly — only reads WiFi info, no GPS or continuous scanning
- Auto check-out when WiFi disconnects for more than 15 minutes

---

## 📈 Excel Report Format

The daily Excel report (`.xlsx`) generated at 6 PM IST contains **3 sheets**:

### Sheet 1: Summary
| Field | Example |
|-------|---------|
| Date | 2026-11-05 |
| Total Teachers | 45 |
| Present | 38 |
| Absent | 4 |
| Late | 2 |
| On Leave | 1 |
| Attendance Rate | 84.4% |

Color-coded rows: 🟢 Present, 🟡 Late, 🔴 Absent, 🔵 On Leave

### Sheet 2: Detailed Records
| Teacher ID | Name | Department | Check-In | Check-Out | Duration | Status | Method |
|-----------|------|-----------|----------|-----------|----------|--------|--------|
| T001 | Muneeb Ahmed | CS | 08:45 AM | 05:30 PM | 8h 45m | Present | WiFi |
| T002 | Sarah Khan | Math | 09:15 AM | 04:00 PM | 6h 45m | Late | WiFi |
| T003 | Raj Kumar | Physics | — | — | — | Absent | — |

### Sheet 3: Department-wise Summary
| Department | Total | Present | Absent | Late | Leave | Rate |
|-----------|-------|---------|--------|------|-------|------|
| Computer Science | 12 | 10 | 1 | 1 | 0 | 83.3% |
| Mathematics | 8 | 7 | 0 | 0 | 1 | 87.5% |
| Physics | 6 | 5 | 1 | 0 | 0 | 83.3% |

Reports are stored in the Supabase `reports` bucket and accessible via the admin dashboard under **Reports → Download**.

---

## 🎯 Demo Credentials

Use these credentials to test the system:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **Admin** | `admin@school.com` | `admin123` | Full dashboard access |
| **Teacher (T001)** | `muneeb@school.com` | `teacher123` | Teacher dashboard + mobile app |

> ⚠️ **Change these passwords before deploying to production!** Go to Supabase → Authentication → Users → Reset password.

---

## 📊 Free Tier Limits

| Service | Free Tier Limit | Our Estimated Usage | Headroom |
|---------|----------------|-------------------|----------|
| **Vercel Hobby** | 100 GB bandwidth/month | ~2 GB/month | **50x** headroom |
| **Vercel Hobby** | 100,000 serverless invocations/month | ~5,000/month | **20x** headroom |
| **Supabase Free** | 500 MB database storage | ~6 MB/year (50 teachers) | **80+ years** of data |
| **Supabase Free** | 50,000 monthly active auth users | ~50 teachers + 5 admins | **900x** headroom |
| **Supabase Free** | 1 GB file storage | ~365 Excel files × 50 KB | **~50x** headroom |
| **Supabase Free** | 2 GB bandwidth/month | ~200 MB/month | **10x** headroom |
| **GitHub Actions** | 2,000 minutes/month | ~30 minutes/month | **66x** headroom |

> **Bottom line:** A school with up to **50 teachers** can run this system indefinitely for **₹0** without hitting any free tier limit.

---

## 🔧 Troubleshooting

### ❌ "WiFi not detected" on teacher's phone
- **Cause:** Android 10+ requires Location Permission to read WiFi SSID
- **Fix:** Open app → Settings → Grant Location Permission (Always Allow for background)
- Also ensure WiFi is actually connected (not just in range)

### ❌ Teacher's attendance not recording
- **Check 1:** Is the teacher's email in the app the same as in Supabase Auth & `teachers` table?
- **Check 2:** Is the teacher marked as `is_active = true`?
- **Check 3:** Does the WiFi SSID exactly match (case-sensitive)?
- **Check 4:** If BSSID whitelist is configured, is the connected AP's MAC in the list?

### ❌ Vercel deployment failing
- Ensure root directory is set to `frontend` in Vercel project settings
- Check that all environment variables are set (no trailing spaces!)
- Look at Vercel build logs for specific error messages

### ❌ Excel report not generating (GitHub Actions)
- Go to GitHub → Actions → check workflow run logs
- Verify all 4 secrets are set correctly
- Ensure Actions are enabled on the repository
- Test manually: Actions → "Daily Excel Report" → "Run workflow"

### ❌ Supabase "JWT expired" errors
- The `anon` key doesn't expire, but user sessions do (default: 1 hour)
- The app handles token refresh automatically
- If issues persist, check Supabase → Authentication → Settings → JWT Expiry

### ❌ App not working in background (Android)
- **Samsung/Xiaomi/Oppo:** These OEMs aggressively kill background apps
- **Fix:** Go to phone Settings → Battery → App → "Don't optimize" / "Allow background activity"
- Also: Settings → Apps → Teacher Attendance → Battery → Unrestricted
- [Don't Kill My App Guide](https://dontkillmyapp.com/) for OEM-specific instructions

### ❌ Dashboard shows "0 teachers" after setup
- Run the SQL migration first (Step 3)
- Add teachers via the admin dashboard or insert directly in Supabase Table Editor
- Ensure `is_active` is `true` for each teacher

### ❌ "CORS error" in browser console
- Supabase handles CORS automatically for its APIs
- For Vercel functions, the CORS headers are already configured in the API code
- If still seeing issues, check that `VITE_SUPABASE_URL` doesn't have a trailing slash

### ❌ Keep-Alive ping not working
- Check `VERCEL_APP_URL` secret doesn't have trailing slash
- Workflow simply does a `curl` to the URL — check Actions log for response

---

## 📁 Project Structure

```
teacher-attendance-system/
│
├── frontend/                          # React + Vite + Tailwind CSS
│   ├── public/                        # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/                 # Admin dashboard components
│   │   │   │   ├── TeacherManager.jsx
│   │   │   │   ├── AttendanceTable.jsx
│   │   │   │   ├── DepartmentManager.jsx
│   │   │   │   ├── WiFiSettings.jsx
│   │   │   │   ├── ReportViewer.jsx
│   │   │   │   └── LeaveManager.jsx
│   │   │   ├── teacher/               # Teacher view components
│   │   │   │   ├── TeacherDashboard.jsx
│   │   │   │   ├── AttendanceHistory.jsx
│   │   │   │   └── LeaveRequest.jsx
│   │   │   └── common/                # Shared components
│   │   │       ├── Navbar.jsx
│   │   │       ├── Sidebar.jsx
│   │   │       ├── LoadingSpinner.jsx
│   │   │       └── StatusBadge.jsx
│   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useAttendance.js
│   │   │   └── useRealtime.js
│   │   ├── lib/                       # Utilities
│   │   │   └── supabase.js            # Supabase client init
│   │   ├── pages/                     # Route pages
│   │   │   ├── LoginPage.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── TeacherDashboard.jsx
│   │   ├── App.jsx                    # Root component + routing
│   │   └── main.jsx                   # Entry point
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── api/                               # Vercel Serverless Functions
│   ├── attendance/
│   │   ├── check-in.js                # POST: Record WiFi check-in
│   │   ├── check-out.js               # POST: Record check-out
│   │   ├── status.js                  # GET: Current day status
│   │   └── history.js                 # GET: Attendance history
│   ├── teachers/
│   │   ├── index.js                   # GET/POST: List/create teachers
│   │   └── [id].js                    # GET/PUT/DELETE: Single teacher
│   ├── reports/
│   │   ├── generate.js                # POST: Generate Excel report
│   │   └── daily.js                   # GET: Today's summary
│   ├── wifi-config.js                 # GET/PUT: WiFi settings
│   ├── health.js                      # GET: Health check (keep-alive)
│   ├── lib/
│   │   └── supabase.js                # Supabase admin client
│   └── package.json
│
├── mobile-app/                        # Flutter Android App
│   ├── lib/
│   │   ├── main.dart                  # App entry point
│   │   ├── config.dart                # Supabase URL + keys
│   │   ├── screens/
│   │   │   ├── login_screen.dart
│   │   │   ├── home_screen.dart
│   │   │   └── history_screen.dart
│   │   ├── services/
│   │   │   ├── wifi_service.dart      # WiFi SSID/BSSID detection
│   │   │   ├── attendance_service.dart # API calls
│   │   │   ├── auth_service.dart      # Supabase auth
│   │   │   └── background_service.dart # WorkManager background tasks
│   │   ├── models/
│   │   │   ├── teacher.dart
│   │   │   └── attendance.dart
│   │   └── widgets/
│   │       ├── status_card.dart
│   │       └── wifi_indicator.dart
│   ├── android/                       # Android native config
│   ├── pubspec.yaml                   # Flutter dependencies
│   └── README.md
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # Complete database schema + RLS policies
│
├── .github/
│   └── workflows/
│       ├── daily-report.yml           # 6 PM IST: Generate Excel + upload
│       └── keep-alive.yml             # 6 AM IST: Ping Vercel to prevent cold start
│
├── vercel.json                        # Vercel routing + function config
├── .env.example                       # Template for environment variables
├── .gitignore
├── LICENSE                            # MIT License
└── README.md                          # ← You are here
```

---

## 🔐 Environment Variables Reference

### Vercel (Dashboard → Project → Settings → Environment Variables)

| Variable | Required | Exposed To | Description |
|----------|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Frontend (browser) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Frontend (browser) | Supabase anon/public API key |
| `SUPABASE_URL` | ✅ | Serverless only | Same Supabase URL (for API functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Serverless only | Supabase service role key (admin access) |

### GitHub Actions (Settings → Secrets → Actions)

| Secret | Required | Description |
|--------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `VERCEL_APP_URL` | ✅ | Deployed Vercel URL (no trailing slash) |

### Flutter App (`mobile-app/lib/config.dart`)

| Constant | Description |
|----------|-------------|
| `supabaseUrl` | Supabase project URL |
| `supabaseAnonKey` | Supabase anon/public key |

> ⚠️ **Never put the `service_role` key in the Flutter app!** It has admin-level access. Only use the `anon` key on the client side.

---

## 🔄 API Endpoints

All API endpoints are Vercel Serverless Functions under `/api/`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/attendance/check-in` | Teacher | Record WiFi-based check-in |
| `POST` | `/api/attendance/check-out` | Teacher | Record check-out |
| `GET` | `/api/attendance/status` | Teacher | Get today's attendance status |
| `GET` | `/api/attendance/history` | Teacher | Get attendance history |
| `GET` | `/api/teachers` | Admin | List all teachers |
| `POST` | `/api/teachers` | Admin | Create a new teacher |
| `GET` | `/api/teachers/[id]` | Admin | Get teacher details |
| `PUT` | `/api/teachers/[id]` | Admin | Update teacher |
| `DELETE` | `/api/teachers/[id]` | Admin | Deactivate teacher |
| `POST` | `/api/reports/generate` | Admin/Cron | Generate Excel report |
| `GET` | `/api/reports/daily` | Admin | Get today's summary |
| `GET` | `/api/wifi-config` | Admin | Get WiFi settings |
| `PUT` | `/api/wifi-config` | Admin | Update WiFi settings |
| `GET` | `/api/health` | Public | Health check / keep-alive |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📝 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 Campus WiFi Teacher Attendance System

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  Made with ❤️ for schools that want modern attendance tracking without the budget
</p>
