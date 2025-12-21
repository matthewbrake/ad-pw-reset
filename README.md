
# Azure AD Password Expiry Notifier (Enterprise Edition)

A professional-grade system for automated password expiration monitoring and notification in Hybrid Azure AD environments.

## 🚀 Key Features
- **Unified Data Root**: Single volume mount (`./data`) for all persistence (config, logs, history).
- **Dual-Source Configuration**: Support for both `.env` variables and a persistent JSON database via the Web UI.
- **Advanced Expiry Logic**: Intelligent calculation for Hybrid users, respecting on-prem sync state over cloud policies.
- **Enterprise Observability**: Real-time system console with sub-millisecond precision and file-based logging.
- **Profile Portability**: Export and import notification logic as standardized JSON.
- **Safety First**: Integrated Preview Mode to visualize impact before sending a single byte of email.

## 🐳 Docker Architecture
The recommended deployment uses a single root volume for all persistent data.

```yaml
services:
  notifier:
    image: ad-notifier:latest
    ports:
      - "8085:3000"
    volumes:
      - ./data:/app/data
    environment:
      - AZURE_TENANT_ID=your_tenant
      - AZURE_CLIENT_ID=your_id
      - AZURE_CLIENT_SECRET=your_secret
```

## 📂 Directory Structure
- `/data/config/`: Configuration, Queue, and Notification Profiles.
- `/data/logs/`: Raw server execution logs (`server.log`).
- `/data/exports/`: Manual and scheduled CSV/JSON data exports.

## 🛡 Security
Secrets are never logged to the console or log files. The Web UI masks secrets with `********` when transmitting back to the browser.
