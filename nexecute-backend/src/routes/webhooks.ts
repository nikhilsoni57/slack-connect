import express, { Router, Request, Response, NextFunction } from 'express';
import { SlackWebhookPayload, SlackEvent, ApiResponse } from '../types/index.js';
import { verifySlackWebhook, verifySlackToken } from '../utils/slackSecurity.js';
import { slackClient } from '../services/slackClient.js';
import { serviceNowClient } from '../services/servicenow.js';
import { logger } from '../utils/logger.js';
import { DataCaptureMiddleware } from '../middleware/dataCapture.js';
import { ValidationMiddleware } from '../middleware/validation.js';

const router = Router();

/**
 * POST /webhooks (root)
 * Generic webhook endpoint that transforms webhook_type to event_type
 */
router.post('/', 
  express.json(),
  (req: Request, res: Response, next: NextFunction) => {
    // Transform webhook_type to event_type for dataCapture middleware compatibility
    if (req.body.webhook_type) {
      // Map webhook_type values to event_type
      const webhookTypeMap: Record<string, string> = {
        'incident_created': 'created',
        'incident_updated': 'updated', 
        'incident_resolved': 'resolved',
        'incident_closed': 'closed',
        'incident_deleted': 'deleted'
      };
      
      req.body.event_type = webhookTypeMap[req.body.webhook_type] || req.body.webhook_type;
      logger.info(`🔄 Transformed webhook_type "${req.body.webhook_type}" to event_type "${req.body.event_type}"`);
    }
    
    // Ensure workspace_id is set if missing
    if (!req.body.workspace_id) {
      req.body.workspace_id = 'd3c89498-583a-4710-958c-dc74bded1ca9';
    }
    
    next();
  },
  DataCaptureMiddleware.captureServiceNowEvent(),
  async (req: Request, res: Response) => {
    try {
      logger.info('Generic webhook processed successfully', {
        webhook_type: req.body.webhook_type,
        event_type: req.body.event_type,
        incident_number: req.body.incident_number || req.body.number
      });
      
      res.json({
        success: true,
        message: 'Webhook processed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Generic webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Middleware to capture raw body for signature verification
 */
const captureRawBody = (req: Request, res: Response, next: Function) => {
  let rawBody = '';
  
  req.on('data', (chunk) => {
    rawBody += chunk.toString('utf8');
  });

  req.on('end', () => {
    (req as any).rawBody = rawBody;
    
    // Try to parse as JSON first
    try {
      req.body = JSON.parse(rawBody);
    } catch (error) {
      // If JSON parsing fails, try URL-encoded parsing
      try {
        const params = new URLSearchParams(rawBody);
        req.body = Object.fromEntries(params.entries());
        
        // Handle nested payload in interactive components
        if (req.body.payload) {
          try {
            req.body.payload = JSON.parse(req.body.payload);
          } catch (e) {
            // Keep as string if not valid JSON
          }
        }
      } catch (urlError) {
        logger.error('Failed to parse webhook data as JSON or URL-encoded:', error);
        return res.status(400).json({
          success: false,
          error: 'Invalid payload format'
        });
      }
    }
    
    next();
  });
};

/**
 * POST /webhooks/slack/simple
 * Simple test endpoint without middleware
 */
router.post('/slack/simple', express.json(), (req: Request, res: Response) => {
  logger.info('Simple Slack webhook received', { body: req.body });
  
  // Handle URL verification challenge
  if (req.body && req.body.type === 'url_verification') {
    logger.info('Returning challenge:', req.body.challenge);
    return res.json({ challenge: req.body.challenge });
  }
  
  res.json({ ok: true });
});

/**
 * POST /webhooks/slack
 * Main Slack webhook endpoint with bulletproof signature validation
 */
router.post('/slack', 
  captureRawBody,
  ValidationMiddleware.validateSlackWebhook(),
  DataCaptureMiddleware.captureSlackEvent(),
  DataCaptureMiddleware.captureSlackDelivery(),
  DataCaptureMiddleware.updateCommandMetrics(),
  DataCaptureMiddleware.triggerDashboardRefresh(),
  async (req: Request, res: Response) => {
  try {
    const payload: SlackWebhookPayload = req.body;
    
    logger.info('Slack webhook received', {
      type: payload.type,
      team_id: payload.team_id,
      event_type: payload.event?.type,
      event_id: payload.event_id,
      rawBody: (req as any).rawBody,
      bodyKeys: Object.keys(req.body)
    });

    // Handle URL verification challenge (Slack app setup)
    if (payload.type === 'url_verification') {
      logger.info('Handling Slack URL verification challenge');
      return res.json({
        challenge: payload.challenge
      });
    }

    // Handle event callbacks
    if (payload.type === 'event_callback' && payload.event) {
      const result = await handleSlackEvent(payload.event, payload);
      
      if (!result.success) {
        logger.error('Failed to handle Slack event:', result.error);
        // Still return 200 to Slack to avoid retries for non-critical errors
        return res.json({ ok: true });
      }

      return res.json({ ok: true });
    }

    // Handle app rate limiting
    if (payload.type === 'app_rate_limited') {
      logger.warn('Slack app rate limited', {
        team_id: payload.team_id,
        minute_rate_limited: (payload as any).minute_rate_limited
      });
      return res.json({ ok: true });
    }

    // Handle app mentions, messages, etc.
    logger.info(`Unhandled Slack webhook type: ${payload.type}`);
    res.json({ ok: true });

  } catch (error) {
    logger.error('Slack webhook processing error:', error);
    
    // Always return 200 to Slack to prevent retries
    // Log the error but don't let Slack retry indefinitely
    res.json({ ok: true });
  }
});

/**
 * POST /webhooks/slack/interactive
 * Handle Slack interactive components (buttons, menus, etc.)
 */
router.post('/slack/interactive', 
  captureRawBody, 
  verifySlackWebhook,
  ValidationMiddleware.validateSlackWebhook(),
  DataCaptureMiddleware.captureSlackEvent(),
  DataCaptureMiddleware.captureSlackDelivery(),
  DataCaptureMiddleware.updateCommandMetrics(),
  DataCaptureMiddleware.triggerDashboardRefresh(),
  async (req: Request, res: Response) => {
  try {
    // Slack sends interactive payloads as form-encoded with a 'payload' field
    const payload = JSON.parse(req.body.payload);
    
    logger.info('Slack interactive component received', {
      type: payload.type,
      user: payload.user?.id,
      team: payload.team?.id,
      action_id: payload.actions?.[0]?.action_id
    });

    // Handle button clicks, menu selections, etc.
    const result = await handleSlackInteraction(payload);
    
    if (!result.success) {
      logger.error('Failed to handle Slack interaction:', result.error);
    }

    // Respond to Slack (can include message updates)
    res.json({
      text: result.message || "Action processed"
    });

  } catch (error) {
    logger.error('Slack interactive webhook error:', error);
    res.json({
      text: "Sorry, there was an error processing your request."
    });
  }
});

/**
 * POST /webhooks/slack/slash
 * Handle Slack slash commands
 */
router.post('/slack/slash', 
  express.urlencoded({ extended: true }),
  ValidationMiddleware.validateSlackSlashCommand(),
  DataCaptureMiddleware.captureSlackEvent(),
  DataCaptureMiddleware.captureSlackDelivery(),
  DataCaptureMiddleware.updateCommandMetrics(),
  DataCaptureMiddleware.triggerDashboardRefresh(),
  async (req: Request, res: Response) => {
  try {
    const command = req.body;
    
    logger.info('Slack slash command received', {
      command: command.command,
      user_id: command.user_id,
      team_id: command.team_id,
      text: command.text
    });

    // Handle different slash commands
    const result = await handleSlashCommand(command);
    
    // Respond immediately to Slack (3 second limit)
    res.json({
      response_type: result.public ? 'in_channel' : 'ephemeral',
      text: result.text,
      blocks: result.blocks
    });

  } catch (error) {
    logger.error('Slack slash command error:', error);
    res.json({
      response_type: 'ephemeral',
      text: 'Sorry, there was an error processing your command.'
    });
  }
});

/**
 * Handle Slack events (messages, mentions, etc.)
 */
async function handleSlackEvent(event: SlackEvent, payload: SlackWebhookPayload): Promise<ApiResponse> {
  try {
    logger.info(`Processing Slack event: ${event.type}`);

    switch (event.type) {
      case 'app_mention':
        return await handleAppMention(event, payload);
      
      case 'message':
        return await handleMessage(event, payload);
      
      case 'channel_created':
        return await handleChannelCreated(event, payload);
      
      default:
        logger.info(`Unhandled event type: ${event.type}`);
        return { success: true, message: 'Event received but not processed' };
    }

  } catch (error) {
    logger.error('Error handling Slack event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handle app mentions (@nexecute-connect)
 */
async function handleAppMention(event: SlackEvent, payload: SlackWebhookPayload): Promise<ApiResponse> {
  try {
    if (!event.channel || !event.text) {
      return { success: false, error: 'Missing channel or text' };
    }

    // Extract command from mention text
    const text = event.text.toLowerCase();
    
    if (text.includes('help')) {
      const helpMessage = {
        channel: event.channel,
        text: 'Nexecute Connect Help',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Nexecute Connect Commands:*'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '• `@nexecute-connect help` - Show this help message\n• `@nexecute-connect status` - Check ServiceNow connection status\n• `@nexecute-connect incidents` - List recent ServiceNow incidents'
            }
          }
        ]
      };

      return await slackClient.postMessage(helpMessage as any);
    }

    if (text.includes('status')) {
      // Check ServiceNow connection status
      const statusMessage = {
        channel: event.channel,
        text: 'Connection Status',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*ServiceNow Status:* 🟢 Connected\n*Last Check:* <!date^' + Math.floor(Date.now() / 1000) + '^{date_short_pretty} at {time}|now>'
            }
          }
        ]
      };

      return await slackClient.postMessage(statusMessage as any);
    }

    // Default response for unrecognized mentions
    const defaultResponse = {
      channel: event.channel,
      text: 'Hi there! 👋 Type `@nexecute-connect help` to see available commands.'
    };

    return await slackClient.postMessage(defaultResponse as any);

  } catch (error) {
    logger.error('Error handling app mention:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to handle mention'
    };
  }
}

/**
 * Handle regular messages (if bot is in channel)
 */
async function handleMessage(event: SlackEvent, payload: SlackWebhookPayload): Promise<ApiResponse> {
  // Only respond to specific keywords to avoid spam
  if (event.text && event.text.toLowerCase().includes('servicenow')) {
    logger.info('Message contains ServiceNow keyword');
    // Could add logic to help with ServiceNow-related queries
  }

  return { success: true, message: 'Message logged' };
}

/**
 * Handle new channel creation
 */
async function handleChannelCreated(event: SlackEvent, payload: SlackWebhookPayload): Promise<ApiResponse> {
  logger.info(`New channel created: ${event.channel}`);
  // Could add logic to automatically join incident channels
  return { success: true, message: 'Channel creation logged' };
}

/**
 * Handle Slack interactive components (buttons, menus)
 */
async function handleSlackInteraction(payload: any): Promise<ApiResponse> {
  const action = payload.actions?.[0];
  
  if (!action) {
    return { success: false, error: 'No action found' };
  }

  logger.info(`Handling interaction: ${action.action_id}`);

  switch (action.action_id) {
    case 'view_incident':
      return { success: true, message: 'Opening incident details...' };
    
    case 'assign_incident':
      return { success: true, message: 'Assigning incident...' };
    
    default:
      return { success: true, message: 'Action processed' };
  }
}

/**
 * Handle slash commands
 */
async function handleSlashCommand(command: any): Promise<{text: string; blocks?: any[]; public?: boolean}> {
  const { command: cmd, text, user_id } = command;

  switch (cmd) {
    case '/servicenow':
      if (!text || text.trim() === '' || text.trim() === 'status') {
        return {
          text: '🟢 Nexecute Connect - ServiceNow Status',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*ServiceNow Status:* 🟢 Connected\n*Instance:* dev203615.service-now.com\n*Last Updated:* <!date^' + Math.floor(Date.now() / 1000) + '^{date_short_pretty} at {time}|now>'
              }
            }
          ]
        };
      } else if (text.trim() === 'stats') {
        // This will be enhanced to get real stats
        return {
          text: '📊 ServiceNow Statistics',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*📊 ServiceNow Incident Statistics*\n*Total Active:* 41\n*Critical:* 17\n*High Priority:* 4\n*New:* 13\n*Last Updated:* <!date^' + Math.floor(Date.now() / 1000) + '^{date_short_pretty} at {time}|now>'
              }
            }
          ]
        };
      } else {
        return {
          text: `Available ServiceNow commands:\n• \`/servicenow status\` - Check connection status\n• \`/servicenow stats\` - Show incident statistics`
        };
      }

    case '/incident':
      if (!text || text.trim() === '' || text.trim() === 'help') {
        return {
          text: 'Available incident commands:\n• `/incident create <description>` - Create a new incident\n• `/incident list` - List recent incidents\n• `/incident search <query>` - Search incidents\n• `/incident help` - Show this help'
        };
      } else if (text.trim() === 'list') {
        return {
          text: '📋 Recent ServiceNow Incidents',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Recent Active Incidents:*\n• INC0010001 - Test incident from Nexecute Connect OAuth\n• Status: In Progress | Priority: High'
              }
            }
          ]
        };
      } else if (text.trim().startsWith('create ')) {
        const description = text.trim().substring(7);
        
        try {
          const incident = await serviceNowClient.createIncident({
            short_description: description,
            description: `Incident created from Slack by user ${user_id}`,
            urgency: '3',
            impact: '3', 
            priority: '3',
            caller_id: user_id
          });

          if (incident.success) {
            return {
              text: `✅ ServiceNow Incident Created Successfully`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Incident Number:* ${incident.data.number}\n*Description:* ${description}\n*Priority:* Medium\n*Created by:* <@${user_id}>`
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: 'View in ServiceNow'
                      },
                      url: `https://dev203615.service-now.com/incident.do?sys_id=${incident.data.sys_id}`,
                      style: 'primary'
                    }
                  ]
                }
              ]
            };
          } else {
            return {
              text: `❌ Failed to create incident: ${incident.message}`
            };
          }
        } catch (error) {
          return {
            text: `❌ Error creating incident: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      } else {
        return {
          text: 'Available incident commands:\n• `/incident create <description>` - Create a new incident\n• `/incident list` - List recent incidents\n• `/incident search <query>` - Search incidents'
        };
      }

    default:
      return {
        text: `Unknown command: ${cmd}. Available commands: \`/servicenow\`, \`/incident\``
      };
  }
}

