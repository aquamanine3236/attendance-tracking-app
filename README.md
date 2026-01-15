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

## Setup and running
### 1) Backend (`server/`)
1. Copy env template: `cp server/.env.example server/.env` and set values:
   - `FIREBASE_SERVICE_ACCOUNT` path to your real service account JSON (place it as `server/firebase-service-account.json` or point elsewhere).
   - `QR_SECRET`, `QR_TTL_SECONDS`, and `ADMIN_JWT`/`DISPLAY_JWT`/`USER_JWT` demo tokens used by the clients.
   - `ALLOW_MULTI_SCAN=true` if you want to allow reusing the same QR in tests.
2. Install deps: `cd server && npm install`.
3. Seed optional sample data: edit `server/scripts/import-data.js` with your companies/users (passwords are plain text) and run `node scripts/import-data.js`.
4. Start the API: `npm run dev` (reload) or `npm start`. The server also serves the web clients at `/admin` and `/display`.

### 2) Web clients
- **Admin dashboard**: open `http://localhost:4000/admin/`, log in with a Firestore user where `role === "admin"`, pick a company, watch scans live, generate QR, and export via CSV/XLSX. Filters include date, type, and search.
- **QR display**: open `http://localhost:4000/display/`, pick a company, and keep it on-screen. It auto-refreshes on `qr:new` and shows 'scanned' feedback. Buttons: refresh QR and download PNG.  
  URL params override defaults: `?companyId=...&company=Name&token=<display-token>&api=http://host:4000`.

### 3) Mobile scanner (`scanner_app/`)
1. `cd scanner_app && flutter pub get`
2. Ensure the app can reach your API:
   - Defaults in `lib/services/api_service.dart` try `https://testchamcong.merlinle.com`, then `10.0.2.2:4000`, `localhost:4000`, `127.0.0.1:4000`.
   - For devices on your LAN, set the first entry to your host IP (for example `http://192.168.x.x:4000`).
3. Run on a device/emulator: `flutter run`.
4. Log in with an employee account (`role === "employee"`), grant location permission, pick **Check In** or **Check Out**, and scan the on-screen QR. If the camera cannot scan, the app can decode a QR from an uploaded image.

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
