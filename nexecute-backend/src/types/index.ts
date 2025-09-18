// Environment Configuration
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  
  // ServiceNow Configuration
  SERVICENOW_INSTANCE_URL: string;
  SERVICENOW_CLIENT_ID: string;
  SERVICENOW_CLIENT_SECRET: string;
  
  // Slack Configuration
  SLACK_APP_ID: string;
  SLACK_CLIENT_ID: string;
  SLACK_CLIENT_SECRET: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_VERIFICATION_TOKEN: string;
  
  // Security
  ENCRYPTION_KEY: string;
  JWT_SECRET: string;
  SESSION_SECRET: string;
  
  // Database
  DATABASE_URL?: string;
  REDIS_URL?: string;
  
  // Application
  FRONTEND_URL?: string;
  SERVICENOW_RATE_LIMIT: number;
  SLACK_RATE_LIMIT: number;
  COOKIE_MAX_AGE: number;
}

// ServiceNow Types
export interface ServiceNowCredentials {
  instanceUrl: string;
  username: string;
  password: string;
  authType: 'basic' | 'oauth';
  timestamp: string;
}

export interface ServiceNowTokens {
  access_token: EncryptedData;
  refresh_token?: EncryptedData | null;
  token_type: string;
  expires_in: number;
  scope: string;
  created_at: number;
}

export interface ServiceNowIncident {
  sys_id: string;
  number: string;
  short_description: string;
  description?: string;
  state: string;
  priority: string;
  urgency: string;
  impact: string;
  category?: string;
  subcategory?: string;
  caller_id?: ServiceNowReference;
  assigned_to?: ServiceNowReference;
  assignment_group?: ServiceNowReference;
  sys_created_on: string;
  sys_updated_on: string;
  active: string;
  [key: string]: any;
}

export interface ServiceNowReference {
  link: string;
  value: string;
  display_value?: string;
}

export interface ServiceNowUser {
  sys_id: string;
  name: string;
  user_name: string;
  email?: string;
  active: string;
}

// ServiceNow OAuth 2.0 Types
export interface ServiceNowOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface ServiceNowApiResponse<T = any> {
  result: T | T[];
  error?: {
    message: string;
    detail: string;
  };
}

export interface ServiceNowIncidentCreateRequest {
  short_description: string;
  description?: string;
  caller_id?: string;
  category?: string;
  subcategory?: string;
  urgency?: string;
  impact?: string;
  priority?: string;
  assignment_group?: string;
  assigned_to?: string;
  work_notes?: string;
  [key: string]: any;
}

export interface ServiceNowIncidentUpdateRequest {
  short_description?: string;
  description?: string;
  state?: string;
  priority?: string;
  urgency?: string;
  impact?: string;
  assignment_group?: string;
  assigned_to?: string;
  work_notes?: string;
  resolution_notes?: string;
  [key: string]: any;
}

export interface ServiceNowQueryParams {
  sysparm_query?: string;
  sysparm_limit?: number;
  sysparm_offset?: number;
  sysparm_fields?: string;
  sysparm_display_value?: 'true' | 'false' | 'all';
  sysparm_exclude_reference_link?: boolean;
  sysparm_no_count?: boolean;
}

export interface ServiceNowStoredToken {
  accessToken: EncryptedData;
  refreshToken?: EncryptedData;
  tokenType: string;
  expiresIn: number;
  scope: string;
  createdAt: number;
  expiresAt: number;
  instanceUrl: string;
}

// Slack Types
export interface SlackEvent {
  type: string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  event_ts?: string;
  [key: string]: any;
}

export interface SlackWebhookPayload {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  event?: SlackEvent;
  type: string;
  authed_users?: string[];
  event_id?: string;
  event_time?: number;
  challenge?: string;
  [key: string]: any;
}

export interface SlackMessageRequest {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

export interface SlackBlock {
  type: string;
  text?: SlackText;
  elements?: SlackElement[];
  accessory?: SlackElement;
  [key: string]: any;
}

export interface SlackText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export interface SlackElement {
  type: string;
  text?: SlackText;
  value?: string;
  url?: string;
  [key: string]: any;
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: SlackField[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  [key: string]: any;
}

export interface SlackField {
  title: string;
  value: string;
  short?: boolean;
}

// Encryption Types
export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

// OAuth Types
export interface OAuthState {
  userId: string;
  createdAt: number;
  expiresAt: number;
  service?: 'servicenow' | 'slack';
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    servicenow?: ServiceHealthStatus;
    slack?: ServiceHealthStatus;
    database?: ServiceHealthStatus;
    redis?: ServiceHealthStatus;
  };
}

export interface ServiceHealthStatus {
  status: 'connected' | 'disconnected' | 'error';
  message: string;
  responseTime?: number;
  lastChecked: string;
}

// Request/Response Extensions
export interface AuthenticatedRequest extends Express.Request {
  user?: {
    id: string;
    username: string;
    [key: string]: any;
  };
  tokenData?: ServiceNowCredentials | ServiceNowTokens;
}

// Error Types
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  tokenExpired?: boolean;
  details?: any;
}

// Webhook Validation
export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  timestamp?: number;
}

// Integration Status
export interface IntegrationStatus {
  servicenow: {
    connected: boolean;
    authType: 'basic' | 'oauth' | 'none';
    lastTested?: string;
    instanceUrl?: string;
    error?: string;
  };
  slack: {
    connected: boolean;
    workspaceId?: string;
    botUserId?: string;
    lastTested?: string;
    error?: string;
  };
}