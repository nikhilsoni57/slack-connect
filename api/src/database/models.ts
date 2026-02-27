/**
 * Database models and interfaces for Nexecute Connect
 * Production-ready models with comprehensive typing for dashboard metrics
 */

export interface ServiceNowInstance {
  id: string;
  customer_id: string;
  instance_url: string;
  instance_name: string;
  client_id: string;
  client_secret: string;
  oauth_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
  is_active: boolean;
  last_sync_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SlackWorkspace {
  id: string;
  customer_id: string;
  team_id: string;
  team_name: string;
  team_domain?: string;
  bot_token: string;
  webhook_url?: string;
  signing_secret?: string;
  app_id?: string;
  is_active: boolean;
  installed_at: Date;
  last_activity_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ChannelRoutingRule {
  id: string;
  workspace_id: string;
  priority_level: string; // P0, P1, P2, P3, P4, P5
  channel_id: string;
  channel_name: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserMapping {
  id: string;
  workspace_id: string;
  slack_user_id: string;
  slack_username?: string;
  slack_display_name?: string;
  servicenow_user_id?: string;
  servicenow_username?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Incident {
  id: string;
  servicenow_id: string;
  servicenow_instance_id: string;
  number: string;
  title: string;
  description?: string;
  priority: string;
  state: string;
  category?: string;
  subcategory?: string;
  urgency?: string;
  impact?: string;
  assigned_to?: string;
  caller_id?: string;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
  slack_notified_at?: Date;
  first_notification_latency_ms?: number;
  incident_response_time_minutes?: number;
  received_at: Date;
}

export interface SlackNotification {
  id: string;
  incident_id: string;
  workspace_id: string;
  channel_id: string;
  channel_name?: string;
  message_ts?: string;
  thread_ts?: string;
  delivery_status: 'pending' | 'sent' | 'failed' | 'retry';
  delivery_latency_ms?: number;
  retry_count: number;
  error_message?: string;
  sent_at?: Date;
  created_at: Date;
}

export interface SystemHealth {
  id: string;
  service_name: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time_ms?: number;
  error_message?: string;
  last_check_at: Date;
  details?: Record<string, any>;
}

export interface APIRateLimit {
  id: string;
  service: string;
  endpoint: string;
  current_usage: number;
  limit_per_minute: number;
  reset_time?: Date;
  workspace_id?: string;
  last_updated_at: Date;
}

export interface DashboardMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  time_bucket: Date;
  bucket_size: 'hour' | 'day' | 'week';
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface WebhookLog {
  id: string;
  source: 'servicenow' | 'slack';
  endpoint: string;
  method: string;
  headers?: Record<string, any>;
  body?: string;
  response_status?: number;
  response_time_ms?: number;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface UserActivity {
  id: string;
  workspace_id?: string;
  user_id: string;
  activity_type: string;
  command?: string;
  channel_id?: string;
  incident_id?: string;
  response_time_ms?: number;
  success: boolean;
  error_message?: string;
  created_at: Date;
}

// Dashboard-specific aggregated types
export interface DashboardSummary {
  // MVP-focused top cards
  p1_incidents_active: number;           // Count of critical open incidents
  sla_compliance_percent: number;        // Percentage meeting 30-second notification target
  channel_coverage: number;              // Number of active Slack workspaces connected
  last_p1_alert?: Date;                  // Time since last critical incident
  
  // Legacy metrics (kept for compatibility)
  total_incidents: number;
  incidents_24h: number;
  incidents_7d: number;
  total_notifications: number;
  successful_notifications: number;
  avg_delivery_latency: number;
  active_workspaces: number;
  last_incident_time?: Date;
}

export interface IncidentLatencyMetrics {
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  sla_breaches: number; // Notifications > 30 seconds
  total_incidents: number;
  period_start: Date;
  period_end: Date;
}

export interface SuccessRateMetrics {
  total_attempts: number;
  successful_deliveries: number;
  failed_deliveries: number;
  success_rate_percent: number;
  retry_rate_percent: number;
  avg_retry_count: number;
  period_start: Date;
  period_end: Date;
}

export interface ChannelRoutingEfficiency {
  workspace_id: string;
  workspace_name: string;
  channel_id: string;
  channel_name: string;
  priority_level: string;
  total_routed: number;
  avg_delivery_time_ms: number;
  success_rate_percent: number;
  last_activity: Date;
}

export interface ActiveIntegrationStats {
  total_workspaces: number;
  active_workspaces: number;
  total_instances: number;
  active_instances: number;
  total_channels: number;
  active_routing_rules: number;
  last_sync_times: Record<string, Date>;
}

export interface SlashCommandPerformance {
  command: string;
  total_executions: number;
  avg_response_time_ms: number;
  success_rate_percent: number;
  most_used_channel: string;
  last_executed: Date;
  period_start: Date;
  period_end: Date;
}

export interface DailyTrendData {
  date: string;
  incidents_created: number;
  notifications_sent: number;
  notifications_failed: number;
  avg_latency_ms: number;
  unique_users: number;
  active_workspaces: number;
}

// Input types for creating records
export interface CreateIncidentInput {
  servicenow_id: string;
  servicenow_instance_id: string;
  number: string;
  title: string;
  description?: string;
  priority: string;
  state: string;
  category?: string;
  subcategory?: string;
  urgency?: string;
  impact?: string;
  assigned_to?: string;
  caller_id?: string;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
}

export interface UpdateIncidentInput {
  priority?: string;
  state?: string;
  assigned_to?: string;
  updated_at: Date;
  resolved_at?: Date;
  incident_response_time_minutes?: number;
}

export interface CreateSlackNotificationInput {
  incident_id: string;
  workspace_id: string;
  channel_id: string;
  channel_name?: string;
  message_ts?: string;
  thread_ts?: string;
}

export interface UpdateNotificationDeliveryInput {
  id: string;
  delivery_status: 'sent' | 'failed';
  delivery_latency_ms?: number;
  error_message?: string;
  message_ts?: string;
}

export interface CreateWebhookLogInput {
  source: 'servicenow' | 'slack';
  endpoint: string;
  method: string;
  headers?: Record<string, any>;
  body?: string;
  response_status?: number;
  response_time_ms?: number;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface CreateUserActivityInput {
  workspace_id?: string;
  user_id: string;
  activity_type: string;
  command?: string;
  channel_id?: string;
  incident_id?: string;
  response_time_ms?: number;
  success: boolean;
  error_message?: string;
}

// Query filter types
export interface TimeRangeFilter {
  start_date: Date;
  end_date: Date;
}

export interface IncidentFilter extends TimeRangeFilter {
  priority?: string[];
  state?: string[];
  workspace_id?: string;
  servicenow_instance_id?: string;
}

export interface NotificationFilter extends TimeRangeFilter {
  delivery_status?: string[];
  workspace_id?: string;
  channel_id?: string;
  min_latency_ms?: number;
  max_latency_ms?: number;
}

// API Response types for dashboard endpoints
export interface DashboardHealthResponse {
  overall_status: 'healthy' | 'degraded' | 'down';
  services: SystemHealth[];
  last_updated: Date;
}

export interface DashboardMetricsResponse {
  summary: DashboardSummary;
  latency_metrics: IncidentLatencyMetrics;
  success_metrics: SuccessRateMetrics;
  active_integrations: ActiveIntegrationStats;
  rate_limits: APIRateLimit[];
  last_updated: Date;
}

export interface DashboardAnalyticsResponse {
  daily_trends: DailyTrendData[];
  channel_efficiency: ChannelRoutingEfficiency[];
  command_performance: SlashCommandPerformance[];
  user_activity_summary: {
    total_users: number;
    active_users_24h: number;
    most_active_channels: Array<{
      channel_id: string;
      channel_name: string;
      activity_count: number;
    }>;
  };
  last_updated: Date;
}

export interface DashboardConfigResponse {
  workspaces: Array<{
    id: string;
    team_name: string;
    team_id: string;
    is_active: boolean;
    last_activity: Date;
    channel_count: number;
  }>;
  instances: Array<{
    id: string;
    instance_name: string;
    instance_url: string;
    is_active: boolean;
    last_sync: Date;
  }>;
  routing_rules: ChannelRoutingRule[];
  last_updated: Date;
}