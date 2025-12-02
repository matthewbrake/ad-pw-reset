# Azure AD Password Expiry Notifier

A Dockerized React application to monitor Azure Active Directory user password expirations and send configurable email notifications.

## 🚀 Quick Start (Docker)

You can run this application quickly using Docker Compose.

1. **Clone the repository.**
2. **Run with Docker Compose:**
   By default, it runs on port 3000.
   ```bash
   docker-compose up -d
   ```

3. **Custom Port:**
   If you want to run it on a different port (e.g., 8080):
   ```bash
   WEB_PORT=8080 docker-compose up -d
   ```

4. **Access the App:**
   Open your browser to `http://localhost:3000` (or your custom port).

## 🏗 Architecture & Logic

### How it Connects to Azure (The Logic)
1. **Authentication:** The application uses the **Client Credentials Flow**. You provide a Tenant ID, Client ID, and Client Secret.
2. **Token Request:** The app exchanges these credentials for a JWT Access Token via `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`.
3. **Graph API:** With the token, it queries the **Microsoft Graph API** (`https://graph.microsoft.com/v1.0/users`) to fetch:
   - `userPrincipalName` (Email)
   - `passwordPolicies`
   - `lastPasswordChangeDateTime`

### Permissions Required
To function correctly, your Azure App Registration needs the following **Application Permissions**:
*   `User.Read.All` (To read password expiration dates)
*   `Group.Read.All` (If you want to filter by Groups)

### Safeguards
*   **Test Mode:** In the Profiles tab, you can "Test Run" a profile. This calculates the logic but **overrides the recipient** to send the email ONLY to you (the admin) instead of the actual users.
*   **Logging:** Toggle the "Live Console" in the UI to see exactly what logic the application is performing (Fetch -> Filter -> Check Expiry -> Send).

## 🛠 Deployment
This is a standard React SPA. The Dockerfile builds the static assets and serves them via Nginx.
