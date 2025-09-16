import { Router, Request, Response } from 'express';
import { slackClient } from '../services/slackClient.js';
import { notificationService } from '../services/notificationService.js';
import { serviceNowClient } from '../services/servicenow.js';
import { testSlackSignatureVerification } from '../utils/slackSecurity.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /test/slack-bot
 * Test Slack bot token and basic functionality
 */
router.post('/slack-bot', async (req: Request, res: Response) => {
  try {
    const { bot_token, test_channel } = req.body;

    if (!bot_token) {
      return res.status(400).json({
        success: false,
        error: 'Missing bot_token',
        message: 'Please provide a Slack bot token'
      });
    }

    // Set the bot token
    slackClient.setBotToken(bot_token);

    // Test the connection
    const connectionTest = await slackClient.testConnection();
    
    if (!connectionTest.success) {
      return res.json({
        success: false,
        error: 'Bot token test failed',
        message: connectionTest.message,
        details: connectionTest.error
      });
    }

    // If test channel provided, send a test message
    let messageTest = null;
    if (test_channel) {
      messageTest = await notificationService.testNotification(test_channel);
    }

    res.json({
      success: true,
      data: {
        connection: connectionTest.data,
        message_test: messageTest,
        test_channel: test_channel || null
      },
      message: 'Slack bot setup and testing completed'
    });

  } catch (error: any) {
    logger.error('Slack bot test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Bot test failed',
      message: error.message || 'Unable to test Slack bot'
    });
  }
});

/**
 * POST /test/slack-notification
 * Test ServiceNow to Slack notification flow
 */
router.post('/slack-notification', async (req: Request, res: Response) => {
  try {
    const { 
      channel_id, 
      incident_id, 
      action = 'created',
      mention_users = []
    } = req.body;

    if (!channel_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing channel_id',
        message: 'Please provide a Slack channel ID'
      });
    }

    // Configure notification settings for the channel
    notificationService.configureChannel(channel_id, {
      channel: channel_id,
      mentionUsers: mention_users,
      includeDetails: true
    });

    let incident;
    if (incident_id) {
      // Use real incident from ServiceNow
      const incidentResult = await serviceNowClient.getIncident(incident_id);
      if (!incidentResult.success) {
        return res.status(404).json({
          success: false,
          error: 'Incident not found',
          message: incidentResult.message
        });
      }
      incident = incidentResult.data;
    } else {
      // Use mock incident data for testing
      incident = {
        sys_id: 'test-incident-12345',
        number: 'INC0000123',
        short_description: 'Test notification from Nexecute Connect',
        description: 'This is a test incident to demonstrate ServiceNow to Slack notifications.',
        state: '1',
        priority: '2',
        urgency: '2',
        impact: '2',
        sys_created_on: new Date().toISOString(),
        assigned_to: {
          display_value: 'Test User'
        }
      };
    }

    // Send notification based on action type
    let result;
    switch (action) {
      case 'created':
        result = await notificationService.notifyIncidentCreated(incident, channel_id);
        break;
      case 'updated':
        result = await notificationService.notifyIncidentUpdated(incident, channel_id, ['priority', 'assigned_to']);
        break;
      case 'resolved':
        result = await notificationService.notifyIncidentResolved(incident, channel_id);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action',
          message: 'Action must be one of: created, updated, resolved'
        });
    }

    res.json({
      success: result,
      data: {
        incident: {
          number: incident.number,
          description: incident.short_description
        },
        channel_id,
        action,
        notification_sent: result
      },
      message: result ? 'Notification sent successfully' : 'Failed to send notification'
    });

  } catch (error: any) {
    logger.error('Slack notification test error:', error);
    res.status(500).json({
      success: false,
      error: 'Notification test failed',
      message: error.message || 'Unable to test notification'
    });
  }
});

/**
 * POST /test/webhook-simulation  
 * Simulate Slack webhook calls for testing
 */
