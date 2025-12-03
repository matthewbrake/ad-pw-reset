export interface User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled?: boolean; // Added
  passwordLastSetDateTime: string;
  passwordExpiresInDays: number;
  assignedGroups?: string[];
}

export interface GraphApiConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
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
    cadence: {
        daysBefore: number[];
    };
    recipients: {
        toUser: boolean;
        toManager: boolean;
        toAdmins: string[];
    };
    assignedGroups: string[];
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
}