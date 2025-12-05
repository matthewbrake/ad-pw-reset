
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

// --- HELPER: USER CALCULATIONS ---
const calculateExpiry = (user, defaultDays) => {
    const isHybrid = user.onPremisesSyncEnabled === true;
    
    // Use the standard lastPasswordChangeDateTime (which reflects on-prem changes for synced users)
    // Fallback to createdDateTime if password was never changed
    let lastSet = user.lastPasswordChangeDateTime || user.createdDateTime;
    
    if (!lastSet) {
        return { 
            ...user, 
            passwordLastSetDateTime: null, 
            passwordExpiresInDays: 999 
        };
    }

    let expiryDate = new Date(lastSet);
    
    // Check policies
    const policies = user.passwordPolicies || "";
    const policySaysNeverExpires = policies.includes("DisablePasswordExpiration");
    
    // CRITICAL LOGIC: 
    // If user is Hybrid (onPremisesSyncEnabled), Azure usually sets 'DisablePasswordExpiration' 
    // because the cloud doesn't manage the expiry.
    // We must IGNORE this flag for Hybrid users to calculate the true expiry based on the date.
    
    if (policySaysNeverExpires && !isHybrid) {
         // It's a cloud-only user and actually set to never expire
         return { ...user, passwordLastSetDateTime: lastSet, passwordExpiresInDays: 999 };
    }

    // Calculate Expiry
    expiryDate.setDate(expiryDate.getDate() + defaultDays);
    
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    return {
        ...user,
        passwordLastSetDateTime: lastSet,
        passwordExpiresInDays: diffDays
    };
};