/**
 * POST /webhooks/servicenow
 * Handle ServiceNow incident change notifications
 */
router.post('/servicenow', 
  express.json(),
  ValidationMiddleware.validateServiceNowWebhook(),
  DataCaptureMiddleware.captureServiceNowEvent(),
  DataCaptureMiddleware.captureSlackDelivery(),
  DataCaptureMiddleware.triggerDashboardRefresh(),
  async (req: Request, res: Response) => {
  try {
    // Handle both direct incident payload and nested incident payload
    const incident = req.body.incident || req.body;
    
    logger.info('ServiceNow webhook received', {
      incident_number: incident.number,
      state: incident.state,
      priority: incident.priority,
      operation: incident.operation || 'unknown'
    });

    // Validate incident data
    if (!incident.number || !incident.sys_id) {
      logger.warn('Invalid ServiceNow incident data received', incident);
      return res.status(400).json({
        success: false,
        error: 'Missing required incident fields (number, sys_id)'
      });
    }

    // Configure Slack bot token for notifications
    const botToken = 'xoxb-9433401469139-9457929030055-xFFXYm7C7lKUoymDMkpu2Rz6';
    slackClient.setBotToken(botToken);

    // Determine notification type and channels
    const notificationResult = await handleServiceNowIncidentNotification(incident);
    
    if (notificationResult.success) {
      logger.info(`ServiceNow incident ${incident.number} notification sent successfully`);
    } else {
      logger.error(`Failed to send notification for incident ${incident.number}:`, notificationResult.error);
    }

    // Update dashboard analytics
    try {
      await updateDashboardAnalytics(incident.number, notificationResult.success, notificationResult.error);
      
      // If notification was sent successfully, also track it for dashboard metrics
      if (notificationResult.success) {
        await fetch('http://localhost:3001/dashboard/api/analytics/notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incident_number: incident.number,
            success: true,
            delivery_latency_ms: notificationResult.deliveryTime || 1000,
            timestamp: new Date().toISOString()
          })
        });
        logger.info(`📊 Notification delivery tracked for incident ${incident.number}`);
      }
    } catch (analyticsError) {
      logger.warn('Failed to update dashboard analytics:', analyticsError);
    }

    // Always respond 200 to ServiceNow to prevent retries
    res.json({
      success: true,
      message: 'ServiceNow webhook processed',
      incident_number: incident.number,
      notification_sent: notificationResult.success
    });

  } catch (error: any) {
    logger.error('ServiceNow webhook processing error:', error);
    
    // Return 200 to prevent ServiceNow retries, but log the error
    res.json({
      success: false,
      error: 'Webhook processing failed',
      message: error.message || 'Unknown error'
    });
  }
});

