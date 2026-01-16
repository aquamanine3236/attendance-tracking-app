# Attendance Tracking App

End-to-end QR attendance logging with a Node/Express backend backed by Firebase Firestore, a web display and admin dashboard, and a Flutter mobile scanner. Real-time updates flow over Socket.IO so new scans appear instantly on the dashboard and the display refreshes to the next QR after each scan.

## What's in the repo
- `server/`: Express + Socket.IO API that issues QR tokens, validates scans, and stores data in Firestore.
- `web-display/`: Browser client that shows the active QR for a selected company and reacts to real-time updates.
- `web-admin/`: Browser dashboard for admins to log in, choose a company, issue new QR codes, watch scans live, filter, and export to CSV/XLSX.
- `scanner_app/`: Flutter app for employees to log in, capture GPS, scan QR codes (camera or image upload), and submit check-in/out records.
- `firebase-service-account-example.json`: Redacted example; replace with a real service account JSON in `server/`.

## How it works (high level)
1) Admin signs in via `/auth/admin/login`, picks a company in the dashboard, and hits **Generate New QR**.  
2) The display client subscribes with role `display` and shows the QR for `display-{companyId}`; it swaps to the latest QR on `qr:new` and shows scan feedback on `qr:consumed`.  
3) An employee logs in through the Flutter app (`/auth/login`), chooses **Check In** or **Check Out**, scans the QR, and the app posts `/scan` with location and type after validating the token.  
4) The server writes sessions and scans to Firestore, emits `scan:logged` to admins, and immediately issues the next QR for that display.

## Prerequisites
- Node.js 18+
- Firebase project with Firestore plus a service account JSON
- Flutter 3.10+ with Android/iOS tooling (for `scanner_app`)
- Modern browser for the web apps

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd attendance-tracking-app

# 2. Setup and start the server
cd server
cp .env.example .env        # Edit .env with your Firebase credentials
npm install
npm run dev                  # Development mode with auto-reload

# 3. Open web clients in browser
# Admin Dashboard: http://localhost:4000/admin/
# QR Display:      http://localhost:4000/display/

# 4. Setup and run the mobile scanner (in a new terminal)
cd scanner_app
flutter pub get
flutter run
```

## Setup and Running

### 1) Backend (`server/`)

**Step 1: Configure environment**
```bash
cd server
cp .env.example .env
```

Edit `.env` and set the following values:
- `FIREBASE_SERVICE_ACCOUNT`: Path to your service account JSON (e.g., `./firebase-service-account.json`)
- `QR_SECRET`: JWT signing secret for QR tokens
- `QR_TTL_SECONDS`: Token lifetime in seconds
- `ADMIN_JWT` / `DISPLAY_JWT` / `USER_JWT`: Demo bearer tokens
- `ALLOW_MULTI_SCAN=true`: Set if you want to allow reusing the same QR in tests

**Step 2: Install dependencies**
```bash
npm install
```

**Step 3: Seed sample data (optional)**
```bash
# Edit scripts/import-data.js with your companies/users first
node scripts/import-data.js
```

**Step 4: Start the server**
```bash
# Development mode (with auto-reload)
npm run dev

# OR production mode
npm start
```

The server runs on `http://localhost:4000` and serves web clients at `/admin` and `/display`.

---

### 2) Web Clients

**Admin Dashboard**
```
URL: http://localhost:4000/admin/
```
- Log in with a Firestore user where `role === "admin"`
- Pick a company, watch scans live, generate QR, and export via CSV/XLSX
- Filters include date, type, and search

**QR Display**
```
URL: http://localhost:4000/display/
```
- Pick a company and keep it on-screen
- Auto-refreshes on `qr:new` and shows 'scanned' feedback
- Buttons: refresh QR and download PNG

Optional URL parameters:
```
http://localhost:4000/display/?companyId=...&company=Name&token=<display-token>&api=http://host:4000
```

---

### 3) Mobile Scanner (`scanner_app/`)

