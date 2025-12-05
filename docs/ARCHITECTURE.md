
# Application Architecture

This document outlines the architecture of the Azure AD Password Expiry Notifier.

## High Level Overview

This is a **Monolithic Node.js Application** that serves both the frontend and the API.

- **Frontend:** React + TypeScript (Compiled to static HTML/JS in `dist/`).
- **Backend:** Node.js + Express (`server.js`).
- **Database:** Local JSON File (`config/app-settings.json`).

The application runs as a single container or process. The Node.js server acts as the web server for the UI and the API gateway for Azure Graph.

---

## 🔑 The Password Expiry Logic (Crucial)

Azure AD (Entra ID) does **not** expose a field called `expirationDate` for users synchronized from On-Premise Active Directory (Hybrid Users).

Therefore, this application **calculates** the date dynamically using the following logic:

### 1. Data Source
We fetch the following fields from Microsoft Graph API:
- `lastPasswordChangeDateTime`: The timestamp when the password was last changed (synced from on-prem).
- `onPremisesSyncEnabled`: Boolean flag indicating if the user is a Hybrid user.
- `passwordPolicies`: String (e.g., "DisablePasswordExpiration").

### 2. The Formula
```javascript
ExpiryDate = lastPasswordChangeDateTime + ConfiguredDefaultDays (e.g., 90)
DaysRemaining = ExpiryDate - Today
```

### 3. The "Hybrid Override" Rule
Azure AD automatically sets the `DisablePasswordExpiration` policy for synced users because the cloud does not enforce the expiration (the on-prem Domain Controller does).

**The Logic:**
- IF `user.onPremisesSyncEnabled` is **TRUE**:
  - We **IGNORE** the `DisablePasswordExpiration` flag.
  - We **FORCE** the calculation using the formula above.
- IF `user.onPremisesSyncEnabled` is **FALSE** (Cloud Only):
  - We **RESPECT** the `DisablePasswordExpiration` flag.
  - If set, the user is marked as "Never Expires" (999 days).

---

## Technology Stack

### Frontend
- **Framework:** React 18
- **Styling:** Tailwind CSS (via CDN for simplicity in this specific build)
- **Build Tool:** Vite (Outputs to `dist/`)

### Backend
- **Runtime:** Node.js
- **Server:** Express
- **Email:** Nodemailer (SMTP)
- **Http Client:** Axios (for Graph API)

## Data Flow

1. **User Request:** Administrator clicks "Run Job" in the UI.
2. **API Call:** Frontend calls `POST /api/run-job`.
3. **Graph Query:** Node.js backend gets an Access Token and queries `https://graph.microsoft.com/v1.0/users`.
4. **Processing:** Backend iterates through users, applies the **Expiry Logic** described above.
5. **Action:**
   - If **Preview Mode**: Returns JSON list of targets.
   - If **Live Mode**: Uses `Nodemailer` to send SMTP messages to the users.
