
import { User, GraphApiConfig, SmtpConfig, NotificationProfile, LogEntry, PermissionResult, JobResult } from '../types';

let listeners: ((log: LogEntry) => void)[] = [];

export const log = (level: LogEntry['level'], message: string, details?: any) => {
    const entry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        details
    };
    listeners.forEach(l => l(entry));
};

export const subscribeToLogs = (listener: (log: LogEntry) => void) => {
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
};

export const fetchUsers = async (config: GraphApiConfig): Promise<User[]> => {
  log('info', 'Requesting User list from Backend...');
  try {
    const response = await fetch('/api/users');
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    log('success', `Retrieved ${data.length} users.`);
    return data;
  } catch (error: any) {
    log('error', 'Fetch Users Failed', error.message);
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

export const validateGraphPermissions = async (config: GraphApiConfig): Promise<{ success: boolean; results?: PermissionResult; message: string }> => {
  log('info', 'Validating Permissions on Backend...');
  const response = await fetch('/api/validate-permissions', { method: 'POST' });
  const result = await response.json();
  
  if (result.success) log('success', result.message || 'Permissions OK');
  else log('error', result.message || 'Permission check failed');
  
  return result;
};

export const testSmtpConnection = async (config: SmtpConfig): Promise<{ success: boolean; message: string }> => {
    log('info', 'Testing SMTP...');
    const response = await fetch('/api/test-smtp', { method: 'POST' });
    const result = await response.json();
    
    if (result.success) log('success', result.message);
    else log('error', result.message);
    
    return result;
};

export const runNotificationJob = async (profile: NotificationProfile, mode: 'preview' | 'test' | 'live', currentUserEmail: string = 'admin@local', scheduleTime?: string): Promise<JobResult> => {
    log('info', `Triggering ${mode.toUpperCase()} Job on Server...`);
    
    try {
        const response = await fetch('/api/run-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile, mode, testEmail: currentUserEmail, scheduleTime })
        });
        
        const data: JobResult = await response.json();
        
        if (data.logs && Array.isArray(data.logs)) {
            data.logs.forEach((l: any) => log(l.level, l.message, l.details));
        }
        return data;
    } catch (e: any) {
        log('error', 'Network Error running job', e.message);
        throw e;
    }
};

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
