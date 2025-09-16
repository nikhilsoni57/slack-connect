/**
 * Dashboard Service - Production-ready data service for real-time metrics
 * Handles all dashboard data queries with performance optimization and caching
 */

import { database } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import {
  DashboardSummary,
  IncidentLatencyMetrics,
  SuccessRateMetrics,
  ActiveIntegrationStats,
  ChannelRoutingEfficiency,
  SlashCommandPerformance,
  DailyTrendData,
  SystemHealth,
  APIRateLimit,
  DashboardHealthResponse,
  DashboardMetricsResponse,
  DashboardAnalyticsResponse,
  DashboardConfigResponse,
  CreateIncidentInput,
  UpdateIncidentInput,
  CreateSlackNotificationInput,
  UpdateNotificationDeliveryInput,
  CreateWebhookLogInput,
  CreateUserActivityInput,
  TimeRangeFilter,
  IncidentFilter,
  NotificationFilter
} from '../database/models.js';

export class DashboardService {
  
  // =============================================
  // CORE DASHBOARD METRICS
  // =============================================

  /**
   * Get complete dashboard health status
   */
  async getHealthStatus(): Promise<DashboardHealthResponse> {
    try {
      const start = Date.now();
      
      const healthResult = await database.query<SystemHealth>(`
        SELECT 
          service_name, 
          status, 
          response_time_ms, 
          error_message, 
          last_check_at
        FROM system_health 
        ORDER BY service_name
      `);

      const services = healthResult.rows;
      
      // Determine overall status
      const hasDown = services.some(s => s.status === 'down');
      const hasDegraded = services.some(s => s.status === 'degraded');
      
      let overall_status: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (hasDown) overall_status = 'down';
      else if (hasDegraded) overall_status = 'degraded';

      const response: DashboardHealthResponse = {
        overall_status,
        services,
        last_updated: new Date()
      };

      const duration = Date.now() - start;
      logger.debug(`Dashboard health query completed in ${duration}ms`);
      
      return response;
      
    } catch (error) {
      logger.error('Failed to get dashboard health status:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetricsResponse> {
    try {
      const start = Date.now();
      
      // Execute all metric queries in parallel for performance
      const [
        summaryResult,
        latencyResult,
        successResult,
        integrationResult,
        rateLimitResult
      ] = await Promise.all([
        this.getDashboardSummary(),
        this.getIncidentLatencyMetrics({ 
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          end_date: new Date() 
        }),
        this.getSuccessRateMetrics({ 
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end_date: new Date() 
        }),
        this.getActiveIntegrationStats(),
        this.getRateLimits()
      ]);

      const response: DashboardMetricsResponse = {
        summary: summaryResult,
        latency_metrics: latencyResult,
        success_metrics: successResult,
        active_integrations: integrationResult,
        rate_limits: rateLimitResult,
        last_updated: new Date()
      };

      const duration = Date.now() - start;
      logger.debug(`Dashboard metrics query completed in ${duration}ms`);
      
      return response;
      
    } catch (error) {
      logger.error('Failed to get dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard analytics data
   */
  async getDashboardAnalytics(): Promise<DashboardAnalyticsResponse> {
    try {
      const start = Date.now();
      const timeRange: TimeRangeFilter = {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end_date: new Date()
      };

      // Execute analytics queries in parallel
      const [
        dailyTrends,
        channelEfficiency,
        commandPerformance,
        userActivitySummary
      ] = await Promise.all([
        this.getDailyTrends(timeRange),
        this.getChannelRoutingEfficiency(),
        this.getSlashCommandPerformance(timeRange),
        this.getUserActivitySummary(timeRange)
      ]);

      const response: DashboardAnalyticsResponse = {
        daily_trends: dailyTrends,
        channel_efficiency: channelEfficiency,
        command_performance: commandPerformance,
        user_activity_summary: userActivitySummary,
        last_updated: new Date()
      };

      const duration = Date.now() - start;
      logger.debug(`Dashboard analytics query completed in ${duration}ms`);
      
      return response;
      
    } catch (error) {
      logger.error('Failed to get dashboard analytics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard configuration data
   */
  async getDashboardConfig(): Promise<DashboardConfigResponse> {
    try {
      const start = Date.now();
      
      // Get workspaces with channel counts
      const workspacesResult = await database.query(`
        SELECT 
          w.id,
          w.team_name,
          w.team_id,
          w.is_active,
          w.last_activity_at,
          COUNT(crr.id) as channel_count
        FROM slack_workspaces w
        LEFT JOIN channel_routing_rules crr ON w.id = crr.workspace_id AND crr.is_active = true
        GROUP BY w.id, w.team_name, w.team_id, w.is_active, w.last_activity_at
        ORDER BY w.team_name
      `);

      // Get ServiceNow instances
      const instancesResult = await database.query(`
        SELECT 
          id,
          instance_name,
          instance_url,
          is_active,
          last_sync_at
        FROM servicenow_instances
        ORDER BY instance_name
      `);

      // Get routing rules
      const routingResult = await database.query(`
        SELECT 
          crr.*,
          w.team_name
        FROM channel_routing_rules crr
        JOIN slack_workspaces w ON crr.workspace_id = w.id
        WHERE crr.is_active = true
        ORDER BY w.team_name, crr.priority_level
      `);

      const response: DashboardConfigResponse = {
        workspaces: workspacesResult.rows.map(row => ({
          id: row.id,
          team_name: row.team_name,
          team_id: row.team_id,
          is_active: row.is_active,
          last_activity: row.last_activity_at || new Date(),
          channel_count: parseInt(row.channel_count) || 0
        })),
        instances: instancesResult.rows.map(row => ({
          id: row.id,
          instance_name: row.instance_name,
          instance_url: row.instance_url,
          is_active: row.is_active,
          last_sync: row.last_sync_at || new Date()
        })),
        routing_rules: routingResult.rows,
        last_updated: new Date()
      };

      const duration = Date.now() - start;
      logger.debug(`Dashboard config query completed in ${duration}ms`);
      
      return response;
      
    } catch (error) {
      logger.error('Failed to get dashboard configuration:', error);
      throw error;
    }
  }

  // =============================================
  // DETAILED METRIC CALCULATIONS
  // =============================================

  private async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      // Enhanced query with MVP-focused metrics
      const result = await database.query(`
        SELECT 
          -- MVP-focused top cards
          COUNT(CASE WHEN i.priority = '1' AND i.state IN ('1', '2', '3') THEN 1 END) as p1_incidents_active,
          
          -- SLA compliance: percentage of notifications delivered within 30 seconds
          CASE 
            WHEN (
              SELECT COUNT(*) FROM notification_delivery_log ndl 
              WHERE ndl.delivered_at >= NOW() - INTERVAL '7 days'
            ) > 0 THEN
              ROUND(
                (SELECT COUNT(*) FROM notification_delivery_log ndl 
                 WHERE ndl.delivered_at >= NOW() - INTERVAL '7 days' 
                 AND ndl.delivery_latency_ms <= 30000 
                 AND ndl.success = true) * 100.0 / 
                (SELECT COUNT(*) FROM notification_delivery_log ndl 
                 WHERE ndl.delivered_at >= NOW() - INTERVAL '7 days'), 1
              )
            ELSE 100.0
          END as sla_compliance_percent,
          
          -- Channel coverage: active Slack workspaces
          (SELECT COUNT(DISTINCT sw.id) FROM slack_workspaces sw WHERE sw.is_active = true) as channel_coverage,
          
          -- Last P1 alert: most recent critical incident
          (SELECT MAX(i2.received_at) FROM incidents i2 WHERE i2.priority = '1') as last_p1_alert,
          
          -- Legacy metrics (for compatibility)
          COUNT(i.id) as total_incidents,
          COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as incidents_24h,
          COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as incidents_7d,
          
          -- Include both slack_notifications and notification_delivery_log
          (
            SELECT COUNT(*) FROM notification_delivery_log ndl 
            WHERE ndl.delivered_at >= NOW() - INTERVAL '30 days'
          ) +
          (
            SELECT COUNT(*) FROM slack_notifications sn 
            WHERE sn.created_at >= NOW() - INTERVAL '30 days'
          ) as total_notifications,
          
          (
            SELECT COUNT(*) FROM notification_delivery_log ndl 
            WHERE ndl.success = true AND ndl.delivered_at >= NOW() - INTERVAL '30 days'
          ) +
          (
            SELECT COUNT(*) FROM slack_notifications sn 
            WHERE sn.delivery_status = 'sent' AND sn.created_at >= NOW() - INTERVAL '30 days'
          ) as successful_notifications,
          
          (
            SELECT AVG(ndl.delivery_latency_ms) FROM notification_delivery_log ndl 
            WHERE ndl.delivered_at >= NOW() - INTERVAL '30 days' AND ndl.delivery_latency_ms IS NOT NULL
          ) as avg_delivery_latency,
          
          (SELECT COUNT(DISTINCT sw.id) FROM slack_workspaces sw WHERE sw.is_active = true) as active_workspaces,
          MAX(i.received_at) as last_incident_time
        FROM incidents i
        WHERE i.created_at >= NOW() - INTERVAL '30 days'
      `);

      const row = result.rows[0];
      return {
        // MVP-focused metrics
        p1_incidents_active: parseInt(row.p1_incidents_active) || 0,
        sla_compliance_percent: parseFloat(row.sla_compliance_percent) || 100.0,
        channel_coverage: parseInt(row.channel_coverage) || 0,
        last_p1_alert: row.last_p1_alert || null,
        
        // Legacy metrics
        total_incidents: parseInt(row.total_incidents) || 0,
        incidents_24h: parseInt(row.incidents_24h) || 0,
        incidents_7d: parseInt(row.incidents_7d) || 0,
        total_notifications: parseInt(row.total_notifications) || 0,
        successful_notifications: parseInt(row.successful_notifications) || 0,
        avg_delivery_latency: row.avg_delivery_latency || null,
        active_workspaces: parseInt(row.active_workspaces) || 0,
        last_incident_time: row.last_incident_time || null
      };
      
    } catch (error) {
      logger.error('Failed to get dashboard summary:', error);
      
      // Fallback to basic query if notification tables don't exist yet
      try {
        const basicResult = await database.query(`
          SELECT 
            COUNT(i.id) as total_incidents,
            COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as incidents_24h,
            COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as incidents_7d,
            MAX(i.received_at) as last_incident_time
          FROM incidents i
          WHERE i.created_at >= NOW() - INTERVAL '30 days'
        `);
        
        const row = basicResult.rows[0];
        return {
          total_incidents: parseInt(row.total_incidents) || 0,
          incidents_24h: parseInt(row.incidents_24h) || 0,  
          incidents_7d: parseInt(row.incidents_7d) || 0,
          total_notifications: 0,
          successful_notifications: 0,
          avg_delivery_latency: null,
          active_workspaces: 1,
          last_incident_time: row.last_incident_time || null
        };
      } catch (fallbackError) {
        logger.error('Fallback dashboard summary query failed:', fallbackError);
        return {
          total_incidents: 0,
          incidents_24h: 0,
          incidents_7d: 0,
          total_notifications: 0,
          successful_notifications: 0,
          avg_delivery_latency: null,
          active_workspaces: 0,
          last_incident_time: null
        };
      }
    }
  }

  private async getIncidentLatencyMetrics(timeRange: TimeRangeFilter): Promise<IncidentLatencyMetrics> {
    const result = await database.query(`
      SELECT 
        AVG(sn.delivery_latency_ms) as avg_latency_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sn.delivery_latency_ms) as p50_latency_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY sn.delivery_latency_ms) as p95_latency_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY sn.delivery_latency_ms) as p99_latency_ms,
        COUNT(CASE WHEN sn.delivery_latency_ms > 30000 THEN 1 END) as sla_breaches,
        COUNT(*) as total_incidents
      FROM slack_notifications sn
      JOIN incidents i ON sn.incident_id = i.id
      WHERE i.created_at >= $1 AND i.created_at <= $2
      AND sn.delivery_latency_ms IS NOT NULL
    `, [timeRange.start_date, timeRange.end_date]);

    const row = result.rows[0];
    return {
      avg_latency_ms: Math.round(row.avg_latency_ms || 0),
      p50_latency_ms: Math.round(row.p50_latency_ms || 0),
      p95_latency_ms: Math.round(row.p95_latency_ms || 0),
      p99_latency_ms: Math.round(row.p99_latency_ms || 0),
      sla_breaches: parseInt(row.sla_breaches) || 0,
      total_incidents: parseInt(row.total_incidents) || 0,
      period_start: timeRange.start_date,
      period_end: timeRange.end_date
    };
  }

  private async getSuccessRateMetrics(timeRange: TimeRangeFilter): Promise<SuccessRateMetrics> {
    const result = await database.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN delivery_status = 'sent' THEN 1 END) as successful_deliveries,
        COUNT(CASE WHEN delivery_status = 'failed' THEN 1 END) as failed_deliveries,
        AVG(retry_count) as avg_retry_count
      FROM slack_notifications sn
      JOIN incidents i ON sn.incident_id = i.id
      WHERE i.created_at >= $1 AND i.created_at <= $2
    `, [timeRange.start_date, timeRange.end_date]);

    const row = result.rows[0];
    const totalAttempts = parseInt(row.total_attempts) || 0;
    const successfulDeliveries = parseInt(row.successful_deliveries) || 0;
    const failedDeliveries = parseInt(row.failed_deliveries) || 0;

    return {
      total_attempts: totalAttempts,
      successful_deliveries: successfulDeliveries,
      failed_deliveries: failedDeliveries,
      success_rate_percent: totalAttempts > 0 ? (successfulDeliveries / totalAttempts) * 100 : 0,
      retry_rate_percent: totalAttempts > 0 ? ((totalAttempts - successfulDeliveries - failedDeliveries) / totalAttempts) * 100 : 0,
      avg_retry_count: parseFloat(row.avg_retry_count) || 0,
      period_start: timeRange.start_date,
      period_end: timeRange.end_date
    };
  }

  private async getActiveIntegrationStats(): Promise<ActiveIntegrationStats> {
    const [workspaceResult, instanceResult, channelResult] = await Promise.all([
      database.query(`
        SELECT 
          COUNT(*) as total_workspaces,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_workspaces
        FROM slack_workspaces
      `),
      database.query(`
        SELECT 
          COUNT(*) as total_instances,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_instances
        FROM servicenow_instances
      `),
      database.query(`
        SELECT 
          COUNT(DISTINCT channel_id) as total_channels,
          COUNT(*) as active_routing_rules
        FROM channel_routing_rules
        WHERE is_active = true
      `)
    ]);

    return {
      total_workspaces: parseInt(workspaceResult.rows[0].total_workspaces) || 0,
      active_workspaces: parseInt(workspaceResult.rows[0].active_workspaces) || 0,
      total_instances: parseInt(instanceResult.rows[0].total_instances) || 0,
      active_instances: parseInt(instanceResult.rows[0].active_instances) || 0,
      total_channels: parseInt(channelResult.rows[0].total_channels) || 0,
      active_routing_rules: parseInt(channelResult.rows[0].active_routing_rules) || 0,
      last_sync_times: {} // TODO: Implement per-instance sync times
    };
  }

  private async getRateLimits(): Promise<APIRateLimit[]> {
    const result = await database.query<APIRateLimit>(`
      SELECT * FROM api_rate_limits
      ORDER BY service, endpoint
    `);

    return result.rows;
  }

  private async getDailyTrends(timeRange: TimeRangeFilter): Promise<DailyTrendData[]> {
    const result = await database.query(`
      SELECT 
        DATE(i.created_at) as date,
        COUNT(i.id) as incidents_created,
        COUNT(sn.id) as notifications_sent,
        COUNT(CASE WHEN sn.delivery_status = 'failed' THEN 1 END) as notifications_failed,
        AVG(sn.delivery_latency_ms) as avg_latency_ms,
        COUNT(DISTINCT ua.user_id) as unique_users,
        COUNT(DISTINCT sn.workspace_id) as active_workspaces
      FROM incidents i
      LEFT JOIN slack_notifications sn ON i.id = sn.incident_id
      LEFT JOIN user_activity ua ON DATE(ua.created_at) = DATE(i.created_at)
      WHERE i.created_at >= $1 AND i.created_at <= $2
      GROUP BY DATE(i.created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [timeRange.start_date, timeRange.end_date]);

    return result.rows.map(row => ({
      date: row.date,
      incidents_created: parseInt(row.incidents_created) || 0,
      notifications_sent: parseInt(row.notifications_sent) || 0,
      notifications_failed: parseInt(row.notifications_failed) || 0,
      avg_latency_ms: Math.round(row.avg_latency_ms || 0),
      unique_users: parseInt(row.unique_users) || 0,
      active_workspaces: parseInt(row.active_workspaces) || 0
    }));
  }

  private async getChannelRoutingEfficiency(): Promise<ChannelRoutingEfficiency[]> {
    const result = await database.query(`
      SELECT 
        crr.workspace_id,
        w.team_name as workspace_name,
        crr.channel_id,
        crr.channel_name,
        crr.priority_level,
        COUNT(sn.id) as total_routed,
        AVG(sn.delivery_latency_ms) as avg_delivery_time_ms,
        COUNT(CASE WHEN sn.delivery_status = 'sent' THEN 1 END) * 100.0 / COUNT(sn.id) as success_rate_percent,
        MAX(sn.created_at) as last_activity
      FROM channel_routing_rules crr
      JOIN slack_workspaces w ON crr.workspace_id = w.id
      LEFT JOIN slack_notifications sn ON crr.channel_id = sn.channel_id AND crr.workspace_id = sn.workspace_id
      WHERE crr.is_active = true
      GROUP BY crr.workspace_id, w.team_name, crr.channel_id, crr.channel_name, crr.priority_level
      HAVING COUNT(sn.id) > 0
      ORDER BY total_routed DESC
    `);

    return result.rows.map(row => ({
      workspace_id: row.workspace_id,
      workspace_name: row.workspace_name,
      channel_id: row.channel_id,
      channel_name: row.channel_name,
      priority_level: row.priority_level,
      total_routed: parseInt(row.total_routed) || 0,
      avg_delivery_time_ms: Math.round(row.avg_delivery_time_ms || 0),
      success_rate_percent: parseFloat(row.success_rate_percent) || 0,
      last_activity: row.last_activity || new Date()
    }));
  }

  private async getSlashCommandPerformance(timeRange: TimeRangeFilter): Promise<SlashCommandPerformance[]> {
    const result = await database.query(`
      SELECT 
        command,
        COUNT(*) as total_executions,
        AVG(response_time_ms) as avg_response_time_ms,
        COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / COUNT(*) as success_rate_percent,
        MODE() WITHIN GROUP (ORDER BY channel_id) as most_used_channel,
        MAX(created_at) as last_executed
      FROM user_activity
      WHERE activity_type = 'slash_command'
      AND created_at >= $1 AND created_at <= $2
      AND command IS NOT NULL
      GROUP BY command
      ORDER BY total_executions DESC
    `, [timeRange.start_date, timeRange.end_date]);

    return result.rows.map(row => ({
      command: row.command,
      total_executions: parseInt(row.total_executions) || 0,
      avg_response_time_ms: Math.round(row.avg_response_time_ms || 0),
      success_rate_percent: parseFloat(row.success_rate_percent) || 0,
      most_used_channel: row.most_used_channel || 'Unknown',
      last_executed: row.last_executed || new Date(),
      period_start: timeRange.start_date,
      period_end: timeRange.end_date
    }));
  }

  private async getUserActivitySummary(timeRange: TimeRangeFilter) {
    const [totalResult, activeResult, channelResult] = await Promise.all([
      database.query(`
        SELECT COUNT(DISTINCT user_id) as total_users
        FROM user_activity
        WHERE created_at >= $1 AND created_at <= $2
      `, [timeRange.start_date, timeRange.end_date]),
      
      database.query(`
        SELECT COUNT(DISTINCT user_id) as active_users_24h
        FROM user_activity
        WHERE created_at >= $1
      `, [new Date(Date.now() - 24 * 60 * 60 * 1000)]),
      
      database.query(`
        SELECT 
          channel_id,
          'Unknown' as channel_name,
          COUNT(*) as activity_count
        FROM user_activity
        WHERE created_at >= $1 AND created_at <= $2
        AND channel_id IS NOT NULL
        GROUP BY channel_id
        ORDER BY activity_count DESC
        LIMIT 5
      `, [timeRange.start_date, timeRange.end_date])
    ]);

    return {
      total_users: parseInt(totalResult.rows[0]?.total_users) || 0,
      active_users_24h: parseInt(activeResult.rows[0]?.active_users_24h) || 0,
      most_active_channels: channelResult.rows.map(row => ({
        channel_id: row.channel_id,
        channel_name: row.channel_name,
        activity_count: parseInt(row.activity_count) || 0
      }))
    };
  }

  // =============================================
  // DATA INSERTION METHODS
  // =============================================

  async createIncident(data: CreateIncidentInput): Promise<string> {
    try {
      // First, try adding the column if it doesn't exist
      await database.query(`
        ALTER TABLE incidents 
        ADD COLUMN IF NOT EXISTS incident_response_time_minutes INTEGER
      `);
      
      const result = await database.query(`
        INSERT INTO incidents (
          servicenow_id, servicenow_instance_id, number, title, description,
          priority, state, category, subcategory, urgency, impact,
          assigned_to, caller_id, created_at, updated_at, resolved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `, [
        data.servicenow_id, data.servicenow_instance_id, data.number, data.title, data.description,
        data.priority, data.state, data.category, data.subcategory, data.urgency, data.impact,
        data.assigned_to, data.caller_id, data.created_at, data.updated_at, data.resolved_at
      ]);

      const incidentId = result.rows[0].id;
      logger.info(`Created incident: ${data.number} (${incidentId})`);
      
      // Refresh materialized view
      await database.refreshDashboardSummary();
      
      return incidentId;
      
    } catch (error) {
      logger.error('Failed to create incident:', error);
      throw error;
    }
  }

  async updateIncident(servicenowId: string, data: UpdateIncidentInput): Promise<string | null> {
    try {
      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      if (data.priority !== undefined) {
        updateFields.push(`priority = $${paramCounter}`);
        values.push(data.priority);
        paramCounter++;
      }

      if (data.state !== undefined) {
        updateFields.push(`state = $${paramCounter}`);
        values.push(data.state);
        paramCounter++;
      }

      if (data.assigned_to !== undefined) {
        updateFields.push(`assigned_to = $${paramCounter}`);
        values.push(data.assigned_to);
        paramCounter++;
      }

      updateFields.push(`updated_at = $${paramCounter}`);
      values.push(data.updated_at);
      paramCounter++;

      if (data.resolved_at !== undefined) {
        updateFields.push(`resolved_at = $${paramCounter}`);
        values.push(data.resolved_at);
        paramCounter++;
      }

      if (data.incident_response_time_minutes !== undefined) {
        updateFields.push(`incident_response_time_minutes = $${paramCounter}`);
        values.push(data.incident_response_time_minutes);
        paramCounter++;
      }

      // Add servicenow_id as the last parameter for WHERE clause
      values.push(servicenowId);
      
      const result = await database.query(`
        UPDATE incidents 
        SET ${updateFields.join(', ')}
        WHERE servicenow_id = $${paramCounter}
        RETURNING id
      `, values);

      if (result.rows.length === 0) {
        logger.warn(`Incident not found for update: ${servicenowId}`);
        return null;
      }

      const incidentId = result.rows[0].id;
      logger.info(`Updated incident: ${servicenowId} (${incidentId})`);
      
      // Refresh materialized view
      await database.refreshDashboardSummary();
      
      return incidentId;
      
    } catch (error) {
      logger.error('Failed to update incident:', error);
      throw error;
    }
  }

  /**
   * Update incident or create it if it doesn't exist (upsert)
   * This handles cases where ServiceNow sends resolution webhooks for incidents
   * that were never created in our database
   */
  async upsertIncident(incidentData: any, updateData: any): Promise<string> {
    try {
      // First, try to update the existing incident
      const existingIncidentId = await this.updateIncident(incidentData.sys_id, updateData);
      
      if (existingIncidentId) {
        logger.info(`📊 Updated existing incident: ${incidentData.number}`);
        return existingIncidentId;
      }
      
      // If update failed (incident doesn't exist), create it
      logger.info(`🆕 Creating missing incident: ${incidentData.number} (received ${updateData.resolved_at ? 'resolution' : 'update'} webhook)`);
      
      const newIncidentId = await this.createIncident({
        servicenow_id: incidentData.sys_id,
        servicenow_instance_id: 'd3c89498-583a-4710-958c-dc74bded1ca9', // Development Instance UUID
        number: incidentData.number,
        title: incidentData.short_description || incidentData.title || 'Incident from webhook',
        description: incidentData.description,
        priority: incidentData.priority,
        state: updateData.state || incidentData.state,
        category: incidentData.category,
        subcategory: incidentData.subcategory,
        urgency: incidentData.urgency,
        impact: incidentData.impact,
        assigned_to: updateData.assigned_to || incidentData.assigned_to,
        caller_id: incidentData.caller_id,
        created_at: new Date(incidentData.sys_created_on || incidentData.created_at || new Date()),
        updated_at: updateData.updated_at || new Date(incidentData.sys_updated_on || new Date()),
        resolved_at: updateData.resolved_at
      });
      
      logger.info(`✅ Created missing incident: ${incidentData.number} (${newIncidentId})`);
      return newIncidentId;
      
    } catch (error) {
      logger.error(`Failed to upsert incident ${incidentData.number}:`, error);
      throw error;
    }
  }

  async deleteIncident(servicenowId: string): Promise<boolean> {
    try {
      const result = await database.query(`
        DELETE FROM incidents 
        WHERE servicenow_id = $1
        RETURNING id, number, priority
      `, [servicenowId]);

      if (result.rows.length === 0) {
        logger.warn(`Incident not found for deletion: ${servicenowId}`);
        return false;
      }

      const deletedIncident = result.rows[0];
      logger.info(`Deleted incident: ${deletedIncident.number} (${deletedIncident.id}) - Priority ${deletedIncident.priority}`);
      
      // Refresh materialized view to update counters
      await database.refreshDashboardSummary();
      
      return true;
      
    } catch (error) {
      logger.error('Failed to delete incident:', error);
      throw error;
    }
  }

  async createSlackNotification(data: CreateSlackNotificationInput): Promise<string> {
    try {
      const result = await database.query(`
        INSERT INTO slack_notifications (
          incident_id, workspace_id, channel_id, channel_name, message_ts, thread_ts
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        data.incident_id, data.workspace_id, data.channel_id, 
        data.channel_name, data.message_ts, data.thread_ts
      ]);

      return result.rows[0].id;
      
    } catch (error) {
      logger.error('Failed to create slack notification:', error);
      throw error;
    }
  }

  async updateNotificationDelivery(data: UpdateNotificationDeliveryInput): Promise<void> {
    try {
      await database.query(`
        UPDATE slack_notifications 
        SET 
          delivery_status = $2,
          delivery_latency_ms = $3,
          error_message = $4,
          message_ts = COALESCE($5, message_ts),
          sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END
        WHERE id = $1
      `, [
        data.id, 
        data.delivery_status, 
        data.delivery_latency_ms, 
        data.error_message,
        data.message_ts
      ]);

      // Update incident notification timing
      if (data.delivery_status === 'sent' && data.delivery_latency_ms) {
        await database.query(`
          UPDATE incidents 
          SET 
            slack_notified_at = NOW(),
            first_notification_latency_ms = COALESCE(first_notification_latency_ms, $2)
          FROM slack_notifications sn
          WHERE incidents.id = sn.incident_id AND sn.id = $1
        `, [data.id, data.delivery_latency_ms]);
      }

      // Refresh materialized view
      await database.refreshDashboardSummary();
      
    } catch (error) {
      logger.error('Failed to update notification delivery:', error);
      throw error;
    }
  }

  async logWebhookRequest(data: CreateWebhookLogInput): Promise<void> {
    try {
      await database.query(`
        INSERT INTO webhook_logs (
          source, endpoint, method, headers, body, response_status,
          response_time_ms, error_message, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        data.source, data.endpoint, data.method, JSON.stringify(data.headers),
        data.body, data.response_status, data.response_time_ms,
        data.error_message, data.ip_address, data.user_agent
      ]);
      
    } catch (error) {
      logger.error('Failed to log webhook request:', error);
      // Don't throw - webhook logging shouldn't break main functionality
    }
  }

  async recordUserActivity(data: CreateUserActivityInput): Promise<void> {
    try {
      await database.query(`
        INSERT INTO user_activity (
          workspace_id, user_id, activity_type, command, channel_id,
          incident_id, response_time_ms, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        data.workspace_id, data.user_id, data.activity_type, data.command,
        data.channel_id, data.incident_id, data.response_time_ms,
        data.success, data.error_message
      ]);
      
    } catch (error) {
      logger.error('Failed to record user activity:', error);
      // Don't throw - activity logging shouldn't break main functionality
    }
  }

  /**
   * Record incident processing for dashboard analytics
   */
  async recordIncidentProcessing(data: {
    incident_number: string;
    success: boolean;
    error_message?: string | null;
    processed_at?: Date;
  }): Promise<void> {
    try {
      // Record in a simple tracking table or update existing incident
      await database.query(`
        INSERT INTO incident_processing_log (
          incident_number, success, error_message, processed_at
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (incident_number) 
        DO UPDATE SET 
          success = EXCLUDED.success,
          error_message = EXCLUDED.error_message,
          processed_at = EXCLUDED.processed_at
      `, [
        data.incident_number,
        data.success,
        data.error_message,
        data.processed_at || new Date()
      ]);
      
      logger.debug(`📊 Incident processing recorded: ${data.incident_number} - ${data.success ? 'SUCCESS' : 'FAILED'}`);
      
    } catch (error) {
      logger.error('Failed to record incident processing:', error);
      // Don't throw - analytics logging shouldn't break main functionality
    }
  }

  /**
   * Record notification delivery for dashboard analytics
   */
  async recordNotificationDelivery(data: {
    incident_number: string;
    success: boolean;
    delivery_latency_ms?: number | null;
    delivered_at?: Date;
  }): Promise<void> {
    try {
      // Ensure the notification_delivery_log table exists
      await database.query(`
        CREATE TABLE IF NOT EXISTS notification_delivery_log (
          id SERIAL PRIMARY KEY,
          incident_number VARCHAR(20) NOT NULL,
          success BOOLEAN NOT NULL DEFAULT true,
          delivery_latency_ms INTEGER,
          delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      
      // Also ensure incident_processing_log table exists  
      await database.query(`
        CREATE TABLE IF NOT EXISTS incident_processing_log (
          id SERIAL PRIMARY KEY,
          incident_number VARCHAR(20) NOT NULL UNIQUE,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT,
          processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);

      // Record in the notification tracking table
      await database.query(`
        INSERT INTO notification_delivery_log (
          incident_number, success, delivery_latency_ms, delivered_at
        ) VALUES ($1, $2, $3, $4)
      `, [
        data.incident_number,
        data.success,
        data.delivery_latency_ms,
        data.delivered_at || new Date()
      ]);
      
      logger.debug(`📊 Notification delivery recorded: ${data.incident_number} - ${data.success ? 'DELIVERED' : 'FAILED'} (${data.delivery_latency_ms || 'N/A'}ms)`);
      
    } catch (error) {
      logger.error('Failed to record notification delivery:', error);
      // Don't throw - analytics logging shouldn't break main functionality
    }
  }

  // =============================================
  // MAINTENANCE AND UTILITIES
  // =============================================

  async refreshMaterializedViews(): Promise<void> {
    try {
      await database.refreshDashboardSummary();
      logger.info('Dashboard materialized views refreshed');
    } catch (error) {
      logger.error('Failed to refresh materialized views:', error);
    }
  }

  async cleanupOldData(retentionDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      const [webhookResult, activityResult] = await Promise.all([
        database.query(`
          DELETE FROM webhook_logs 
          WHERE created_at < $1
        `, [cutoffDate]),
        
        database.query(`
          DELETE FROM user_activity 
          WHERE created_at < $1
        `, [cutoffDate])
      ]);

      logger.info(`Cleanup completed: ${webhookResult.rowCount} webhook logs, ${activityResult.rowCount} activity records removed`);
      
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
    }
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();