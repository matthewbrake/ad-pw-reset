
# Integrations Guide

This document details exactly how the application interacts with external services. Use this if you need to rebuild the backend logic in another language (C#, Python, etc.).

## 1. Microsoft Graph API

The application acts as a **Background Daemon** using the Client Credentials Flow.

### Authentication
**Endpoint:** `POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`

**Payload:**
```x-www-form-urlencoded
client_id: {your_client_id}
client_secret: {your_client_secret}
scope: https://graph.microsoft.com/.default
grant_type: client_credentials
```

### Fetching Users
This is the most critical query in the application.

**Endpoint:** `GET https://graph.microsoft.com/v1.0/users`

**Headers:**
`Authorization: Bearer {access_token}`

**Query Parameters:**
We select specific fields to optimize performance and get the necessary sync data.
```http
$select=id,displayName,userPrincipalName,accountEnabled,passwordPolicies,lastPasswordChangeDateTime,createdDateTime,onPremisesSyncEnabled
$top=999
```

**JSON Response Example:**
```json
{
    "value": [
        {
            "id": "12345-abcde-...",
            "displayName": "John Doe",
            "userPrincipalName": "john.doe@company.com",
            "accountEnabled": true,
            "onPremisesSyncEnabled": true,  <-- CRITICAL: Identifies Hybrid User
            "passwordPolicies": "DisablePasswordExpiration", <-- CRITICAL: Ignored if Hybrid
            "lastPasswordChangeDateTime": "2023-10-25T12:00:00Z" <-- CRITICAL: Used for calculation
        }
    ]
}
```

### Fetching Group Members
When filtering by group, the app resolves the group ID by name, then fetches members.

1. **Find Group ID:** `GET /groups?$filter=displayName eq 'My Group'&$select=id`
2. **Get Members:** `GET /groups/{id}/transitiveMembers?$select=...`

---

## 2. SMTP Integration

The app uses `nodemailer`.

**Configuration Required:**
- Host (e.g., `smtp.office365.com`)
- Port (e.g., `587`)
- Secure (TLS/STARTTLS)
- Auth User/Pass

**Standard Logic:**
The app constructs an email using the template defined in the Profile, replacing variables `{{user.displayName}}`, `{{daysUntilExpiry}}`, etc., and sends it via the configured SMTP transport.
