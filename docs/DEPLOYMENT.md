
# Deployment Guide

## 1. Azure AD Setup (App Registration)

To make this app work, you must register it in your Azure Tenant.

1. Go to **Azure Portal** > **Microsoft Entra ID** > **App registrations**.
2. Click **New Registration**.
   - Name: `Password Expiry Notifier`
   - Accounts: `Single tenant`
3. Once created, copy the **Application (client) ID** and **Directory (tenant) ID**.
4. Go to **Certificates & secrets** > **New client secret**. Copy the **Value**.

### Manifest Snippet (Permissions)
You can go to the **Manifest** tab in your App Registration and ensure the `requiredResourceAccess` section looks like this to grant the correct permissions (`User.Read.All` and `Group.Read.All`):

```json
"requiredResourceAccess": [
    {
        "resourceAppId": "00000003-0000-0000-c000-000000000000", 
        "resourceAccess": [
            {
                "id": "df021288-bdef-4463-88db-98f22de89214",
                "type": "Role"  // User.Read.All (Application)
            },
            {
                "id": "5b567255-7703-4780-807c-7be8301ae99b",
                "type": "Role"  // Group.Read.All (Application)
            }
        ]
    }
]
```
*Note: After updating the manifest, you MUST click "Grant admin consent" in the API Permissions tab.*

---

## 2. Server Deployment

This application is a self-contained Node.js app.

### Option A: Docker (Recommended)
You can run this container anywhere (Azure Container Instances, AWS ECS, Local Server).

**Build:**
```bash
docker build -t expiry-notifier .
```

**Run:**
```bash
docker run -d -p 80:3000 \
  -e AZURE_TENANT_ID=... \
  -e AZURE_CLIENT_ID=... \
  -e AZURE_CLIENT_SECRET=... \
  -v $(pwd)/config:/app/config \
  expiry-notifier
```

### Option B: Azure App Service (Web App)
1. Create a **Web App** in Azure (Node.js 18+).
2. Deploy the code (via VS Code, GitHub Actions, or Local Git).
3. Go to **Settings** > **Environment variables** in the Azure Portal.
4. Add your settings:
   - `AZURE_TENANT_ID`
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `SMTP_HOST`
   - `SMTP_PASSWORD`
   - ...etc
5. The app will start automatically (`npm start` is the default startup command).

---

## 3. Persistence Note

The application stores settings (Config profiles) in a local JSON file: `config/app-settings.json`.

- **In Docker:** You MUST map a volume to `/app/config` if you want settings to survive a container restart.
- **In Azure Web App:** The filesystem is generally persisted, but it is better practice to rely on Environment Variables for the connection strings. The Notification Profiles (JSON) will persist in the `/home` directory if configured correctly, but using an external database would be preferred for a high-scale production version.
