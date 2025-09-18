import { slackClient } from './slackClient.js';
import { serviceNowClient } from './servicenow.js';
import { logger } from '../utils/logger.js';
import { SlackMessageRequest } from '../types/index.js';

export interface NotificationSettings {
  channel: string;
  mentionUsers?: string[];
  includeDetails?: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private slackChannels: Map<string, NotificationSettings> = new Map();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Configure notification settings for a channel
   */
  public configureChannel(channelId: string, settings: NotificationSettings): void {
    this.slackChannels.set(channelId, settings);
    logger.info(`Notification settings configured for channel: ${channelId}`, settings);
  }

  /**
   * Send ServiceNow incident notification to Slack
   */
  public async notifyIncidentCreated(incident: any, channelId?: string): Promise<boolean> {
    try {
      const channels = channelId 
        ? [channelId] 
        : Array.from(this.slackChannels.keys());

      if (channels.length === 0) {
        logger.warn('No Slack channels configured for notifications');
        return false;
      }

      const results = await Promise.all(
        channels.map(channel => this.sendIncidentNotification(incident, channel, 'created'))
      );

      return results.every(result => result);

    } catch (error) {
      logger.error('Error sending incident creation notification:', error);
      return false;
    }
  }

  /**
   * Send ServiceNow incident update notification to Slack
   */
  public async notifyIncidentUpdated(incident: any, channelId?: string, changes?: string[]): Promise<boolean> {
    try {
      const channels = channelId 
        ? [channelId] 
        : Array.from(this.slackChannels.keys());

      if (channels.length === 0) {
        logger.warn('No Slack channels configured for notifications');
        return false;
      }

      const results = await Promise.all(
        channels.map(channel => this.sendIncidentNotification(incident, channel, 'updated', changes))
      );

      return results.every(result => result);

    } catch (error) {
      logger.error('Error sending incident update notification:', error);
      return false;
    }
  }

  /**
   * Send ServiceNow incident resolution notification to Slack
   */
  public async notifyIncidentResolved(incident: any, channelId?: string): Promise<boolean> {
    try {
      const channels = channelId 
        ? [channelId] 
        : Array.from(this.slackChannels.keys());

      if (channels.length === 0) {
        logger.warn('No Slack channels configured for notifications');
        return false;
      }

      const results = await Promise.all(
        channels.map(channel => this.sendIncidentNotification(incident, channel, 'resolved'))
      );

      return results.every(result => result);

    } catch (error) {
      logger.error('Error sending incident resolution notification:', error);
      return false;
    }
  }

  /**
   * Send incident notification to a specific channel
   */
  private async sendIncidentNotification(
    incident: any, 
    channelId: string, 
    action: 'created' | 'updated' | 'resolved',
    changes?: string[]
  ): Promise<boolean> {
    try {
      const settings = this.slackChannels.get(channelId) || { channel: channelId };
      
      const message = this.buildIncidentMessage(incident, action, settings, changes);
      const result = await slackClient.postMessage(message);

      if (result.success) {
        logger.info(`Incident ${action} notification sent to ${channelId}`, {
          incident: incident.number,
          channel: channelId,
          action
        });
        return true;
      } else {
        logger.error(`Failed to send incident notification to ${channelId}:`, result.error);
        return false;
      }

    } catch (error) {
      logger.error(`Error sending incident notification to ${channelId}:`, error);
      return false;
    }
  }

