import 'express-session';

declare module 'express-session' {
  interface SessionData {
    // ServiceNow OAuth session data
    servicenow_oauth_state?: string;
    servicenow_authenticated?: boolean;
    servicenow_expires_at?: number;
    
    // User information (if available)
    user_id?: string;
    user_name?: string;
    
    // General session metadata
    created_at?: number;
    last_activity?: number;
  }
}