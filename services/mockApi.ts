
import { User, GraphApiConfig, SmtpConfig, NotificationProfile, LogEntry } from '../types';

// --- LOGGER SERVICE ---
let listeners: ((log: LogEntry) => void)[] = [];

export const log = (level: LogEntry['level'], message: string, details?: any) => {
    const entry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        details
    };
    console.log(`[${level.toUpperCase()}] ${message}`, details || '');
    listeners.forEach(l => l(entry));
};

export const subscribeToLogs = (listener: (log: LogEntry) => void) => {
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
};

// --- MOCK DATA ---
const users: User[] = [
  { id: '1', displayName: 'Alice Johnson', userPrincipalName: 'alice.j@example.com', passwordLastSetDateTime: '2024-07-10T10:00:00Z', passwordExpiresInDays: 5, assignedGroups: ['Developers'] },
  { id: '2', displayName: 'Bob Williams', userPrincipalName: 'bob.w@example.com', passwordLastSetDateTime: '2024-06-25T10:00:00Z', passwordExpiresInDays: 20, assignedGroups: ['Sales'] },
  { id: '3', displayName: 'Charlie Brown', userPrincipalName: 'charlie.b@example.com', passwordLastSetDateTime: '2024-05-15T10:00:00Z', passwordExpiresInDays: 61, assignedGroups: ['All Users'] },
  { id: '4', displayName: 'Diana Prince', userPrincipalName: 'diana.p@example.com', passwordLastSetDateTime: '2024-07-20T10:00:00Z', passwordExpiresInDays: -2, assignedGroups: ['Admins'] }, 
  { id: '5', displayName: 'Ethan Hunt', userPrincipalName: 'ethan.h@example.com', passwordLastSetDateTime: '2024-07-01T10:00:00Z', passwordExpiresInDays: 14, assignedGroups: ['Developers'] },
  { id: '6', displayName: 'Fiona Glenanne', userPrincipalName: 'fiona.g@example.com', passwordLastSetDateTime: '2024-06-10T10:00:00Z', passwordExpiresInDays: 35, assignedGroups: ['Sales'] },
  { id: '7', displayName: 'George Costanza', userPrincipalName: 'george.c@example.com', passwordLastSetDateTime: '2024-07-22T10:00:00Z', passwordExpiresInDays: 1, assignedGroups: ['All Users'] },
];

const mockProfiles: NotificationProfile[] = [
    {
        id: '1',
        name: 'Standard Policy',
        description: 'Notify 14, 7, and 1 day before expiration.',
        emailTemplate: `Hi {{user.displayName}},\nYour password expires in {{password.expiresInDays}} days.`,
        cadence: { daysBefore: [14, 7, 1] },
        recipients: { toUser: true, toManager: false, toAdmins: [] },
        assignedGroups: ['All Users']
    }
];

// --- GRAPH SIMULATION ---

export const fetchUsers = async (config: GraphApiConfig): Promise<User[]> => {
  log('info', 'Initiating Microsoft Graph connection...');
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (config.clientId && config.tenantId && config.clientSecret) {
        log('success', 'Authenticated with Azure AD successfully', { tenantId: config.tenantId });
        log('info', 'Fetching users from /v1.0/users endpoint...');
        log('info', `Retrieved ${users.length} users from Directory.`);
        resolve(users);
      } else {
        log('error', 'Authentication failed: Missing configuration.');
        reject(new Error('Graph API configuration is incomplete.'));
      }
    }, 1200);
  });
};

export const validateGraphPermissions = async (config: GraphApiConfig): Promise<{ success: boolean; message: string }> => {
  log('info', 'Validating App Registration Permissions...');
  log('info', 'Checking Scope: User.Read.All...');
  
  return new Promise(resolve => {
    setTimeout(() => {
      if (config.clientId && config.tenantId && config.clientSecret) {
        log('success', 'Permission Check Passed: User.Read.All is granted.');
        log('success', 'Permission Check Passed: Group.Read.All is granted.');
        resolve({ success: true, message: 'Connection successful. Permissions verified.' });
      } else {
        log('error', 'Permission Check Failed: Invalid Credentials.');
        resolve({ success: false, message: 'Connection failed. Check credentials.' });
      }
    }, 1500);
  });
};

