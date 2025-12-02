# Integrations Guide

This application is designed to integrate with two key external services: **Microsoft Azure Active Directory (via the Graph API)** and an **SMTP Server**.

## Microsoft Graph API Integration

The Graph API is the source of all user and password information.

### Purpose

-   To fetch a list of users from your Azure AD tenant.
-   To retrieve critical user properties, including:
    -   `id`
    -   `displayName`
    -   `userPrincipalName` (email)
    -   `passwordLastSetDateTime`
-   To query for members of specific Azure AD groups for targeted notifications.

### Setup and Configuration

To allow the application to access this data, you must create an **App Registration** in your Azure AD tenant.

1.  **Register an Application:** In the Azure Portal, go to **Azure Active Directory > App registrations > New registration**.
2.  **API Permissions:** Grant your application the necessary permissions. The primary permission required is:
    -   **`User.Read.All` (Application Permission):** This allows the application to read the full profile of all users in the organization without a signed-in user. This is necessary for a backend service that runs automatically. You will need an administrator to grant admin consent for this permission.
3.  **Create a Client Secret:** Under **Certificates & secrets**, create a new client secret. **Copy this value immediately and store it securely.** You will not be able to view it again.

The **Tenant ID**, **Application (client) ID**, and **Client Secret** are the three credentials that the backend service will use to authenticate with the Graph API. These are configured in the application's Settings page (and should be stored securely on the backend in a production environment).

## SMTP Server Integration

The application sends all email notifications via a standard SMTP server.

### Purpose

-   To send password expiry warnings to end-users, their managers, and/or designated administrators.
-   To provide flexibility, allowing you to use any email service you prefer (e.g., Microsoft 365, SendGrid, Mailgun, or an internal mail relay).

### Configuration

The following SMTP settings are required, which are configurable on the Settings page:

-   **Host:** The address of your SMTP server (e.g., `smtp.office365.com`).
-   **Port:** The port number (e.g., `587` for TLS).
-   **Use SSL/TLS:** A boolean to enable encrypted communication.
-   **Username:** The username for authenticating with the SMTP server.
-   **Password:** The password for the SMTP account.

## Targeting Specific User Groups

A key feature of this application is the ability to create different notification rules for different groups of users.

This is achieved through the **"Assigned Groups"** field in a **Notification Profile**.

### How it Works

1.  When creating a Notification Profile, you can specify one or more Azure AD group names (e.g., "Developers", "Executives", "All Users").
2.  The backend's scheduled task will read each profile.
3.  For a given profile, it will use the Graph API to query for all members of the "Assigned Groups".
4.  The notification rules (cadence, email template) from that profile are then applied *only* to the users found within those groups.

This allows for granular control. For example, you can have a profile with an aggressive notification schedule for service accounts, and a more standard schedule for regular employees.
