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
    defaultExpiryDays: 90,
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
        // Merge to keep defaults if keys missing
        runtimeConfig = { ...runtimeConfig, ...saved, smtp: { ...runtimeConfig.smtp, ...saved.smtp } };
        console.log("Loaded configuration from disk.");
    } catch (e) {
        console.error("Failed to load config file:", e);
    }
}

// --- HELPER: LOGGING ---
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
        // Determine if it's an auth error or network error
        if (error.response) {
            throw new Error(`Auth Failed: ${error.response.data.error_description || error.response.statusText}`);
        }
        throw new Error("Network failed connecting to Azure Login.");
    }
};

// --- API ROUTES ---

// Save Config
app.post('/api/config', (req, res) => {
    const { tenantId, clientId, clientSecret, smtp, defaultExpiryDays } = req.body;
    runtimeConfig = { ...runtimeConfig, tenantId, clientId, clientSecret, defaultExpiryDays, smtp };
    
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

        const DEFAULT_EXPIRY_DAYS = parseInt(runtimeConfig.defaultExpiryDays) || 90;
        
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
                assignedGroups: [] 
            };
        });

        res.json(users);
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Validate Permissions (The Traffic Light System)
app.post('/api/validate-permissions', async (req, res) => {
    const results = {
        auth: false,
        userRead: false,
        groupRead: false,
        message: ''
    };

    let token = '';

    // 1. Check Auth (Get Token)
    try {
        token = await getGraphToken();
        results.auth = true;
    } catch (e) {
        results.message = "Authentication Failed: " + e.message;
        return res.json({ success: false, results });
    }

    // 2. Check User Read
    try {
        await axios.get('https://graph.microsoft.com/v1.0/users?$top=1', {
            headers: { Authorization: `Bearer ${token}` }
        });
        results.userRead = true;
    } catch (e) {
        // User read failed
    }

    // 3. Check Group Read
    try {
        await axios.get('https://graph.microsoft.com/v1.0/groups?$top=1', {
            headers: { Authorization: `Bearer ${token}` }
        });
        results.groupRead = true;
    } catch (e) {
        // Group read failed
    }

    const allGood = results.auth && results.userRead && results.groupRead;
    results.message = allGood ? "All Systems Go" : "Some permissions are missing.";
    
    res.json({ success: allGood, results });
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
            // SAFEGUARD: Only process enabled accounts
            if (!user.accountEnabled) continue;

            // Simplified selection logic for demo
            if (emailsSent < 5) {
                // SAFEGUARD: Override email if test run
                const recipient = isTestRun ? testEmail : user.userPrincipalName;
                
                if (!recipient) continue;

                logs.push(log('info', `Processing ${user.displayName}...`, { 
                    realEmail: user.userPrincipalName, 
                    targetEmail: recipient,
                    mode: isTestRun ? 'TEST' : 'LIVE'
                }));
                
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
    console.log(`=========================================`);
    console.log(` SERVER RUNNING on PORT: ${PORT}`);
    console.log(` Local: http://localhost:${PORT}`);
    console.log(`=========================================`);
});