export interface Integration {
  id: string;
  name: string;
  type: 'slack' | 'servicenow';
  status: 'active' | 'inactive' | 'error' | 'pending';
  organizationId: string;
  config: IntegrationConfig;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationConfig {
  // Slack specific config
  slackTeamId?: string;
  slackChannelId?: string;
  slackBotToken?: string;
  
  // ServiceNow specific config
  serviceNowInstanceUrl?: string;
  serviceNowUsername?: string;
  serviceNowApiVersion?: string;
  
  // Common config
  syncEnabled: boolean;
  notificationsEnabled: boolean;
  autoCreateIncidents: boolean;
}

export interface Incident {
  id: string;
  number: string;
  title: string;
  description: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  assignedGroup?: string;
  createdBy: string;
  organizationId: string;
  slackThreadId?: string;
  serviceNowSysId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  id: string;
  integrationId: string;
  type: 'incident_sync' | 'status_update' | 'comment_sync';
  status: 'success' | 'error' | 'pending';
  sourceSystem: 'slack' | 'servicenow';
  targetSystem: 'slack' | 'servicenow';
  recordId: string;
  message?: string;
  error?: string;
  duration: number;
  createdAt: string;
}

export interface UserMapping {
  id: string;
  organizationId: string;
  slackUserId: string;
  slackUsername: string;
  serviceNowUserId: string;
  serviceNowUsername: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}