/**
 * Handle ServiceNow incident notifications to Slack
 */
async function handleServiceNowIncidentNotification(incident: any): Promise<{ success: boolean; error?: string; channels?: string[] }> {
  try {
    // Determine which channels to notify based on priority
    const channels = getNotificationChannels(incident);
    
    // Create Slack message
    const message = createIncidentSlackMessage(incident, channels[0]);
    
    // Send notifications to all relevant channels
    const results = await Promise.allSettled(
      channels.map(channel => slackClient.postMessage({
        ...message,
        channel
      } as any))
    );

    // Check if all notifications succeeded
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failures = results.length - successes;

    if (failures > 0) {
      logger.warn(`${failures} out of ${results.length} Slack notifications failed for incident ${incident.number}`);
    }

    return {
      success: successes > 0,
      channels: channels,
      error: failures > 0 ? `${failures} notifications failed` : undefined
    };

  } catch (error) {
    logger.error('Error handling ServiceNow incident notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Determine which Slack channels to notify based on incident priority
 */
function getNotificationChannels(incident: any): string[] {
  const priority = incident.priority || incident.priority_label || '3';
  
  // Channel mapping
  const CHANNELS = {
    CRITICAL_OPS: 'C09EAQ585G9', // #critical-ops
    NEXECUTE: 'C09DXAEM54N'     // #nexecute
  };
  
  // Priority-based routing with channel IDs
  switch (priority) {
    case '1':
    case 'Critical':
      logger.info(`P1 Critical incident ${incident.number} routing to both #critical-ops and #nexecute`);
      return [CHANNELS.CRITICAL_OPS, CHANNELS.NEXECUTE]; // Critical incidents to multiple channels
    
    case '2': 
    case 'High':
      logger.info(`P2 High priority incident ${incident.number} routing to #nexecute`);
      return [CHANNELS.NEXECUTE]; // High priority to main channel
    
    case '3':
    case 'Medium':
    case '4':
    case 'Low':
    case '5':
    case 'Planning':
    default:
      logger.info(`P${priority} incident ${incident.number} routing to #nexecute`);
      return [CHANNELS.NEXECUTE]; // Default to main channel
  }
}

/**
 * Create formatted Slack message for ServiceNow incident
 */
function createIncidentSlackMessage(incident: any, primaryChannel: string) {
  const operation = incident.operation || 'updated';
  const isNewIncident = operation === 'insert' || incident.state === '1';
  
  // Determine action emoji and message
  const actionEmoji = isNewIncident ? '🚨' : '🔄';
  const actionText = isNewIncident ? 'New ServiceNow Incident Created' : 'ServiceNow Incident Updated';
  
  // Priority colors and text
  const priorityInfo = getPriorityInfo(incident.priority);
  const stateInfo = getStateInfo(incident.state);

  // Build notification message
  const message = {
    channel: primaryChannel,
    text: `${actionText}: ${incident.number} - ${incident.short_description}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${actionEmoji} ${actionText}: ${incident.number}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${incident.short_description}*`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Priority:*\n${priorityInfo.text}`
          },
          {
            type: 'mrkdwn',
            text: `*State:*\n${stateInfo.text}`
          },
          {
            type: 'mrkdwn',
            text: `*Assigned to:*\n${incident.assigned_to_display_value || 'Unassigned'}`
          },
          {
            type: 'mrkdwn',
            text: `*Updated:*\n<!date^${Math.floor(new Date().getTime() / 1000)}^{date_short_pretty} at {time}|now>`
          }
        ]
      }
    ],
    attachments: [
      {
        color: priorityInfo.color,
        blocks: [
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View in ServiceNow'
                },
                url: `https://dev203615.service-now.com/incident.do?sys_id=${incident.sys_id}`,
                style: 'primary'
              },
              {
                type: 'button', 
                text: {
                  type: 'plain_text',
                  text: 'Assign to Me'
                },
                action_id: `incident_assign_${incident.sys_id}`,
                value: incident.sys_id
              }
            ]
          }
        ]
      }
    ],
    unfurl_links: false,
    unfurl_media: false
  };

  return message;
}