export const testSmtpConnection = async (config: SmtpConfig): Promise<{ success: boolean; message: string }> => {
    log('info', `Testing SMTP connection to ${config.host}:${config.port}...`);
    return new Promise(resolve => {
        setTimeout(() => {
            if (config.host && config.port && config.username && config.password) {
                log('success', 'SMTP handshake successful.');
                resolve({ success: true, message: 'SMTP connection successful.' });
            } else {
                log('error', 'SMTP connection refused or timed out.');
                resolve({ success: false, message: 'SMTP connection failed.' });
            }
        }, 1500);
    });
};

// --- JOB SIMULATION (THE "LOGIC" BEHIND IT) ---

export const runNotificationJob = async (profileId: string, isTestRun: boolean = false, currentUserEmail: string = 'admin@local'): Promise<void> => {
    log('info', `Starting ${isTestRun ? 'TEST' : 'LIVE'} Job for Profile ID: ${profileId}`);
    
    const profile = mockProfiles.find(p => p.id === profileId);
    if (!profile) {
        log('error', 'Profile not found.');
        return;
    }

    log('info', `Loaded Profile: "${profile.name}"`, { groups: profile.assignedGroups, cadence: profile.cadence.daysBefore });

    // 1. Filter Users by Group
    let targetUsers = users;
    if (!profile.assignedGroups.includes('All Users')) {
        targetUsers = users.filter(u => u.assignedGroups?.some(g => profile.assignedGroups.includes(g)));
    }
    log('info', `Found ${targetUsers.length} users matching group criteria.`);

    // 2. Check Expiry
    let emailsSent = 0;
    for (const user of targetUsers) {
        if (profile.cadence.daysBefore.includes(user.passwordExpiresInDays)) {
            // Logic: Needs notification
            const recipient = isTestRun ? currentUserEmail : user.userPrincipalName;
            log('warn', `User ${user.displayName} password expires in ${user.passwordExpiresInDays} days. MATCHES cadence rule.`);
            log('info', `Sending email via SMTP...`, { 
                to: recipient, 
                subject: 'Password Expiry Warning',
                template_rendered: true 
            });
            emailsSent++;
        } else {
            // log('info', `User ${user.displayName} (expires in ${user.passwordExpiresInDays} days) - No notification required.`);
        }
    }

    if (emailsSent === 0) {
        log('info', 'Job complete. No users matched the specific cadence days today.');
    } else {
        log('success', `Job complete. Sent ${emailsSent} emails.`);
    }
};

export const fetchProfiles = async (): Promise<NotificationProfile[]> => {
    return new Promise(resolve => setTimeout(() => resolve(mockProfiles), 500));
}

export const saveProfile = async (profile: NotificationProfile): Promise<NotificationProfile> => {
    log('info', `Saving profile configuration: ${profile.name}`);
    return new Promise(resolve => {
        setTimeout(() => {
            const index = mockProfiles.findIndex(p => p.id === profile.id);
            if (index !== -1) {
                mockProfiles[index] = profile;
            } else {
                mockProfiles.push({ ...profile, id: new Date().toISOString() });
            }
            resolve(profile);
        }, 500);
    });
}

export const deleteProfile = async (profileId: string): Promise<void> => {
    log('info', `Deleting profile ID: ${profileId}`);
    return new Promise(resolve => {
        setTimeout(() => {
            const index = mockProfiles.findIndex(p => p.id === profileId);
            if(index > -1) {
                mockProfiles.splice(index, 1);
            }
            resolve();
        }, 500);
    });
}