  /**
   * Build incident notification message for Slack
   */
  private buildIncidentMessage(
    incident: any, 
    action: 'created' | 'updated' | 'resolved',
    settings: NotificationSettings,
    changes?: string[]
  ): SlackMessageRequest {
    const actionEmoji = {
      created: '🚨',
      updated: '🔄', 
      resolved: '✅'
    };

    const actionText = {
      created: 'New ServiceNow Incident',
      updated: 'ServiceNow Incident Updated',
      resolved: 'ServiceNow Incident Resolved'
    };

    // Create mention string
    const mentions = settings.mentionUsers?.length 
      ? settings.mentionUsers.map(user => `<@${user}>`).join(' ') + '\n'
      : '';

    // Priority color mapping
    const priorityColors: Record<string, string> = {
      '1': '#ff0000', // Critical - Red
      '2': '#ff8c00', // High - Orange  
      '3': '#ffd700', // Medium - Yellow
      '4': '#008000', // Low - Green
      '5': '#808080'  // Planning - Gray
    };

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${actionEmoji[action]} ${actionText[action]}: ${incident.number}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${mentions}*${incident.short_description}*`
        }
      }
    ];

    if (settings.includeDetails !== false) {
      const fields = [
        {
          type: 'mrkdwn',
          text: `*Priority:*\n${this.getPriorityText(incident.priority)}`
        },
        {
          type: 'mrkdwn', 
          text: `*State:*\n${this.getStateText(incident.state)}`
        },
        {
          type: 'mrkdwn',
          text: `*Assigned to:*\n${incident.assigned_to?.display_value || 'Unassigned'}`
        },
        {
          type: 'mrkdwn',
          text: `*Created:*\n<!date^${Math.floor(new Date(incident.sys_created_on).getTime() / 1000)}^{date_short_pretty} at {time}|${incident.sys_created_on}>`
        }
      ];

      if (action === 'updated' && changes?.length) {
        fields.push({
          type: 'mrkdwn',
          text: `*Changes:*\n${changes.join(', ')}`
        });
      }

      blocks.push({
        type: 'section' as const,
        fields
      });

      if (incident.description && action === 'created') {
        blocks.push({
          type: 'section' as const,
          text: {
            type: 'mrkdwn' as const,
            text: `*Description:*\n${incident.description.length > 200 ? incident.description.substring(0, 200) + '...' : incident.description}`
          }
        });
      }

      // Add action buttons for non-resolved incidents
      if (action !== 'resolved') {
        blocks.push({
          type: 'actions' as const,
          elements: [
            {
              type: 'button' as const,
              text: {
                type: 'plain_text' as const,
                text: 'View in ServiceNow'
              },
              url: `${serviceNowClient.getConfig().instanceUrl}/incident.do?sys_id=${incident.sys_id}`,
              style: 'primary'
            },
            {
              type: 'button' as const,
              text: {
                type: 'plain_text' as const,
                text: 'Assign to Me'
              },
              action_id: `incident_assign_${incident.sys_id}`,
              value: incident.sys_id
            }
          ]
        });
      }
    }

    return {
      channel: settings.channel,
      text: `${actionText[action]}: ${incident.number} - ${incident.short_description}`,
      blocks: blocks as any, // Emergency type bypass for Slack Block API deployment
      unfurl_links: false,
      unfurl_media: false
    };
  }

  /**
   * Test notification functionality
   */
  public async testNotification(channelId: string): Promise<boolean> {
    try {
      const testMessage: SlackMessageRequest = {
        channel: channelId,
        text: '🧪 Test Notification from Nexecute Connect',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*🧪 Test Notification*\n\nThis is a test message to verify that Slack notifications are working properly.\n\n*ServiceNow Integration:* Ready\n*Time:* <!date^' + Math.floor(Date.now() / 1000) + '^{date_short_pretty} at {time}|now>'
            }
          }
        ]
      };

      const result = await slackClient.postMessage(testMessage);
      
      if (result.success) {
        logger.info(`Test notification sent successfully to ${channelId}`);
        return true;
      } else {
        logger.error(`Test notification failed for ${channelId}:`, result.error);
        return false;
      }

    } catch (error) {
      logger.error('Error sending test notification:', error);
      return false;
    }
  }

  private getPriorityText(priority: string): string {
    const priorities: Record<string, string> = {
      '1': '🔴 Critical',
      '2': '🟠 High',
      '3': '🟡 Medium', 
      '4': '🟢 Low',
      '5': '⚪ Planning'
    };
    return priorities[priority] || `Priority ${priority}`;
  }

  private getStateText(state: string): string {
    const states: Record<string, string> = {
      '1': '🆕 New',
      '2': '🔄 In Progress',
      '3': '⏸️ On Hold',
      '6': '✅ Resolved',
      '7': '❌ Closed',
      '8': '🔄 Reopened'
    };
    return states[state] || `State ${state}`;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();