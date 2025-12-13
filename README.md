
# Azure AD Password Expiry Notifier

A web application to monitor Azure Active Directory user password expirations and send configurable email notifications.

## 🐳 Docker Deployment (Production)

To deploy using Docker, you must first extract the Dockerfile from the documentation.

### 1. Prepare Dockerfile
Run this command in the project root:
```bash
cp ./docs/Dockerfile.md Dockerfile
```

### 2. Build & Run
```bash
docker-compose up -d --build
```
The app will be available at `http://localhost:8085` (or the port defined in docker-compose.yml).

## ⚡️ Manual Run (NPM)

### 1. Install & Build
```bash
npm install
npm run build
```

### 2. Run Server
```bash
# Linux/Mac
PORT=8085 npm start

# Windows (PowerShell)
$env:PORT=8085; npm start
```

## 🔑 Authentication & Permissions

This app runs as a **Background Service** (Daemon) using the **Client Credentials Flow**. It does not run as "You".

1.  **Register App:** Create an App Registration in Azure AD.
2.  **Permissions:** Add `User.Read.All` and `Group.Read.All` (Application Permissions).
3.  **Grant Consent:**
    *   Go to the **Settings** tab in this web app.
    *   Enter your Client ID and Tenant ID.
    *   Click the **"Grant Admin Consent"** link.
    *   Sign in with your Admin account and click "Accept".
    *   **Result:** The App now has permission to read users 24/7 without your account being signed in.

## 🛡 Safety Features

*   **Read-Only:** The app only performs `GET` requests against Azure AD. It cannot modify users or reset passwords.
*   **Test Mode:** Use "Test Run" to send emails *only* to yourself (the Admin email) to verify formatting.
*   **Freshness:** Every time an email job runs, the system re-calculates the expiration date in real-time to ensure accuracy.
*   **Retry Limit:** The queue worker will attempt to send an email 3 times before marking it as "Failed" to prevent infinite loops.
