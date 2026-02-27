-- Nexecute Connect Production Database Schema
-- Designed for real-time metrics, multi-workspace support, and 30-second SLA tracking

-- Enable UUID extension if available
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create a function to generate UUIDs (fallback for systems without uuid-ossp)
CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS $$
BEGIN
    -- Try to use uuid_generate_v4() if available
    BEGIN
        RETURN uuid_generate_v4();
    EXCEPTION
        WHEN OTHERS THEN
            -- Fallback to a simple UUID generation
            RETURN (SELECT md5(random()::text || clock_timestamp()::text)::uuid);
    END;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CORE BUSINESS TABLES
-- =============================================

-- ServiceNow instance configurations
CREATE TABLE servicenow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(255) NOT NULL, -- For multi-tenancy
    instance_url VARCHAR(512) NOT NULL UNIQUE,
    instance_name VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(512) NOT NULL, -- Encrypted
    oauth_token TEXT, -- Encrypted
    refresh_token TEXT, -- Encrypted
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slack workspace configurations (supports 10+ per customer)
CREATE TABLE slack_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(255) NOT NULL, -- For multi-tenancy
    team_id VARCHAR(255) NOT NULL UNIQUE,
    team_name VARCHAR(255) NOT NULL,
    team_domain VARCHAR(255),
    bot_token TEXT NOT NULL, -- Encrypted
    webhook_url TEXT, -- Encrypted
    signing_secret VARCHAR(512), -- Encrypted
    app_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channel routing rules for each workspace
CREATE TABLE channel_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES slack_workspaces(id) ON DELETE CASCADE,
    priority_level VARCHAR(50) NOT NULL, -- P0, P1, P2, P3, P4, P5
    channel_id VARCHAR(255) NOT NULL,
    channel_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(workspace_id, priority_level, channel_id)
);

-- User mappings between Slack and ServiceNow
CREATE TABLE user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES slack_workspaces(id) ON DELETE CASCADE,
    slack_user_id VARCHAR(255) NOT NULL,
    slack_username VARCHAR(255),
    slack_display_name VARCHAR(255),
    servicenow_user_id VARCHAR(255),
    servicenow_username VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(workspace_id, slack_user_id)
);

-- =============================================
-- INCIDENTS AND NOTIFICATIONS
-- =============================================

-- Core incidents table
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    servicenow_id VARCHAR(255) NOT NULL UNIQUE,
    servicenow_instance_id UUID NOT NULL REFERENCES servicenow_instances(id),
    number VARCHAR(255) NOT NULL, -- INC0000123
    title VARCHAR(1000) NOT NULL,
    description TEXT,
    priority VARCHAR(10) NOT NULL, -- P0, P1, P2, P3, P4, P5
    state VARCHAR(50) NOT NULL, -- New, In Progress, Resolved, etc.
    category VARCHAR(255),
    subcategory VARCHAR(255),
    urgency VARCHAR(10),
    impact VARCHAR(10),
    assigned_to VARCHAR(255),
    caller_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    slack_notified_at TIMESTAMP WITH TIME ZONE,
    first_notification_latency_ms INTEGER, -- Critical SLA metric
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- When we received the webhook
);

-- Slack notifications sent for each incident
CREATE TABLE slack_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES slack_workspaces(id),
    channel_id VARCHAR(255) NOT NULL,
    channel_name VARCHAR(255),
    message_ts VARCHAR(255), -- Slack message timestamp for updates
    thread_ts VARCHAR(255), -- Thread timestamp for threaded responses
    delivery_status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, retry
    delivery_latency_ms INTEGER, -- Time from incident to Slack delivery
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- REAL-TIME METRICS AND MONITORING
-- =============================================

-- Real-time system health metrics
CREATE TABLE system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL, -- servicenow, slack, database, redis
    status VARCHAR(20) NOT NULL, -- healthy, degraded, down
    response_time_ms INTEGER,
    error_message TEXT,
    last_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details JSONB, -- Additional service-specific details
    
    UNIQUE(service_name)
);

-- API rate limit tracking
CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service VARCHAR(50) NOT NULL, -- slack, servicenow
    endpoint VARCHAR(255) NOT NULL,
    current_usage INTEGER DEFAULT 0,
    limit_per_minute INTEGER NOT NULL,
    reset_time TIMESTAMP WITH TIME ZONE,
    workspace_id UUID, -- For Slack rate limits
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(service, endpoint, workspace_id)
);

-- Dashboard KPI metrics (aggregated periodically)
CREATE TABLE dashboard_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL, -- incident_latency_avg, success_rate, active_workspaces
    metric_value DECIMAL(12,4) NOT NULL,
    metric_unit VARCHAR(20), -- ms, percent, count
    time_bucket TIMESTAMP WITH TIME ZONE NOT NULL, -- Hourly/daily buckets
    bucket_size VARCHAR(20) NOT NULL, -- hour, day, week
    metadata JSONB, -- Additional metric context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- AUDIT AND LOGGING
-- =============================================

-- Webhook audit log for debugging
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL, -- servicenow, slack
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    headers JSONB,
    body TEXT,
    response_status INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activity tracking
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES slack_workspaces(id),
    user_id VARCHAR(255) NOT NULL,
    activity_type VARCHAR(100) NOT NULL, -- slash_command, button_click, modal_submit
    command VARCHAR(255),
    channel_id VARCHAR(255),
    incident_id UUID REFERENCES incidents(id),
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Core performance indexes for dashboard queries
CREATE INDEX idx_incidents_priority_created ON incidents(priority, created_at);
CREATE INDEX idx_incidents_state_updated ON incidents(state, updated_at);
CREATE INDEX idx_incidents_notification_latency ON incidents(first_notification_latency_ms) WHERE first_notification_latency_ms IS NOT NULL;