router.post('/webhook-simulation', async (req: Request, res: Response) => {
  try {
    const { webhook_type = 'slash_command', payload = {} } = req.body;

    logger.info(`Simulating Slack webhook: ${webhook_type}`, payload);

    // Simulate different types of webhook calls
    switch (webhook_type) {
      case 'slash_command':
        return res.json({
          response_type: 'ephemeral',
          text: '✅ Webhook simulation successful!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Webhook Simulation Results:*\n• Type: Slash Command\n• Status: Working\n• Integration: Ready'
              }
            }
          ]
        });

      case 'interactive_component':
        return res.json({
          text: 'Button interaction processed successfully!'
        });

      case 'event_callback':
        return res.json({
          ok: true
        });

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown webhook type',
          message: 'Supported types: slash_command, interactive_component, event_callback'
        });
    }

  } catch (error: any) {
    logger.error('Webhook simulation error:', error);
    res.status(500).json({
      success: false,
      error: 'Simulation failed',
      message: error.message || 'Unable to simulate webhook'
    });
  }
});

/**
 * GET /test/signature-verification
 * Test Slack signature verification implementation
 */
router.get('/signature-verification', (req: Request, res: Response) => {
  try {
    logger.info('Testing Slack signature verification...');
    const result = testSlackSignatureVerification();
    
    res.json({
      success: result,
      test_passed: result,
      message: result 
        ? 'Slack signature verification is working correctly' 
        : 'Slack signature verification test failed',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Signature verification test error:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message || 'Unable to test signature verification'
    });
  }
});

/**
 * GET /test/webhook-urls
 * Get webhook URLs for Slack app configuration
 */
router.get('/webhook-urls', (req: Request, res: Response) => {
  const { ngrok_url } = req.query;
  const baseUrl = ngrok_url || 'http://localhost:3001';

  res.json({
    success: true,
    data: {
      base_url: baseUrl,
      webhook_urls: {
        event_subscriptions: `${baseUrl}/webhooks/slack`,
        interactive_components: `${baseUrl}/webhooks/slack/interactive`,
        slash_commands: `${baseUrl}/webhooks/slack/slash`
      },
      setup_instructions: [
        '1. Set up ngrok: ngrok http 3001',
        '2. Copy the https ngrok URL',
        '3. In Slack app settings, configure:',
        `   - Event Subscriptions URL: {ngrok_url}/webhooks/slack`,
        `   - Interactive Components URL: {ngrok_url}/webhooks/slack/interactive`,
        `   - Slash Commands URL: {ngrok_url}/webhooks/slack/slash`,
        '4. Subscribe to bot events: app_mention, message.channels',
        '5. Add OAuth scopes: chat:write, commands, channels:read',
        '6. Install app to workspace and get bot token'
      ]
    },
    message: 'Webhook URLs and setup instructions'
  });
});

/**
 * GET /test/integration-status
 * Check overall integration status
 */
router.get('/integration-status', async (req: Request, res: Response) => {
  try {
    // Check ServiceNow status
    const serviceNowStatus = await serviceNowClient.getConnectionStatus();
    
    // Check Slack status (if bot token is configured)
    let slackStatus = { success: false, message: 'Bot token not configured' };
    try {
      slackStatus = await slackClient.testConnection();
    } catch (error) {
      slackStatus = { success: false, message: 'Bot token not configured' };
    }

    const overallStatus = serviceNowStatus.success && slackStatus.success;

    res.json({
      success: true,
      data: {
        overall_status: overallStatus ? 'ready' : 'needs_configuration',
        servicenow: {
          status: serviceNowStatus.success ? 'connected' : 'disconnected',
          authenticated: serviceNowStatus.data?.authenticated || false,
          message: serviceNowStatus.message
        },
        slack: {
          status: slackStatus.success ? 'connected' : 'not_configured',
          message: slackStatus.message
        },
        webhooks: {
          endpoints_available: true,
          signature_verification: 'implemented',
          ngrok_required: true
        }
      },
      message: 'Integration status summary'
    });

  } catch (error: any) {
    logger.error('Integration status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      message: error.message || 'Unable to check integration status'
    });
  }
});

export { router as testRoutes };