import { User, GraphApiConfig, SmtpConfig, NotificationProfile, LogEntry } from '../types';

// --- LOGGER SERVICE (Client Side View) ---
let listeners: ((log: LogEntry) => void)[] = [];

export const log = (level: LogEntry['level'], message: string, details?: any) => {
    const entry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        details
    };
    // Emit to listeners (ConsoleLog component)
    listeners.forEach(l => l(entry));
};

export const subscribeToLogs = (listener: (log: LogEntry) => void) => {
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
};

// --- API CLIENT ---

export const fetchUsers = async (config: GraphApiConfig): Promise<User[]> => {
  log('info', 'Requesting User list from Backend...');
  try {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Failed to fetch users from backend');
    const data = await response.json();
    log('success', `Retrieved ${data.length} users.`);
    return data;
  } catch (error) {
    log('error', 'Fetch Users Failed', error);
    throw error;
  }
};

export const saveBackendConfig = async (config: GraphApiConfig, smtp: SmtpConfig) => {
    log('info', 'Saving configuration to server...');
    const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, smtp })
    });
    return response.json();
};

export const validateGraphPermissions = async (config: GraphApiConfig): Promise<{ success: boolean; message: string }> => {
  // First save config so backend can use it
  await saveBackendConfig(config, { host: '', port: 0, secure: false, username: '', password: '', fromEmail: '' });
  
  log('info', 'Validating Permissions on Backend...');
  const response = await fetch('/api/validate-permissions', { method: 'POST' });
  const result = await response.json();
  
  if (result.success) log('success', result.message);
  else log('error', result.message);
  
  return result;
};

export const testSmtpConnection = async (config: SmtpConfig): Promise<{ success: boolean; message: string }> => {
    // Save first
    await saveBackendConfig({ tenantId: '', clientId: '', clientSecret: '' }, config);

    log('info', 'Testing SMTP...');
    const response = await fetch('/api/test-smtp', { method: 'POST' });
    const result = await response.json();
    
    if (result.success) log('success', result.message);
    else log('error', result.message);
    
    return result;
};

export const runNotificationJob = async (profileId: string, isTestRun: boolean = false, currentUserEmail: string = 'admin@local'): Promise<void> => {
    log('info', `Triggering ${isTestRun ? 'TEST' : 'LIVE'} Job on Server...`);
    
    const response = await fetch('/api/run-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, isTestRun, testEmail: currentUserEmail })
    });
    
    const data = await response.json();
    
    // Ingest server logs into client console
    if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((l: any) => log(l.level, l.message, l.details));
    }
};

// --- CLIENT SIDE PROFILE MOCK (Keep profiles in local storage for now as requested for simplicity, or could move to backend) ---
// For this iteration, we keep profiles in local storage but the JOB runs on server.
// The server would normally fetch these from DB.
// To keep the change minimal as requested: We will assume the server "Mock" runs based on the user list it sees.

// Helper to keep Profiles working in UI
const MOCK_PROFILES_KEY = 'notification_profiles';
const getProfiles = (): NotificationProfile[] => {
    const s = localStorage.getItem(MOCK_PROFILES_KEY);
    return s ? JSON.parse(s) : [];
}

export const fetchProfiles = async (): Promise<NotificationProfile[]> => {
    return new Promise(resolve => setTimeout(() => resolve(getProfiles()), 200));
}

export const saveProfile = async (profile: NotificationProfile): Promise<NotificationProfile> => {
    const profiles = getProfiles();
    const index = profiles.findIndex(p => p.id === profile.id);
    if (index !== -1) profiles[index] = profile;
    else profiles.push({ ...profile, id: Date.now().toString() });
    
    localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(profiles));
    return profile;
}

export const deleteProfile = async (profileId: string): Promise<void> => {
    let profiles = getProfiles();
    profiles = profiles.filter(p => p.id !== profileId);
    localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(profiles));
}