// --- HELPER: TEMPLATE REPLACEMENT ---
const processTemplate = (template, user, days) => {
    let output = template;
    output = output.replace(/{{user.displayName}}/g, user.displayName);
    output = output.replace(/{{user.userPrincipalName}}/g, user.userPrincipalName);
    output = output.replace(/{{daysUntilExpiry}}/g, days.toString());
    return output;
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
        
        // SELECT UPDATE: We now fetch onPremisesSyncEnabled
        const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                '$select': 'id,displayName,userPrincipalName,accountEnabled,passwordPolicies,lastPasswordChangeDateTime,createdDateTime,onPremisesSyncEnabled',
                '$top': 999
            }
        });

        const DEFAULT_EXPIRY_DAYS = parseInt(runtimeConfig.defaultExpiryDays) || 90;
        
        const users = response.data.value.map(u => {
            const calculated = calculateExpiry(u, DEFAULT_EXPIRY_DAYS);
            return {
                id: u.id,
                displayName: u.displayName,
                userPrincipalName: u.userPrincipalName,
                accountEnabled: u.accountEnabled,
                passwordLastSetDateTime: calculated.passwordLastSetDateTime,
                onPremisesSyncEnabled: u.onPremisesSyncEnabled,
                passwordExpiresInDays: calculated.passwordExpiresInDays,
                assignedGroups: [] 
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

// Run Job (The Logic Engine)
app.post('/api/run-job', async (req, res) => {
    const { profile, mode, testEmail } = req.body; // mode: 'preview' | 'test' | 'live'
    const logs = [];
    const previewData = [];

    logs.push(log('info', `Starting Job for Profile: "${profile.name}" in ${mode.toUpperCase()} mode`));

    try {
        const token = await getGraphToken();
        const DEFAULT_EXPIRY_DAYS = parseInt(runtimeConfig.defaultExpiryDays) || 90;

        // 1. Identify Target Users based on Assigned Groups
        logs.push(log('info', 'Calculating Target Audience...'));
        let targetUserIds = new Set();
        let targetUsers = [];

        // If 'All Users' is in the list, just fetch everyone
        const isAllUsers = profile.assignedGroups.some(g => g.toLowerCase() === 'all users');

        if (isAllUsers) {
             const allUsersResp = await axios.get('https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,lastPasswordChangeDateTime,createdDateTime,accountEnabled,passwordPolicies,onPremisesSyncEnabled&$top=999', {
                headers: { Authorization: `Bearer ${token}` }
            });
            targetUsers = allUsersResp.data.value;
            logs.push(log('info', `Scope: All Users (${targetUsers.length} found)`));
        } else {
            // Fetch users for specific groups
            // First find group IDs by name
            for (const groupName of profile.assignedGroups) {
                try {
                    const groupSearch = await axios.get(`https://graph.microsoft.com/v1.0/groups?$filter=displayName eq '${groupName}'&$select=id`, {
                         headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    if (groupSearch.data.value.length > 0) {
                        const groupId = groupSearch.data.value[0].id;
                        // Fetch members (transitive)
                        const membersResp = await axios.get(`https://graph.microsoft.com/v1.0/groups/${groupId}/transitiveMembers?$select=id,displayName,userPrincipalName,lastPasswordChangeDateTime,createdDateTime,accountEnabled,passwordPolicies,onPremisesSyncEnabled`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        
                        // Filter only 'user' types (groups can contain other things)
                        const userMembers = membersResp.data.value.filter(m => m['@odata.type'] === '#microsoft.graph.user');
                        logs.push(log('info', `Group '${groupName}' has ${userMembers.length} users`));
                        
                        userMembers.forEach(u => {
                            if (!targetUserIds.has(u.id)) {
                                targetUserIds.add(u.id);
                                targetUsers.push(u);
                            }
                        });
                    } else {
                        logs.push(log('warn', `Group '${groupName}' not found in Azure AD`));
                    }
                } catch (e) {
                    logs.push(log('error', `Error fetching group '${groupName}'`, e.message));
                }
            }
        }

        // 2. Process Users (Calculate Expiry & Check Cadence)
        const triggerDays = new Set(profile.cadence.daysBefore);
        let emailsSent = 0;
        
        // Setup Mailer (only needed if not preview)
        let transporter;
        if (mode !== 'preview') {
            transporter = nodemailer.createTransport({
                host: runtimeConfig.smtp.host,
                port: runtimeConfig.smtp.port,
                secure: runtimeConfig.smtp.secure,
                auth: { user: runtimeConfig.smtp.username, pass: runtimeConfig.smtp.password }
            });
        }

        for (const user of targetUsers) {
            if (!user.accountEnabled) continue;

            const userWithExpiry = calculateExpiry(user, DEFAULT_EXPIRY_DAYS);
            const daysLeft = userWithExpiry.passwordExpiresInDays;

            // CHECK: Is today one of the notification days?
            if (triggerDays.has(daysLeft)) {
                
                // Found a match!
                
                if (mode === 'preview') {
                    previewData.push({
                        user: user.displayName,
                        email: user.userPrincipalName,
                        daysUntilExpiry: daysLeft,
                        group: isAllUsers ? 'All Users' : 'Assigned Group'
                    });
                } else {
                    // Send Email
                    const recipient = mode === 'test' ? testEmail : user.userPrincipalName;
                    
                    if (recipient) {
                        const subject = processTemplate(profile.subjectLine || "Password Expiry Notice", user, daysLeft);
                        const body = processTemplate(profile.emailTemplate, user, daysLeft);

                        logs.push(log('info', `Sending to ${user.displayName} (Expires in ${daysLeft} days)`, { 
                            recipient,
                            mode: mode.toUpperCase() 
                        }));
                        
                        try {
                            await transporter.sendMail({
                                from: runtimeConfig.smtp.fromEmail,
                                to: recipient,
                                subject: subject,
                                text: body
                            });
                            logs.push(log('success', `Email sent.`));
                            emailsSent++;
                        } catch (e) {
                            logs.push(log('error', `Failed to send to ${recipient}`, e.message));
                        }
                    }
                }
            }
        }

        if (mode === 'preview') {
            logs.push(log('success', `Preview Complete. Found ${previewData.length} users who would be emailed.`));
        } else {
            logs.push(log('success', `Job Complete. Sent ${emailsSent} emails.`));
        }

        res.json({ success: true, logs, previewData });

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
