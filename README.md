# Azure AD Password Expiry Notifier

A web application to monitor Azure Active Directory user password expirations and send configurable email notifications.

## ⚡️ Manual Run (NPM) - Copy & Paste

If you do not want to use Docker, you can run this directly on your machine using Node.js.

### 1. Install & Build
```bash
# Install dependencies
npm install

# Build the frontend (React -> static files)
npm run build
```

### 2. Run the Server
You can specify the port using the `PORT` environment variable.

**Linux/Mac:**
```bash
# Run on default port 3000
npm start

# Run on port 8085
PORT=8085 npm start
```

**Windows (PowerShell):**
```powershell
# Run on port 8085
$env:PORT=8085; npm start
```

## 🐳 Docker Run

### Quick Start
This will start the app on **Port 8085**.

```bash
docker-compose up -d --build
```

Access the app at: `http://localhost:8085`

### Change Port
If you want to change it from 8085 to something else (e.g., 9090):
```bash
WEB_PORT=9090 docker-compose up -d
```

## 🔑 Authentication & Permissions (How it works)

This app runs as a **Background Service** (Daemon). It does not use your personal user account to run the daily checks; it uses an **App Registration**.

### 1. The "Sign In" Button (Admin Consent)
In the **Settings** tab, there is a **"Grant Admin Consent"** button.
*   **What it does:** It opens a Microsoft popup where you sign in as a Global Admin.
*   **Why:** You click "Accept" once. This gives the *App Registration* permission to read users.
*   **Result:** You can now close the browser, and the app will still work 24/7 because it uses the Client Secret to "login" as the App itself.

### 2. Required Permissions
The app needs these **Application Permissions** (not Delegated):
*   `User.Read.All` (To calculate password expiry)
*   `Group.Read.All` (To filter by assigned groups)

### 3. Traffic Light System
The Settings page has a "Validate" button that checks 3 things:
1.  **Auth:** Are Client ID/Secret correct?
2.  **User Read:** Can the app read users?
3.  **Group Read:** Can the app read groups?

## 🛡 Safeguards
*   **Test Mode:** When running a "Test" profile, emails are **forced** to the Admin email defined in the settings. They are NOT sent to real users.
*   **Logs:** Click "Show Console" in the bottom left to see the live logic execution.