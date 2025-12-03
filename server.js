import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import nodemailer from 'nodemailer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- PERSISTENCE (Simple JSON File) ---
const CONFIG_FILE = path.join(__dirname, 'config', 'app-settings.json');
// Ensure config dir exists
if (!fs.existsSync(path.join(__dirname, 'config'))) {
    fs.mkdirSync(path.join(__dirname, 'config'));
}

let runtimeConfig = {
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        username: process.env.SMTP_USERNAME || '',
        password: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.SMTP_FROM || ''
    }
};

// Load saved config if exists
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        runtimeConfig = { ...runtimeConfig, ...saved };
        console.log("Loaded configuration from disk.");
    } catch (e) {
        console.error("Failed to load config file:", e);
    }
}

// --- HELPER: LOGGING ---
// In a real app, use websockets or SSE. For now, we print to stdout, 
// and the frontend can poll a log endpoint if needed, or we just return logs in response.
const log = (level, message, details = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${level.toUpperCase()}] ${message}`);
    return { timestamp, level, message, details };
};

// --- HELPER: GRAPH AUTH ---
const getGraphToken = async () => {
    const { tenantId, clientId, clientSecret } = runtimeConfig;
    if (!tenantId || !clientId || !clientSecret) {
        throw new Error("Missing Azure Credentials in Configuration.");
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'client_credentials');

    try {
        const response = await axios.post(tokenEndpoint, params);
        return response.data.access_token;
    } catch (error) {
        console.error("Token Error:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with Azure AD. Check Tenant/Client ID and Secret.");
    }
};

// --- API ROUTES ---

// Save Config
app.post('/api/config', (req, res) => {
    const { tenantId, clientId, clientSecret, smtp } = req.body;
    runtimeConfig = { ...runtimeConfig, tenantId, clientId, clientSecret, smtp };
    
    // Save to disk
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(runtimeConfig, null, 2));
    
    res.json({ success: true, message: "Configuration saved to server." });
});

// Load Config (masking secret)
app.get('/api/config', (req, res) => {
    const masked = { ...runtimeConfig };
    masked.clientSecret = masked.clientSecret ? '********' : '';
    masked.smtp.password = masked.smtp.password ? '********' : '';
    res.json(masked);
});

// Fetch Users (The core logic)
app.get('/api/users', async (req, res) => {
    try {
        const token = await getGraphToken();
        
        // Select specific fields for efficiency
        const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                '$select': 'id,displayName,userPrincipalName,accountEnabled,passwordPolicies,lastPasswordChangeDateTime,createdDateTime',
                '$top': 999
            }
        });

        // Simple Password Expiry Logic (Assume 90 days if not set in passwordPolicies)
        // Note: Real world requires checking domain password policy. Here we simulate or use a default.
        const DEFAULT_EXPIRY_DAYS = 90;
        
        const users = response.data.value.map(u => {
            let lastSet = u.lastPasswordChangeDateTime || u.createdDateTime; // Fallback to creation
            let expiryDate = new Date(lastSet);
            
            // Check if password never expires
            const policies = u.passwordPolicies || "";
            const neverExpires = policies.includes("DisablePasswordExpiration");
            
            expiryDate.setDate(expiryDate.getDate() + DEFAULT_EXPIRY_DAYS);
            
            const now = new Date();
            const diffTime = Math.abs(expiryDate - now);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            const expiresInDays = neverExpires ? 999 : (expiryDate > now ? diffDays : -diffDays);

            return {
                id: u.id,
                displayName: u.displayName,
                userPrincipalName: u.userPrincipalName,
                accountEnabled: u.accountEnabled,
                passwordLastSetDateTime: lastSet,
                passwordExpiresInDays: expiresInDays,
                assignedGroups: [] // Group fetching requires separate calls, skipped for "Basic" requirement
            };
        });

        res.json(users);
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Validate Permissions
app.post('/api/validate-permissions', async (req, res) => {
    try {
        const token = await getGraphToken();
        // Try to read users as a test
        await axios.get('https://graph.microsoft.com/v1.0/users?$top=1', {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json({ success: true, message: "Connection Successful. App has User.Read.All permission." });
    } catch (error) {
        res.json({ success: false, message: "Permission Check Failed. Ensure 'User.Read.All' is granted." });
    }
});

// Test SMTP
app.post('/api/test-smtp', async (req, res) => {
    const { host, port, secure, username, password, fromEmail } = runtimeConfig.smtp;
    
    if (!host || !username) return res.status(400).json({ success: false, message: "SMTP config missing" });

    const transporter = nodemailer.createTransport({
        host, port, secure,
        auth: { user: username, pass: password }
    });

    try {
        await transporter.verify();
        res.json({ success: true, message: "SMTP Connection Successful" });
    } catch (error) {
        res.json({ success: false, message: "SMTP Failed: " + error.message });
    }
});

// Run Job (The "Daemon" Logic)
app.post('/api/run-job', async (req, res) => {
    const { profileId, isTestRun, testEmail } = req.body;
    const logs = [];

    logs.push(log('info', `Starting ${isTestRun ? 'TEST' : 'LIVE'} Job`));

    try {
        const token = await getGraphToken();
        
        // 1. Fetch Users
        logs.push(log('info', 'Fetching users from Azure Graph...'));
        const usersResp = await axios.get('https://graph.microsoft.com/v1.0/users?$select=displayName,userPrincipalName,lastPasswordChangeDateTime,accountEnabled', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const users = usersResp.data.value;
        logs.push(log('success', `Fetched ${users.length} users.`));

        // 2. Process (Mock Logic for demo - in real app, match profile ID to cadence)
        let emailsSent = 0;
        
        // Setup Mailer
        const transporter = nodemailer.createTransport({
            host: runtimeConfig.smtp.host,
            port: runtimeConfig.smtp.port,
            secure: runtimeConfig.smtp.secure,
            auth: { user: runtimeConfig.smtp.username, pass: runtimeConfig.smtp.password }
        });

        for (const user of users) {
            // Simplified logic: Send to first 5 users for demo or specific ones
            if (emailsSent < 5 && user.accountEnabled) {
                const recipient = isTestRun ? testEmail : user.userPrincipalName;
                
                // SafeGuard
                if (!recipient) continue;

                logs.push(log('info', `Preparing email for ${user.displayName}...`, { recipient }));
                
                try {
                    await transporter.sendMail({
                        from: runtimeConfig.smtp.fromEmail,
                        to: recipient,
                        subject: "Password Expiry Notice",
                        text: `Hello ${user.displayName}, please change your password.`
                    });
                    logs.push(log('success', `Email sent to ${recipient}`));
                    emailsSent++;
                } catch (e) {
                    logs.push(log('error', `Failed to send to ${recipient}`, e.message));
                }
            }
        }

        res.json({ success: true, logs });

    } catch (e) {
        logs.push(log('error', "Job Failed", e.message));
        res.json({ success: false, logs });
    }
});

// Handle SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Env: ${process.env.NODE_ENV}`);
});