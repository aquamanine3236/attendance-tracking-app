# Demo QR Scanning & Tracking System

A complete real-time QR scanning and attendance tracking system with three modules: **Admin Dashboard**, **QR Display**, and **Mobile Scanner**.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the System](#running-the-system)
- [Demo Flow](#demo-flow)
- [API Reference](#api-reference)
- [Reused Code](#reused-code)

---

## Overview

This system enables real-time attendance tracking through QR code scanning:

1. **Admin** generates secure, time-limited QR codes
2. **Display** shows the current active QR code on a screen
3. **Scanner** (mobile app) scans the QR and submits user information
4. **Admin** sees the scan appear in real-time

### Key Features

- ⚡ **Real-time updates** via WebSocket (Socket.IO)
- 🔐 **Secure QR tokens** with JWT signing and TTL
- 📍 **GPS location capture** from mobile devices
- 🔄 **Auto-regeneration** of QR after each successful scan
- 📊 **CSV export** of scan records
- 🌙 **Dark theme** across all interfaces

---

## Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│  Admin Dashboard │◄──────────────►│                 │
│   (Web Browser)  │                 │                 │
└─────────────────┘                  │     Server      │
                                     │  (Node.js +     │
┌─────────────────┐    WebSocket     │   Socket.IO)    │
│   QR Display     │◄──────────────►│                 │
│  (Web Browser)   │                 │                 │
└─────────────────┘                  │                 │
                                     └────────┬────────┘
┌─────────────────┐    HTTP/REST              │
│  Mobile Scanner  │◄────────────────────────┘
│   (Flutter App)  │
└─────────────────┘
```

---

## Folder Structure

```
Demo/
├── server/                    # Node.js backend server
│   ├── src/
│   │   └── server.js          # Main server with Express + Socket.IO
│   ├── package.json           # Dependencies
│   ├── .env                   # Environment configuration
│   └── .env.example           # Config template
│
├── web-admin/                 # Admin dashboard (web)
│   └── index.html             # Admin interface
│
├── web-display/               # QR display screen (web)
│   └── index.html             # Display interface
│
├── scanner_app/               # Flutter mobile scanner
│   ├── lib/
│   │   ├── main.dart          # App entry point
│   │   ├── models/
│   │   │   └── scan_data.dart # Data models
│   │   ├── screens/
│   │   │   ├── home_screen.dart
│   │   │   ├── scanner_screen.dart
│   │   │   ├── user_form_screen.dart
│   │   │   └── result_screen.dart
│   │   └── services/
│   │       ├── api_service.dart
│   │       └── location_service.dart
│   ├── android/               # Android configuration
│   └── pubspec.yaml           # Flutter dependencies
│
└── README.md                  # This file
```

---

## Prerequisites

### Server
- **Node.js** v18+ ([Download](https://nodejs.org))
- **npm** (comes with Node.js)

### Mobile Scanner
- **Flutter SDK** v3.0+ ([Install Flutter](https://flutter.dev/docs/get-started/install))
- **Android Studio** or **VS Code** with Flutter extensions
- **Android device/emulator** or **iOS device/simulator**

### Web Modules
- Any modern web browser (Chrome, Firefox, Edge, Safari)

---

## Installation & Setup

### 1. Server Setup

```bash
# Navigate to server directory
cd Demo/server

# Install dependencies
npm install

# Copy environment file (optional, defaults work for demo)
copy .env.example .env
```

### 2. Flutter Scanner Setup

```bash
# Navigate to scanner app
cd Demo/scanner_app

# Get Flutter dependencies
flutter pub get

# For Android: Ensure you have an emulator running or device connected
flutter devices
```

---

## Running the System

### Step 1: Start the Server

```bash
cd Demo/server
npm start
```

You should see:
```
╔═══════════════════════════════════════════════════════════════╗
║         Demo QR Scanning & Tracking Server                    ║
║  Server listening on port 4000                                ║
╚═══════════════════════════════════════════════════════════════╝
```

### Step 2: Open Admin and Display pages

Open another Terminal

```bash
npx -y serve .
```

Then open web-admin and web-display

### Step 3: Run Mobile Scanner

```bash
cd Demo/scanner_app

# Run on connected device or emulator
flutter run
```

**For Android Emulator**: The app uses `10.0.2.2:4000` to connect to localhost.

**For Physical Device**: Either:
- Run server on a LAN-accessible IP
- Use the "Server URL" field in the app to specify the server address

---

## Demo Flow

### Complete Workflow

1. **Start Server** → Backend ready on port 4000
2. **Open Admin** → Dashboard connects and shows "Connected"
3. **Open Display** → QR code appears automatically
4. **Run Scanner App** → Verify "Connected" status
5. **Click "Start Scanning"** → Camera opens
6. **Scan the QR code** on Display screen
7. **Fill in user information**:
   - Full Name
   - Job Title
   - Employee ID
   - (Location captured automatically)
8. **Submit** → Success message shown
9. **Check Admin** → New scan appears in real-time
10. **Check Display** → New QR generated automatically

### Testing Manually

You can test the Admin → Display flow without the mobile app:

1. Open Admin and Display in separate browser tabs
2. Click **"Generate New QR"** in Admin
3. Watch Display update with new QR
4. Use the web scanner at `Demo/Test/web-scanner/index.html` for testing

---

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | - | Health check |
| `/admin/qr` | POST | Admin | Generate new QR |
| `/display/qr/current` | GET | Display | Get current QR |
| `/scan` | POST | User | Submit scan |
| `/admin/scans` | GET | Admin | List all scans |
| `/admin/export.csv` | GET | Admin | Export CSV |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `qr:new` | Server → Display | New QR generated |
| `qr:consumed` | Server → Display | QR was scanned |
| `scan:logged` | Server → Admin | New scan recorded |
| `ready` | Server → Client | Connection established |

### Demo Tokens

| Role | Token |
|------|-------|
| Admin | `demo-admin-token` |
| Display | `demo-display-token` |
| User | `demo-user-token` |

---

## Reused Code

This demo system was built by adapting and reusing code from existing folders:

### From `qr_code_scanner/`

| Source | Used In | What Was Adapted |
|--------|---------|------------------|
| `example/lib/main.dart` | `scanner_screen.dart` | QR scanning UI patterns, camera controls layout |
| `lib/src/qr_code_scanner.dart` | `scanner_screen.dart` | Overlay design, permission handling patterns |
| `lib/src/qr_scanner_overlay_shape.dart` | `ScanOverlayPainter` | Corner indicator drawing logic |

### From `Test/`

| Source | Used In | What Was Adapted |
|--------|---------|------------------|
| `server/src/server.js` | `Demo/server/src/server.js` | Full server architecture, QR generation, Socket.IO setup |
| `web-admin/index.html` | `Demo/web-admin/index.html` | Admin UI, real-time table, styling |
| `web-display/index.html` | `Demo/web-display/index.html` | Display UI, auto-update logic |
| `web-scanner/index.html` | API patterns in Flutter | API communication patterns |

### Key Adaptations

1. **Flutter Scanner**: Used `mobile_scanner` package instead of `qr_code_scanner` plugin for better modern Flutter support, but adapted UI patterns from the example.

2. **Server**: Kept the same architecture with minor enhancements for better logging and documentation.

3. **Web Interfaces**: Enhanced styling with gradients, animations, and improved UX (download button, fullscreen mode).

---

## Configuration

### Server Environment Variables

Edit `Demo/server/.env`:

```env
PORT=4000                  # Server port
QR_SECRET=your-secret      # JWT signing secret
QR_TTL_SECONDS=60          # QR expiration time
ADMIN_JWT=admin-token      # Admin auth token
DISPLAY_JWT=display-token  # Display auth token
USER_JWT=user-token        # User auth token
```

### Mobile App Server Connection

The app tries these URLs in order:
1. Custom URL (if specified in the app)
2. `http://10.0.2.2:4000` (Android emulator)
3. `http://localhost:4000`
4. `http://127.0.0.1:4000`

---

## Troubleshooting

### Server won't start
- Ensure Node.js v18+ is installed
- Run `npm install` in the server directory
- Check if port 4000 is available

### Web modules show "No reachable API"
- Ensure server is running
- Check browser console for CORS errors
- Try opening with `?api=http://localhost:4000`

### Flutter app can't connect
- For emulator: Server must be running on `localhost:4000`
- For physical device: Use LAN IP address in server URL field
- Check that `android:usesCleartextTraffic="true"` is in manifest

### Camera not working on mobile
- Grant camera permission when prompted
- On Android, ensure Camera permission in App Settings
- Try restarting the app

---

## License

This is a demo project for educational purposes.