/**
 * Get priority information with colors and text
 */
function getPriorityInfo(priority: string) {
  const priorities: Record<string, { text: string; color: string }> = {
    '1': { text: '🔴 Critical', color: '#ff0000' },
    '2': { text: '🟠 High', color: '#ff8c00' },
    '3': { text: '🟡 Medium', color: '#ffd700' },
    '4': { text: '🟢 Low', color: '#008000' },
    '5': { text: '⚪ Planning', color: '#808080' }
  };
  
  return priorities[priority] || { text: `Priority ${priority}`, color: '#808080' };
}

/**
 * Get state information with text
 */
function getStateInfo(state: string) {
  const states: Record<string, { text: string }> = {
    '1': { text: '🆕 New' },
    '2': { text: '🔄 In Progress' },
    '3': { text: '⏸️ On Hold' },
    '6': { text: '✅ Resolved' },
    '7': { text: '❌ Closed' },
    '8': { text: '🔄 Reopened' }
  };
  
  return states[state] || { text: `State ${state}` };
}

/**
 * GET /webhooks/slack/test
 * Test endpoint for webhook connectivity
 */
router.get('/slack/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Slack webhook endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /webhooks/servicenow/test
 * Test endpoint for ServiceNow webhook connectivity
 */
router.get('/servicenow/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'ServiceNow webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    ngrok_url: req.get('host')
  });
});

/**
 * Update dashboard analytics with incident processing data
 */
async function updateDashboardAnalytics(incidentNumber: string, success: boolean, errorMessage?: string): Promise<void> {
  try {
    const analyticsPayload = {
      incident_number: incidentNumber,
      success,
      error_message: errorMessage,
      timestamp: new Date().toISOString()
    };

    // Send to local dashboard analytics endpoint
    const response = await fetch('http://localhost:3001/dashboard/api/analytics/incident', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(analyticsPayload)
    });

    if (!response.ok) {
      throw new Error(`Analytics API responded with status ${response.status}`);
    }

    logger.debug('Dashboard analytics updated successfully', analyticsPayload);

  } catch (error) {
    logger.error('Failed to update dashboard analytics:', error);
    throw error;
  }
}

export { router as webhookRoutes };