# Firebase Setup Instructions

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** or select an existing project
3. Enable **Firestore Database**:
   - Go to **Build** → **Firestore Database**
   - Click **"Create database"**
   - Choose **"Start in production mode"** or **"Start in test mode"** (for development)
   - Select a region close to your users

## 2. Generate Service Account Key

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Navigate to **Service accounts** tab
3. Click **"Generate new private key"**
4. Save the JSON file as `firebase-service-account.json` in the `server/` directory

## 3. Configure Environment

The `.env` file is already configured to look for:
```
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
```

Make sure the JSON file is in the `server/` directory.

## 4. Firestore Security Rules (Optional)

For production, update your Firestore rules in Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write only from server (admin SDK bypasses rules)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The Admin SDK bypasses these rules, so they only affect client-side access.

## 5. Run the Server

```bash
cd server
npm run dev
```

## Firestore Collections Structure

The following collections will be created automatically:

| Collection | Description |
|------------|-------------|
| `companies` | Company information |
| `users` | Employee/Admin accounts |
| `displays` | QR display screens |
| `qr_sessions` | QR code sessions |
| `scans` | Attendance records |

## Adding Sample Data

You can add sample data via Firebase Console or programmatically:

### Example: Add a Company
```javascript
// In Firestore Console or via code
{
  "name": "ABC Corporation",
  "employee_count": 50,
  "logo": null,
  "location_label": "Hanoi, Vietnam"
}
```

### Example: Add a Display
```javascript
{
  "company_id": "company-1",
  "label": "Main Gate"
}
```
