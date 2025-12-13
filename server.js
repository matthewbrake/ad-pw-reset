
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import nodemailer from 'nodemailer';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- PERSISTENCE ---
const CONFIG_DIR = path.join(__dirname, 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'app-settings.json');
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');
const QUEUE_FILE = path.join(CONFIG_DIR, 'queue.json');

if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR);
}

// Initialize files if not exists
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
if (!fs.existsSync(QUEUE_FILE)) fs.writeFileSync(QUEUE_FILE, JSON.stringify([]));

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

if (fs.existsSync(CONFIG_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        runtimeConfig = { ...runtimeConfig, ...saved, smtp: { ...runtimeConfig.smtp, ...saved.smtp } };
        console.log("Loaded configuration from disk.");
    } catch (e) {
        console.error("Failed to load config file:", e);
    }
}

// --- LOGGING ---
const log = (level, message, details = null) => {
    const timestamp = new Date().toISOString();
    // Print to Docker Logs / Stdout
    if (level === 'error') {
        console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`, details ? JSON.stringify(details) : '');
    } else {
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, details ? JSON.stringify(details) : '');
    }
    return { timestamp, level, message, details };
};

// --- QUEUE & WORKER LOGIC ---

const getQueue = () => {
    try {
        return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
    } catch { return []; }
};

const saveQueue = (queue) => {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
};

const addToQueue = (item) => {
    const queue = getQueue();
    queue.push(item);
    saveQueue(queue);
    return item;
};

// BACKGROUND WORKER (Runs every 60 seconds)
setInterval(async () => {
    const queue = getQueue();
    const now = new Date();
    const MAX_RETRIES = 3;

    // Find items where scheduledFor is past or present, and status is pending
    const pending = queue.filter(item => {
        if (item.status === 'failed' || item.status === 'sending') return false; // Skip already processing or dead items
        
        const scheduledTime = new Date(item.scheduledFor);
        if (isNaN(scheduledTime.getTime())) {
            log('warn', `[WORKER] Skipping invalid date for item ${item.id}`, item);
            item.status = 'failed'; // Mark as failed so we don't loop
            return false;
        }
        return scheduledTime <= now;
    });

    if (pending.length === 0) return;

    log('info', `[WORKER] Processing ${pending.length} due emails...`);

    const transporter = nodemailer.createTransport({
        host: runtimeConfig.smtp.host,
        port: runtimeConfig.smtp.port,
        secure: runtimeConfig.smtp.secure,
        auth: { user: runtimeConfig.smtp.username, pass: runtimeConfig.smtp.password },
        // Connection pooling for better performance
        pool: true,
        maxConnections: 5
    });

    // Process one by one
    for (const item of pending) {
        try {
            if ((item.retries || 0) >= MAX_RETRIES) {
                log('error', `[WORKER] Max retries reached for ${item.recipient}. Marking as failed.`);
                item.status = 'failed';
                continue;
            }

            // Update status to sending
            item.status = 'sending';
            saveQueue(queue); 

            const mailOptions = {
                from: runtimeConfig.smtp.fromEmail,
                to: item.recipient,
                cc: item.ccList || [], // Add CCs (Managers/Admins)
                subject: item.subject,
                text: item.body,
                headers: {}
            };

            // Read Receipt Header
            if (item.readReceipt) {
                mailOptions.headers['Disposition-Notification-To'] = runtimeConfig.smtp.fromEmail;
            }

            await transporter.sendMail(mailOptions);

            // Remove from queue on success
            const index = queue.findIndex(i => i.id === item.id);
            if (index > -1) queue.splice(index, 1);
            log('success', `[WORKER] Sent email to ${item.recipient}`);
        } catch (e) {
            log('error', `[WORKER] Failed to send to ${item.recipient}`, e.message);
            item.status = 'pending'; // Reset to pending to retry
            item.retries = (item.retries || 0) + 1;
        }
    }
    saveQueue(queue);

}, 60000); 


// --- HELPERS ---
const checkAndLogHistory = (userEmail, profileId, write = false) => {
    try {
        const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        const today = new Date().toISOString().split('T')[0]; 
        
        // Use a more inclusive history check, but primarily today for rate limiting
        const alreadySent = history.some(h => 
            h.date === today && 
            h.email === userEmail && 
            h.profileId === profileId &&
            h.status === 'sent'
        );

        if (alreadySent && !write) return true;

        if (write) {
            // Prune old history > 60 days
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            
            const cleanHistory = history.filter(h => new Date(h.date) > sixtyDaysAgo);
            
            cleanHistory.push({ 
                date: today, 
                timestamp: new Date().toISOString(),
                email: userEmail, 
                profileId, 
                status: 'sent' 
            });
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(cleanHistory, null, 2));
        }
        
        return alreadySent;
    } catch (e) {
        console.error("Audit log error", e);
        return false;
    }
};

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
        if (error.response) {
            throw new Error(`Auth Failed: ${error.response.data.error_description || error.response.statusText}`);
        }
        throw new Error("Network failed connecting to Azure Login.");
    }
};

const calculateExpiry = (user, defaultDays) => {
    const isHybrid = user.onPremisesSyncEnabled === true;
    let lastSet = user.lastPasswordChangeDateTime || user.createdDateTime;
    
    if (!lastSet) {
        return { 
            ...user, 
            passwordLastSetDateTime: null, 
            passwordExpiresInDays: 999,
            passwordExpiryDate: null
        };
    }

    let expiryDate = new Date(lastSet);
    const policies = user.passwordPolicies || "";
    const policySaysNeverExpires = policies.includes("DisablePasswordExpiration");
    
    if (policySaysNeverExpires && !isHybrid) {
         return { 
             ...user, 
             passwordLastSetDateTime: lastSet, 
             passwordExpiresInDays: 999,
             passwordExpiryDate: null
         };
    }

    expiryDate.setDate(expiryDate.getDate() + defaultDays);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    return {
        ...user,
        passwordLastSetDateTime: lastSet,
        passwordExpiresInDays: diffDays,
        passwordExpiryDate: expiryDate.toISOString() 
    };
};

const processTemplate = (template, user, days, expiryDateStr) => {
    let output = template;
    const dateReadable = expiryDateStr ? new Date(expiryDateStr).toLocaleDateString() : 'Never';
    output = output.replace(/{{user.displayName}}/g, user.displayName);
    output = output.replace(/{{user.userPrincipalName}}/g, user.userPrincipalName);
    output = output.replace(/{{daysUntilExpiry}}/g, days.toString());
    output = output.replace(/{{expiryDate}}/g, dateReadable);
    return output;
};

// --- API ROUTES ---

app.post('/api/config', (req, res) => {
    const { tenantId, clientId, clientSecret, smtp, defaultExpiryDays } = req.body;
    runtimeConfig = { ...runtimeConfig, tenantId, clientId, clientSecret, defaultExpiryDays, smtp };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(runtimeConfig, null, 2));
    log('info', 'Configuration updated by user.');
    res.json({ success: true, message: "Configuration saved." });
});

app.get('/api/config', (req, res) => {
    const masked = { ...runtimeConfig };
    masked.clientSecret = masked.clientSecret ? '********' : '';
    masked.smtp.password = masked.smtp.password ? '********' : '';
    res.json(masked);
});

// HISTORY / AUDIT LOGS
app.get('/api/history', (req, res) => {
    try {
        const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        // Return latest first
        res.json(history.reverse());
    } catch (e) {
        res.json([]);
    }
});

// QUEUE API
app.get('/api/queue', (req, res) => {
    res.json(getQueue());
});

app.delete('/api/queue/:id', (req, res) => {
    let queue = getQueue();
    queue = queue.filter(i => i.id !== req.params.id);
    saveQueue(queue);
    res.json({ success: true });
});

app.post('/api/queue/clear', (req, res) => {
    saveQueue([]);
    res.json({ success: true });
});

// VERIFY GROUP
app.post('/api/verify-group', async (req, res) => {
    const { groupName } = req.body;
    try {
        const token = await getGraphToken();
        const groupSearch = await axios.get(`https://graph.microsoft.com/v1.0/groups?$filter=displayName eq '${groupName}'&$select=id,displayName`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (groupSearch.data.value.length === 0) {
            return res.json({ success: false, message: 'Group not found.' });
        }

        const group = groupSearch.data.value[0];
        // Get Count
        const countResp = await axios.get(`https://graph.microsoft.com/v1.0/groups/${group.id}/transitiveMembers/$count`, {
            headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' }
        });
        // Get First 5 Members for preview
        const membersResp = await axios.get(`https://graph.microsoft.com/v1.0/groups/${group.id}/transitiveMembers?$select=displayName,userPrincipalName&$top=5`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        res.json({ 
            success: true, 
            count: countResp.data, 
            id: group.id, 
            message: `Group exists with ${countResp.data} members.`,
            sampleMembers: membersResp.data.value
        });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const token = await getGraphToken();
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
                passwordExpiryDate: calculated.passwordExpiryDate,
                assignedGroups: [] 
            };
        });

        res.json(users);
    } catch (error) {
        log('error', "Fetch Users Failed", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/send-test-template', async (req, res) => {
    const { template, subject, toEmail } = req.body;
    const { host, port, secure, username, password, fromEmail } = runtimeConfig.smtp;
    const dummyUser = { displayName: "Test User", userPrincipalName: "test.user@company.com" };
    const dummyDays = 14;
    const dummyDate = new Date();
    dummyDate.setDate(dummyDate.getDate() + 14);

    const body = processTemplate(template, dummyUser, dummyDays, dummyDate.toISOString());
    const sub = processTemplate(subject, dummyUser, dummyDays, dummyDate.toISOString());

    try {
        const transporter = nodemailer.createTransport({
            host, port, secure,
            auth: { user: username, pass: password }
        });

        await transporter.sendMail({ from: fromEmail, to: toEmail, subject: "[TEST] " + sub, text: body });
        res.json({ success: true, message: `Test email sent to ${toEmail}` });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/validate-permissions', async (req, res) => {
    const results = { auth: false, userRead: false, groupRead: false, message: '' };
    try {
        const token = await getGraphToken();
        results.auth = true;
        await axios.get('https://graph.microsoft.com/v1.0/users?$top=1', { headers: { Authorization: `Bearer ${token}` } });
        results.userRead = true;
        await axios.get('https://graph.microsoft.com/v1.0/groups?$top=1', { headers: { Authorization: `Bearer ${token}` } });
        results.groupRead = true;
    } catch (e) {
        results.message = e.message;
        return res.json({ success: false, results });
    }
    const allGood = results.auth && results.userRead && results.groupRead;
    results.message = allGood ? "All Systems Go" : "Some permissions are missing.";
    res.json({ success: allGood, results });
});

app.post('/api/test-smtp', async (req, res) => {
    const { host, port, secure, username, password } = runtimeConfig.smtp;
    if (!host) return res.status(400).json({ success: false, message: "SMTP config missing" });

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

app.post('/api/run-job', async (req, res) => {
    const { profile, mode, testEmail, scheduleTime } = req.body; 
    const logs = [];
    const previewData = [];

    logs.push(log('info', `Starting Job: "${profile.name}" [${mode.toUpperCase()}]`));

    try {
        const token = await getGraphToken();
        const DEFAULT_EXPIRY_DAYS = parseInt(runtimeConfig.defaultExpiryDays) || 90;

        logs.push(log('info', 'Fetching users and groups...'));
        let targetUserIds = new Set();
        let targetUsers = [];

        const isAllUsers = profile.assignedGroups.some(g => g.toLowerCase() === 'all users');

        if (isAllUsers) {
             const allUsersResp = await axios.get('https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,lastPasswordChangeDateTime,createdDateTime,accountEnabled,passwordPolicies,onPremisesSyncEnabled&$top=999', {
                headers: { Authorization: `Bearer ${token}` }
            });
            targetUsers = allUsersResp.data.value;
            logs.push(log('info', `Scope: All Users (${targetUsers.length} found)`));
        } else {
            for (const groupName of profile.assignedGroups) {
                try {
                    const groupSearch = await axios.get(`https://graph.microsoft.com/v1.0/groups?$filter=displayName eq '${groupName}'&$select=id`, {
                         headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    if (groupSearch.data.value.length > 0) {
                        const groupId = groupSearch.data.value[0].id;
                        const membersResp = await axios.get(`https://graph.microsoft.com/v1.0/groups/${groupId}/transitiveMembers?$select=id,displayName,userPrincipalName,lastPasswordChangeDateTime,createdDateTime,accountEnabled,passwordPolicies,onPremisesSyncEnabled`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        
                        const userMembers = membersResp.data.value.filter(m => m['@odata.type'] === '#microsoft.graph.user');
                        logs.push(log('info', `Group '${groupName}': ${userMembers.length} users`));
                        
                        userMembers.forEach(u => {
                            if (!targetUserIds.has(u.id)) {
                                targetUserIds.add(u.id);
                                targetUsers.push(u);
                            }
                        });
                    } else {
                        logs.push(log('warn', `Group '${groupName}' not found.`));
                    }
                } catch (e) {
                    logs.push(log('error', `Error accessing group '${groupName}'`));
                }
            }
        }

        const triggerDays = new Set(profile.cadence.daysBefore);
        let emailsSent = 0;
        let queued = 0;
        let skipped = 0;
        
        // CALCULATION FOR PREFERRED TIME
        let finalScheduleTime = scheduleTime; // From manual picker
        
        // If not manually scheduled, but profile has a preferred time (e.g. "09:00")
        if (!finalScheduleTime && profile.preferredTime && mode === 'live') {
            const [hours, minutes] = profile.preferredTime.split(':').map(Number);
            const now = new Date();
            const preferredDate = new Date();
            preferredDate.setHours(hours, minutes, 0, 0);

            // If time passed today, schedule for tomorrow
            if (preferredDate < now) {
                preferredDate.setDate(preferredDate.getDate() + 1);
            }
            finalScheduleTime = preferredDate.toISOString();
            logs.push(log('info', `Profile has preferred time ${profile.preferredTime}. Calculated next run: ${finalScheduleTime}`));
        }

        let transporter;
        // If live/test and sending immediately
        if (mode !== 'preview' && !finalScheduleTime) {
            transporter = nodemailer.createTransport({
                host: runtimeConfig.smtp.host,
                port: runtimeConfig.smtp.port,
                secure: runtimeConfig.smtp.secure,
                auth: { user: runtimeConfig.smtp.username, pass: runtimeConfig.smtp.password },
                pool: true
            });
        }

        for (const user of targetUsers) {
            // Check Account Enabled Status for safety
            if (!user.accountEnabled) {
                // logs.push(log('info', `Skipping disabled user: ${user.userPrincipalName}`));
                continue;
            }

            const userWithExpiry = calculateExpiry(user, DEFAULT_EXPIRY_DAYS);
            const daysLeft = userWithExpiry.passwordExpiresInDays;

            if (triggerDays.has(daysLeft)) {
                
                if (mode === 'preview') {
                    previewData.push({
                        user: user.displayName,
                        email: user.userPrincipalName,
                        daysUntilExpiry: daysLeft,
                        expiryDate: userWithExpiry.passwordExpiryDate,
                        group: isAllUsers ? 'All Users' : 'Assigned Group'
                    });
                } else {
                    const recipient = mode === 'test' ? testEmail : user.userPrincipalName;
                    
                    if (mode === 'live' && !checkAndLogHistory(user.userPrincipalName, profile.id, false)) {
                         // proceed
                    } else if (mode === 'live' && checkAndLogHistory(user.userPrincipalName, profile.id, false)) {
                         logs.push(log('skip', `Skipping ${user.userPrincipalName}: Already sent/queued today.`));
                         skipped++;
                         continue;
                    }

                    if (recipient) {
                        const subject = processTemplate(profile.subjectLine || "Password Expiry Notice", user, daysLeft, userWithExpiry.passwordExpiryDate);
                        const body = processTemplate(profile.emailTemplate, user, daysLeft, userWithExpiry.passwordExpiryDate);

                        // CC List Construction (Admins + Manager)
                        let ccList = [...(profile.recipients.toAdmins || [])];
                        
                        // Fetch Manager if needed (ONLY IN LIVE OR TEST)
                        if (profile.recipients.toManager && mode !== 'preview') {
                            try {
                                const mgrResp = await axios.get(`https://graph.microsoft.com/v1.0/users/${user.id}/manager?$select=mail,userPrincipalName`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                const mgrEmail = mgrResp.data.mail || mgrResp.data.userPrincipalName;
                                if (mgrEmail) {
                                    ccList.push(mgrEmail);
                                    logs.push(log('info', `Found Manager for ${user.displayName}: ${mgrEmail}`));
                                }
                            } catch (err) {
                                logs.push(log('warn', `Could not fetch manager for ${user.displayName}.`));
                            }
                        }

                        if (finalScheduleTime) {
                             // --- QUEUE IT ---
                             addToQueue({
                                 id: crypto.randomUUID(),
                                 scheduledFor: finalScheduleTime,
                                 recipient,
                                 ccList, // Add CCs to queue
                                 subject,
                                 body,
                                 profileName: profile.name,
                                 status: 'pending',
                                 retries: 0,
                                 readReceipt: profile.recipients?.readReceipt
                             });
                             // Mark as "Handled" in Audit Log so we don't queue again today
                             if (mode === 'live') checkAndLogHistory(user.userPrincipalName, profile.id, true);
                             
                             // Only log queueing once per batch to avoid flooding
                             if (queued % 50 === 0) logs.push(log('queue', `Queuing batch... (Next: ${new Date(finalScheduleTime).toLocaleTimeString()})`));
                             queued++;

                        } else {
                            // --- SEND NOW ---
                            logs.push(log('info', `Sending to ${user.displayName}`, { recipient }));
                            try {
                                const mailOptions = {
                                    from: runtimeConfig.smtp.fromEmail,
                                    to: recipient,
                                    cc: ccList,
                                    subject: subject,
                                    text: body,
                                    headers: {}
                                };
                                if(profile.recipients?.readReceipt) {
                                    mailOptions.headers['Disposition-Notification-To'] = runtimeConfig.smtp.fromEmail;
                                }

                                await transporter.sendMail(mailOptions);
                                if (mode === 'live') checkAndLogHistory(user.userPrincipalName, profile.id, true);
                                logs.push(log('success', `Email sent.`));
                                emailsSent++;
                            } catch (e) {
                                logs.push(log('error', `Failed to send to ${recipient}`, e.message));
                            }
                        }
                    }
                }
            }
        }

        if (mode === 'preview') {
            logs.push(log('success', `Preview Found: ${previewData.length} users.`));
        } else {
            logs.push(log('success', `Run Complete. Sent: ${emailsSent}, Queued: ${queued}, Skipped: ${skipped}`));
        }

        res.json({ success: true, logs, previewData });

    } catch (e) {
        logs.push(log('error', "Job Failed", e.message));
        res.json({ success: false, logs });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SERVER RUNNING on PORT: ${PORT}`);
    console.log(`=========================================`);
});
