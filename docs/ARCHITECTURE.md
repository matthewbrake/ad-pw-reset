# Application Architecture

This document outlines the architecture of the Azure AD Password Expiry Notifier application.

## Overview

The application is architected as a **Single-Page Application (SPA)** with a conceptual backend. The current codebase only includes the frontend implementation, which communicates with a mock API for demonstration purposes.

### Technology Stack

- **Frontend:**
  - **Framework:** React with TypeScript
  - **Styling:** Tailwind CSS
  - **State Management:** React Hooks (`useState`, `useEffect`) and a custom `useLocalStorage` hook for persistent, client-side storage of settings.
- **Backend (Conceptual / Mocked):**
  - The `services/mockApi.ts` file simulates a backend server. In a real-world deployment, this would be replaced by a dedicated server application (e.g., built with Node.js, Python, or .NET).

## Frontend Structure

The frontend code is organized into several key directories:

- **`components/`**: Contains reusable React components that make up the UI.
  - `App.tsx`: The root component, managing navigation and layout.
  - `Dashboard.tsx`: Displays user password expiry statistics and a filterable user table.
  - `Settings.tsx`: Provides forms to configure Azure AD and SMTP connections.
  - `Profiles.tsx`: Manages the creation, editing, and deletion of notification profiles.
  - `UserTable.tsx`, `ProfileEditor.tsx`: More specific, reusable components.
  - `icons.tsx`: SVG icon components.
- **`hooks/`**: Contains custom React hooks.
  - `useLocalStorage.ts`: A hook to simplify reading from and writing to the browser's local storage, used to persist configuration settings.
- **`services/`**: Handles communication with the backend.
  - `mockApi.ts`: Simulates API calls to fetch users, test connections, and manage profiles. In a production environment, this file would be replaced by a client that makes `fetch` requests to a real backend API.
- **`types.ts`**: Defines TypeScript interfaces for the application's data structures (e.g., `User`, `NotificationProfile`).

## Backend Responsibilities (Conceptual)

For this application to be fully functional, a backend server is required. Its primary responsibilities would be:

1.  **Secure Credential Storage:** Securely store sensitive information like the Azure AD Client Secret and SMTP password. These should never be exposed on the frontend.
2.  **API Proxy:** Act as a secure proxy between the frontend and the Microsoft Graph API. The frontend would make requests to the backend, which would then use its stored credentials to authenticate with and query the Graph API.
3.  **SMTP Service:** Handle the sending of emails via the configured SMTP server.
4.  **Scheduled Task Runner (Cron Job):** The core logic of the application would run on a schedule (e.g., once daily). This scheduled task would:
    - Fetch all relevant users from Azure AD, potentially filtered by groups.
    - Check the password expiry status for each user.
    - Determine which users need a notification based on the configured `NotificationProfile` cadences.
    - Construct and send the appropriate emails.

## Data Flow

**Current (Mock) Data Flow:**
1.  A React component (e.g., `Dashboard`) needs data.
2.  It calls a function from `services/mockApi.ts`.
3.  The mock API function returns hardcoded, simulated data after a short delay to mimic network latency.
4.  The component receives the data and updates its state, causing the UI to re-render.

**Production (Conceptual) Data Flow:**
1.  A React component calls a function from a new `services/api.ts` file.
2.  This function sends an authenticated HTTP request (e.g., `GET /api/users`) to the custom backend server.
3.  The backend receives the request, validates it, and calls the Microsoft Graph API using its stored credentials.
4.  The Graph API returns user data to the backend.
5.  The backend processes the data and sends it back to the frontend in a JSON response.
6.  The React component receives the data and updates its state.