**Step 1: Install dependencies**
```bash
cd scanner_app
flutter pub get
```

**Step 2: Configure API endpoint**

Edit `lib/services/api_service.dart` if needed. Default endpoints:
- `https://testchamcong.merlinle.com`
- `10.0.2.2:4000` (Android emulator)
- `localhost:4000`
- `127.0.0.1:4000`

For devices on your LAN, update to your host IP:
```dart
// Example: http://192.168.x.x:4000
```

**Step 3: Run the app**
```bash
# Run on connected device or emulator
flutter run

# Run on specific device
flutter run -d <device-id>

# List available devices
flutter devices
```

**Step 4: Use the app**
- Log in with an employee account (`role === "employee"`)
- Grant location permission
- Pick **Check In** or **Check Out**
- Scan the on-screen QR (or upload an image if camera can't scan)

## Configuration reference (`server/.env`)
- `PORT`: HTTP port (default 4000)  
- `FIREBASE_SERVICE_ACCOUNT`: Path to service account JSON  
- `QR_SECRET`: JWT signing secret for QR tokens  
- `QR_TTL_SECONDS`: Token lifetime in seconds  
- `ADMIN_JWT` / `DISPLAY_JWT` / `USER_JWT`: Demo bearer tokens used by dashboard, display, and scanner  
- `WEB_ORIGIN`: CORS origins (`*` in demo)  
- `ALLOW_MULTI_SCAN`: Allow reusing the same QR without conflict (testing)

## API surface (Express + Socket.IO)
**HTTP**
- `GET /health` - basic health plus Firestore check  
- `POST /auth/login` - employee login (plain-text password check; returns user info and `USER_JWT`)  
- `POST /auth/admin/login` - admin login (plain-text password check; returns admin info and `ADMIN_JWT`)  
- `GET /qr/image?text=` - utility to render a QR PNG  
- `GET /api/companies` - list companies (admin/display token)  
- `GET /admin/companies` - same payload, admin-only  
- `POST /admin/qr` - issue a new QR for a display `{ displayId, companyId? }` (admin)  
- `GET /display/qr/current` - fetch current QR for a display/company (display/admin)  
- `GET /qr/validate` - user token required; checks JWT signature and status  
- `POST /scan` - submit scan with `{ token, fullName, jobTitle, employeeId, type, lat, lng, accuracy, imageData? }` (user)  
- `GET /admin/scans` - list scans, optional `companyId`/`search` (admin)  
- `GET /admin/export.csv` and `GET /admin/export.xlsx` - export scans (admin)  
- `POST /admin/reset` - clear scans and active QR sessions; clears display cache (admin)

**WebSocket (Socket.IO query: `role`, `token`, `displayId` optional)**
- `ready` (server -> client) - connection acknowledged  
- `qr:new` (server -> display room) - new QR payload  
- `qr:consumed` (server -> display room) - QR was scanned with timestamp  
- `scan:logged` (server -> admin) - new scan data broadcast

## Data and storage
- Firestore collections: `companies`, `users`, `displays`, `qr_sessions`, `scans`. Sessions are marked used when a new QR is issued for the same display; scans store GPS, type, and optional photo data URL.
- Passwords in Firestore are stored as plain text for demo purposes. Replace with hashed storage and real auth for production.
- QR tokens embed `exp` and are signed with `QR_SECRET`; TTL is enforced by JWT verification.

## Scripts
- `server/scripts/import-data.js`: seed Firestore with example companies/users/displays (edit before running).  
- `server/scripts/test-firestore.js`: quick connectivity test that writes/cleans up test docs.

## Notes and caveats
- Demo bearer tokens and plain-text logins are for local testing only; integrate proper auth before production use.
- The web apps and scanner try to auto-detect the API base URL but allow overriding via query params (`api`) or by changing `_defaultEndpoints` in the Flutter service.
- Sensitive credentials are intentionally omitted; provide your own service account JSON and secrets.
