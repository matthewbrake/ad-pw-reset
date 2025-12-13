
export interface User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled?: boolean; 
  passwordLastSetDateTime: string;
  onPremisesSyncEnabled?: boolean;
  passwordExpiresInDays: number;
  passwordExpiryDate: string; 
  assignedGroups?: string[];
}

export interface GraphApiConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  defaultExpiryDays?: number;
}

export interface PermissionResult {
    auth: boolean;
    userRead: boolean;
    groupRead: boolean;
    message: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
}

export enum Cadence {
    DAILY = 'Daily',
    WEEKLY = 'Weekly',
    MONTHLY = 'Monthly'
}

export interface NotificationProfile {
    id: string;
    name: string;
    description: string;
    emailTemplate: string;
    subjectLine: string;
    preferredTime?: string; // Format: "HH:mm" (24h)
    cadence: {
        daysBefore: number[];
    };
    recipients: {
        toUser: boolean;
        toManager: boolean;
        toAdmins: string[];
        readReceipt: boolean; // New field
    };
    assignedGroups: string[];
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'skip' | 'queue';
  message: string;
  details?: any;
}

export interface JobResult {
    success: boolean;
    logs: LogEntry[];
    previewData?: {
        user: string;
        email: string;
        daysUntilExpiry: number;
        expiryDate: string;
        group: string;
    }[];
}

export interface QueueItem {
    id: string;
    scheduledFor: string; // ISO Date
    recipient: string;
    subject: string;
    body: string;
    profileName: string;
    status: 'pending' | 'sending' | 'failed';
    retries: number;
    readReceipt?: boolean;
}

export interface HistoryEntry {
    date: string;
    email: string;
    profileId: string;
    status: 'sent' | 'skipped';
    timestamp?: string;
}
