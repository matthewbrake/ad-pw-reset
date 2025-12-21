
export interface User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled?: boolean; 
  passwordLastSetDateTime: string;
  onPremisesSyncEnabled?: boolean;
  passwordExpiresInDays: number;
  passwordExpiryDate: string | null; 
  neverExpires: boolean; // NEW: Track the DisablePasswordExpiration policy explicitly
  assignedGroups?: string[];
}

export interface GraphApiConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  defaultExpiryDays?: number;
  _envStatus?: {
      tenantId: boolean;
      clientId: boolean;
      smtp: boolean;
  };
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

export interface NotificationProfile {
    id: string;
    name: string;
    description: string;
    emailTemplate: string;
    subjectLine: string;
    preferredTime?: string; 
    cadence: {
        daysBefore: number[];
    };
    recipients: {
        toUser: boolean;
        toManager: boolean;
        toAdmins: string[];
        readReceipt: boolean;
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
