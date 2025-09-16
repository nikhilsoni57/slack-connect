/**
 * Data Capture Middleware - Event-driven database population
 * Captures all webhook events and user interactions for real-time dashboard updates
 */

import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboardService.js';
import { webSocketService } from '../services/websocketService.js';
import { logger } from '../utils/logger.js';

interface SlackWebhookEvent {
  type: string;
  user?: { id: string; name?: string };
  channel?: { id: string; name?: string };
  ts?: string;
  text?: string;
  command?: string;
  response_url?: string;
  trigger_id?: string;
}

interface ServiceNowWebhookEvent {
  incident: {
    sys_id: string;
    number: string;
    state: string;
    priority: string;
    short_description: string;
    description?: string;
    category?: string;
    subcategory?: string;
    urgency?: string;
    impact?: string;
    assigned_to?: string;
    caller_id?: string;
    sys_created_on: string;
    sys_updated_on: string;
    resolved_at?: string;
  };
  event_type: 'created' | 'updated' | 'resolved';
}

export class DataCaptureMiddleware {
  
  /**
   * Capture Slack webhook events and populate dashboard data
   */
  static captureSlackEvent() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      try {
        // Log the webhook event
        await dashboardService.logWebhookRequest({
          source: 'slack',
          endpoint: req.path,
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(req.body),
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });

        // Parse Slack event
        const event = req.body as SlackWebhookEvent;
        
        // Record user activity if user interaction detected
        if (event.user?.id) {
          await dashboardService.recordUserActivity({
            workspace_id: req.body.team_id,
            user_id: event.user.id,
            activity_type: event.type || (event.command ? 'slash_command' : 'interaction'),
            command: event.command,
            channel_id: event.channel?.id,
            response_time_ms: Date.now() - startTime,
            success: true // Will be updated if error occurs
          });
        }

        // Handle slash commands
        if (event.command) {
          logger.info(`📱 Slack slash command: ${event.command} by user ${event.user?.id}`);
          
          // Track command performance
          req.commandStartTime = startTime;
          req.slackCommand = event.command;
          req.slackUser = event.user?.id;
          req.slackChannel = event.channel?.id;
          req.workspaceId = req.body.team_id;
        }

        // Continue to next middleware
        next();

      } catch (error) {
        logger.error('Slack data capture error:', error);
        
        // Log error but don't break the webhook
        try {
          await dashboardService.logWebhookRequest({
            source: 'slack',
            endpoint: req.path,
            method: req.method,
            headers: req.headers,
            body: JSON.stringify(req.body),
            response_status: 500,
            response_time_ms: Date.now() - startTime,
            error_message: String(error),
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          });
        } catch (logError) {
          logger.error('Failed to log webhook error:', logError);
        }
        
        next();
      }
    };
  }

  /**
   * Capture ServiceNow webhook events and create incidents
   */
  static captureServiceNowEvent() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      try {
        // Log the webhook event
        await dashboardService.logWebhookRequest({
          source: 'servicenow',
          endpoint: req.path,
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(req.body),
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });

        // Handle both nested incident payload and direct incident payload
        const incident = req.body.incident || req.body;
        
        if (incident && incident.number && incident.sys_id) {
          // Determine event type - if no explicit event_type, assume 'created' for new webhooks
          const eventType = req.body.event_type || req.body.operation || 'created';
          logger.info(`🎫 ServiceNow incident ${eventType}: ${incident.number}`);
          
          // Create or update incident in database
          const shouldCreateIncident = eventType === 'created' || 
                                      eventType === 'insert' || 
                                      !req.body.event_type; // No event_type means new webhook format
          
          if (shouldCreateIncident) {
            // Create new incident
            const incidentId = await dashboardService.createIncident({
              servicenow_id: incident.sys_id,
              servicenow_instance_id: 'd3c89498-583a-4710-958c-dc74bded1ca9', // Development Instance UUID
              number: incident.number,
              title: incident.short_description,
              description: incident.description,
              priority: incident.priority,
              state: incident.state,
              category: incident.category,
              subcategory: incident.subcategory,
              urgency: incident.urgency,
              impact: incident.impact,
              assigned_to: incident.assigned_to,
              caller_id: incident.caller_id,
              created_at: new Date(incident.sys_created_on || incident.created_at || new Date()),
              updated_at: new Date(incident.sys_updated_on || incident.updated_at || new Date()),
              resolved_at: incident.resolved_at ? new Date(incident.resolved_at) : undefined
            });

            // Store incident ID for Slack notification tracking
            req.incidentId = incidentId;
            req.incidentData = incident;
            
            logger.info(`📊 Incident ID stored for notification tracking: ${incidentId}`);
            
            // Notify WebSocket clients of new incident
            await webSocketService.notifyIncidentUpdate({
              ...incident,
              event_type: eventType,
              incident_id: incidentId
            });
          } else if (eventType === 'updated' || eventType === 'resolved') {
            // Handle incident updates (including activity-based response time calculation)
            logger.info(`🔄 Processing incident ${eventType}: ${incident.number}`);
            
            // Calculate incident response time if this is a P1 incident with activities
            let responseTimeMinutes: number | undefined;
            if (incident.priority === '1' && req.body.activities && req.body.activities > 0) {
              const createdAt = new Date(incident.sys_created_on || incident.created_at);
              const updatedAt = new Date(incident.sys_updated_on || incident.updated_at);
              responseTimeMinutes = Math.round((updatedAt.getTime() - createdAt.getTime()) / (1000 * 60));
              logger.info(`⏱️ P1 incident response time calculated: ${responseTimeMinutes} minutes (Activities: ${req.body.activities})`);
            }
            
            // Upsert incident (update if exists, create if missing)
            const incidentId = await dashboardService.upsertIncident(incident, {
              state: incident.state,
              priority: incident.priority,
              assigned_to: incident.assigned_to,
              updated_at: new Date(incident.sys_updated_on || incident.updated_at || new Date()),
              resolved_at: (eventType === 'resolved' || incident.resolved_at) ? 
                          new Date(incident.resolved_at || incident.sys_updated_on || new Date()) : 
                          undefined,
              incident_response_time_minutes: responseTimeMinutes
            });
            
            req.incidentId = incidentId;
            req.incidentData = incident;
            
            logger.info(`📊 Incident ${incident.number} updated (${eventType})`);
            
            // Notify WebSocket clients of incident update
            await webSocketService.notifyIncidentUpdate({
              ...incident,
              event_type: eventType,
              incident_id: incidentId,
              response_time_minutes: responseTimeMinutes
            });
          } else if (eventType === 'deleted' || eventType === 'delete') {
            // Handle incident deletion
            logger.info(`🗑️ Processing incident deletion: ${incident.number}`);
            
            // Delete incident from database
            const deleted = await dashboardService.deleteIncident(incident.sys_id);
            
            if (deleted) {
              req.incidentData = incident;
              logger.info(`📊 Incident ${incident.number} deleted from database`);
              
              // Notify WebSocket clients of incident deletion
              await webSocketService.notifyIncidentUpdate({
                ...incident,
                event_type: eventType,
                deleted: true
              });
            } else {
              logger.warn(`⚠️ Incident ${incident.number} not found for deletion`);
            }
          }
        }

        next();

      } catch (error) {
        logger.error('ServiceNow data capture error:', error);
        
        // Log error
        try {
          await dashboardService.logWebhookRequest({
            source: 'servicenow',
            endpoint: req.path,
            method: req.method,
            headers: req.headers,
            body: JSON.stringify(req.body),
            response_status: 500,
            response_time_ms: Date.now() - startTime,
            error_message: String(error),
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          });
        } catch (logError) {
          logger.error('Failed to log webhook error:', logError);
        }
        
        next();
      }
    };
  }

  /**
   * Capture Slack notification delivery and calculate metrics
   */
  static captureSlackDelivery() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Override res.json to capture successful Slack API calls
      const originalJson = res.json;
      const startTime = Date.now();

      res.json = function(data: any) {
        logger.debug(`🔍 Slack delivery capture: incidentId=${req.incidentId}, statusCode=${res.statusCode}, hasData=${!!data}`);
        
        // If this is a successful Slack notification response
        if (req.incidentId && res.statusCode < 400) {
          const deliveryTime = Date.now() - startTime;
          
          // Create notification record and track delivery
          setImmediate(async () => {
            try {
              logger.debug(`📊 Creating notification record for incident ${req.incidentId}`);
              const notificationId = await dashboardService.createSlackNotification({
                incident_id: req.incidentId,
                workspace_id: req.workspaceId || 'd3c89498-583a-4710-958c-dc74bded1ca9', // Use default workspace UUID
                channel_id: req.slackChannel || 'unknown',
                channel_name: req.slackChannelName,
                message_ts: data.ts
              });
              logger.debug(`📊 Notification created with ID: ${notificationId}`);

              // Update delivery status
              logger.debug(`📊 Updating delivery status for notification ${notificationId}`);
              await dashboardService.updateNotificationDelivery({
                id: notificationId,
                delivery_status: 'sent',
                delivery_latency_ms: deliveryTime,
                message_ts: data.ts
              });

              logger.info(`✅ Slack notification delivered in ${deliveryTime}ms`);
              
              // Notify WebSocket clients of successful delivery
              await webSocketService.notifyDeliveryUpdate({
                incident_id: req.incidentId,
                notification_id: notificationId,
                delivery_status: 'sent',
                delivery_latency_ms: deliveryTime,
                workspace_id: req.workspaceId,
                channel_id: req.slackChannel
              });

            } catch (error) {
              logger.error('Failed to track Slack notification delivery:', {
                error: error.message,
                stack: error.stack,
                incidentId: req.incidentId,
                workspaceId: req.workspaceId,
                channelId: req.slackChannel
              });
            }
          });
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Update command performance metrics after response
   */
  static updateCommandMetrics() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Hook into response finish to capture final metrics
      const originalEnd = res.end;

      res.end = function(...args: any[]) {
        if (req.slackCommand && req.commandStartTime) {
          const responseTime = Date.now() - req.commandStartTime;
          const success = res.statusCode < 400;

          setImmediate(async () => {
            try {
              await dashboardService.recordUserActivity({
                workspace_id: req.workspaceId,
                user_id: req.slackUser,
                activity_type: 'slash_command',
                command: req.slackCommand,
                channel_id: req.slackChannel,
                response_time_ms: responseTime,
                success: success,
                error_message: success ? undefined : `HTTP ${res.statusCode}`
              });
              
              // Notify WebSocket clients of command activity
              await webSocketService.notifyActivityUpdate({
                workspace_id: req.workspaceId,
                user_id: req.slackUser,
                command: req.slackCommand,
                channel_id: req.slackChannel,
                response_time_ms: responseTime,
                success: success
              });
            } catch (error) {
              logger.error('Failed to update command metrics:', error);
            }
          });
        }

        return originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * Trigger dashboard materialized view refresh after data changes
   */
  static triggerDashboardRefresh() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;

      res.json = function(data: any) {
        // If successful webhook processing, refresh dashboard data
        if (res.statusCode < 400 && (req.incidentId || req.slackCommand)) {
          setImmediate(async () => {
            try {
              await dashboardService.refreshMaterializedViews();
              logger.debug('📊 Dashboard materialized views refreshed');
            } catch (error) {
              logger.error('Failed to refresh dashboard views:', error);
            }
          });
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }
}

// Extend Express Request interface for tracking
declare global {
  namespace Express {
    interface Request {
      commandStartTime?: number;
      slackCommand?: string;
      slackUser?: string;
      slackChannel?: string;
      slackChannelName?: string;
      workspaceId?: string;
      incidentId?: string;
      incidentData?: any;
    }
  }
}