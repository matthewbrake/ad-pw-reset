
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

// --- ENTERPRISE DIRECTORY STRUCTURE ---
const DATA_ROOT = path.join(__dirname, 'data');
const CONFIG_DIR = path.join(DATA_ROOT, 'config');
const LOGS_DIR = path.join(DATA_ROOT, 'logs');
const EXPORTS_DIR = path.join(DATA_ROOT, 'exports');

[DATA_ROOT, CONFIG_DIR, LOGS_DIR, EXPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const CONFIG_FILE = path.join(CONFIG_DIR, 'app-settings.json');
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');
const QUEUE_FILE = path.join(CONFIG_DIR, 'queue.json');
const PROFILES_FILE = path.join(CONFIG_DIR, 'notification-profiles.json');
const SERVER_LOG_FILE = path.join(LOGS_DIR, 'server.log');

// --- SAFE FILE HANDLING ---
const initFile = (filePath, content) => {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf-8').trim() === "") {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    }
};

const readJsonSafe = (filePath, defaultValue = []) => {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        if (!content) return defaultValue;
        return JSON.parse(content);
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e.message);
        return defaultValue;
    }
};

initFile(HISTORY_FILE, []);
initFile(QUEUE_FILE, []);
initFile(PROFILES_FILE, []);

// --- ADVANCED LOGGING ---
const fileLog = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const logLine = `[${timestamp}] [MEM:${mem}MB] [${level.toUpperCase()}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    
    console.log(logLine.trim());
    try {
        fs.appendFileSync(SERVER_LOG_FILE, logLine);
    } catch (e) {
        console.error("Critical: Logger failed", e);
    }
    return { timestamp, level, message, details: data };
};

// --- DUAL-SOURCE CONFIGURATION ---
let runtimeConfig = {
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    defaultExpiryDays: parseInt(process.env.DEFAULT_EXPIRY_DAYS) || 90,
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE !== 'false',
        username: process.env.SMTP_USERNAME || '',
        password: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.SMTP_FROM || ''
    }
};

const syncConfig = () => {
    const saved = readJsonSafe(CONFIG_FILE, null);
    if (saved) {
        runtimeConfig = { 
            ...runtimeConfig, 
            ...saved, 
            smtp: { ...runtimeConfig.smtp, ...(saved.smtp || {}) } 
        };
    }
    return runtimeConfig;
};

syncConfig();

// --- API ROUTES ---

app.get('/api/config', (req, res) => {
    const config = syncConfig();
    const masked = JSON.parse(JSON.stringify(config));
    if (masked.clientSecret) masked.clientSecret = '********';
    if (masked.smtp.password) masked.smtp.password = '********';
    res.json({
        ...masked,
        _envStatus: {
            tenantId: !!process.env.AZURE_TENANT_ID,
            clientId: !!process.env.AZURE_CLIENT_ID,
            smtp: !!process.env.SMTP_HOST
        }
    });
});

app.post('/api/config', (req, res) => {
    try {
        const update = req.body;
        const current = syncConfig();
        
        if (update.clientSecret === '********') update.clientSecret = current.clientSecret;
        if (update.smtp?.password === '********') update.smtp.password = current.smtp.password;

        const merged = { ...current, ...update, smtp: { ...current.smtp, ...update.smtp } };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
        fileLog('info', 'Enterprise Configuration updated.');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/profiles', (req, res) => {
    res.json(readJsonSafe(PROFILES_FILE, []));
});

app.post('/api/profiles', (req, res) => {
    try {
        const profiles = req.body;
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const config = syncConfig();
        if (!config.clientId) throw new Error("App not configured.");

        const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
        const auth = await axios.post(tokenEndpoint, new URLSearchParams({
            client_id: config.clientId,
            scope: 'https://graph.microsoft.com/.default',
            client_secret: config.clientSecret,
            grant_type: 'client_credentials'
        }));

        const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
            headers: { Authorization: `Bearer ${auth.data.access_token}` },
            params: { '$select': 'id,displayName,userPrincipalName,accountEnabled,passwordPolicies,lastPasswordChangeDateTime,createdDateTime,onPremisesSyncEnabled', '$top': 999 }
        });

        const users = response.data.value.map(u => {
            const isHybrid = u.onPremisesSyncEnabled === true;
            const policies = u.passwordPolicies || "";
            const neverExpiresFlag = policies.includes("DisablePasswordExpiration");
            
            let lastSet = u.lastPasswordChangeDateTime || u.createdDateTime;
            if (!lastSet) return { ...u, passwordExpiresInDays: 999, neverExpires: true, passwordLastSetDateTime: null, passwordExpiryDate: null };

            let expiryDate = new Date(lastSet);
            // v2.2.0 Hybrid Logic: Hybrid users follow default expiry even if flag says never
            const effectiveNeverExpires = neverExpiresFlag && !isHybrid;

            if (effectiveNeverExpires) {
                 return { ...u, passwordLastSetDateTime: lastSet, passwordExpiresInDays: 999, neverExpires: true, passwordExpiryDate: null };
            }

            expiryDate.setDate(expiryDate.getDate() + (config.defaultExpiryDays || 90));
            const diffDays = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)); 

            return {
                ...u,
                passwordLastSetDateTime: lastSet,
                passwordExpiresInDays: diffDays,
                passwordExpiryDate: expiryDate.toISOString(),
                neverExpires: false
            };
        });
        res.json(users);
    } catch (e) {
        fileLog('error', 'Graph API Fetch Failed', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/queue', (req, res) => res.json(readJsonSafe(QUEUE_FILE, [])));
app.get('/api/history', (req, res) => res.json(readJsonSafe(HISTORY_FILE, []).reverse()));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => fileLog('info', `AD NOTIFIER ENTERPRISE STARTED. Data root: ${DATA_ROOT}`));