CREATE INDEX idx_notifications_incident_workspace ON slack_notifications(incident_id, workspace_id);
CREATE INDEX idx_notifications_delivery_status ON slack_notifications(delivery_status);
CREATE INDEX idx_notifications_sent_at ON slack_notifications(sent_at);
CREATE INDEX idx_notifications_latency ON slack_notifications(delivery_latency_ms) WHERE delivery_latency_ms IS NOT NULL;
CREATE INDEX idx_notifications_status_time ON slack_notifications(delivery_status, sent_at);

CREATE INDEX idx_health_service_time ON system_health(service_name, last_check_at);
CREATE INDEX idx_health_status ON system_health(status);

CREATE INDEX idx_metrics_name_time ON dashboard_metrics(metric_name, time_bucket);
CREATE INDEX idx_metrics_bucket ON dashboard_metrics(bucket_size, time_bucket);

CREATE INDEX idx_webhook_source_time ON webhook_logs(source, created_at);
CREATE INDEX idx_webhook_status ON webhook_logs(response_status, created_at);

CREATE INDEX idx_activity_workspace_time ON user_activity(workspace_id, created_at);
CREATE INDEX idx_activity_type ON user_activity(activity_type, created_at);

-- Time-series optimization (BRIN indexes for better performance on large datasets)
CREATE INDEX idx_dashboard_metrics_time_bucket ON dashboard_metrics (time_bucket);
CREATE INDEX idx_webhook_logs_time ON webhook_logs (created_at);

-- =============================================
-- TRIGGERS FOR AUTO-UPDATING
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_servicenow_instances_updated_at BEFORE UPDATE ON servicenow_instances FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_slack_workspaces_updated_at BEFORE UPDATE ON slack_workspaces FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_channel_routing_rules_updated_at BEFORE UPDATE ON channel_routing_rules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_user_mappings_updated_at BEFORE UPDATE ON user_mappings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- =============================================
-- SAMPLE DATA FOR DEVELOPMENT
-- =============================================

-- Insert sample ServiceNow instance
INSERT INTO servicenow_instances (
    customer_id, instance_url, instance_name, client_id, client_secret
) VALUES (
    'demo_customer', 
    'https://dev203615.service-now.com',
    'Development Instance',
    'e33635c3bd0346d1a4da334e26018838',
    'encrypted_client_secret'
);

-- Insert sample Slack workspace
INSERT INTO slack_workspaces (
    customer_id, team_id, team_name, team_domain, bot_token, app_id
) VALUES (
    'demo_customer',
    'T09DXAEM550',
    'Nexecute Workspace',
    'nexecute',
    'encrypted_bot_token',
    'A09DRQCPMKP'
);

-- Insert sample channel routing rules
INSERT INTO channel_routing_rules (workspace_id, priority_level, channel_id, channel_name, description)
SELECT 
    w.id,
    priority,
    channel_id,
    channel_name,
    description
FROM slack_workspaces w,
    (VALUES 
        ('P0', 'C09EAQ585G9', '#critical-ops', 'P0 Critical incidents to ops team'),
        ('P1', 'C09EAQ585G9', '#critical-ops', 'P1 High priority to ops team'),
        ('P1', 'C09DXAEM54N', '#nexecute', 'P1 High priority to main channel'),
        ('P2', 'C09DXAEM54N', '#nexecute', 'P2 Medium priority incidents'),
        ('P3', 'C09DXAEM54N', '#nexecute', 'P3 Standard incidents'),
        ('P4', 'C09DXAEM54N', '#nexecute', 'P4 Low priority incidents'),
        ('P5', 'C09DXAEM54N', '#nexecute', 'P5 Planning incidents')
    ) AS rules(priority, channel_id, channel_name, description)
WHERE w.team_id = 'T09DXAEM550';

-- Initialize system health monitoring
INSERT INTO system_health (service_name, status, response_time_ms) VALUES
('servicenow', 'healthy', 245),
('slack', 'healthy', 156),
('database', 'healthy', 12),
('redis', 'healthy', 3);

-- Create materialized view for dashboard performance
CREATE MATERIALIZED VIEW dashboard_summary AS
SELECT 
    COUNT(i.id) as total_incidents,
    COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as incidents_24h,
    COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as incidents_7d,
    COUNT(sn.id) as total_notifications,
    COUNT(CASE WHEN sn.delivery_status = 'sent' THEN 1 END) as successful_notifications,
    AVG(sn.delivery_latency_ms) as avg_delivery_latency,
    COUNT(DISTINCT sw.id) as active_workspaces,
    MAX(i.received_at) as last_incident_time
FROM incidents i
LEFT JOIN slack_notifications sn ON i.id = sn.incident_id
LEFT JOIN slack_workspaces sw ON sw.is_active = true
WHERE i.created_at >= NOW() - INTERVAL '30 days';

-- Index for materialized view
CREATE UNIQUE INDEX idx_dashboard_summary ON dashboard_summary (total_incidents);

-- Auto-refresh materialized view every 5 minutes
CREATE OR REPLACE FUNCTION refresh_dashboard_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON DATABASE nexecute_connect IS 'Nexecute Connect production database for ServiceNow-Slack integration with real-time metrics and multi-workspace support';