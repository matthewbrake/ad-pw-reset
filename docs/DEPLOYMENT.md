# Deployment Guide

This guide provides instructions and considerations for deploying the Azure AD Password Expiry Notifier.

## Overview

The project consists of two main parts: a **frontend** (the provided React application) and a **backend** (which you need to build).

### Prerequisites

- A web server or static hosting service (e.g., Nginx, Apache, Vercel, Netlify, Azure Static Web Apps).
- A server environment to host the backend application (e.g., a VM, container, or serverless platform).
- An Azure subscription with permissions to create App Registrations in Azure Active Directory.
- An SMTP server for sending email notifications.

## 1. Frontend Deployment

The frontend is a standard React application. It's composed of static files (HTML, CSS, JS) that can be hosted on any static web hosting service.

1.  **Build the Application:** You will need a build tool like Vite or Create React App to bundle the project for production. This typically involves running a command like:
    ```bash
    npm run build
    ```
2.  **Deploy the Static Files:** The build process will generate a `dist` or `build` directory. Upload the contents of this directory to your chosen static hosting provider.

That's it for the frontend. The main work for a real deployment is creating the backend.

## 2. Backend Development & Deployment

The current application uses a mock API (`services/mockApi.ts`). To make the application functional, you must create a real backend service that this frontend can communicate with.

### Backend Responsibilities

Your backend server must implement API endpoints to handle the following:

-   **User Data:** An endpoint like `GET /api/users` that securely queries the Microsoft Graph API for user password information.
-   **Connection Testing:** Endpoints to test the Graph API and SMTP connections using the credentials stored on the backend.
-   **Profile Management:** CRUD (Create, Read, Update, Delete) endpoints for managing notification profiles, which should be stored in a database.
-   **Scheduled Notifications:** A core feature that runs on a schedule (e.g., a daily cron job). This job will check for expiring passwords and send emails.

### Example Backend Stack

-   **Language/Framework:** Node.js with Express, Python with Flask/Django, or C# with ASP.NET Core.
-   **Database:** PostgreSQL, MySQL, or a NoSQL database like MongoDB to store notification profiles.

### Deployment Steps

1.  **Implement the API:** Create the backend logic and API endpoints.
2.  **Configure Environment Variables:** Your backend will need environment variables for the Azure Tenant ID, Client ID, Client Secret, SMTP credentials, and database connection string. **Never hardcode these in your source code.**
3.  **Deploy the Backend:** Deploy your backend application to a server, container (e.g., Docker), or serverless platform (e.g., AWS Lambda, Azure Functions).
4.  **Update Frontend API Calls:** Modify the frontend code (by replacing `mockApi.ts`) to make `fetch` requests to your new, deployed backend API endpoints. You will likely need to configure the base URL of your API in the frontend.
