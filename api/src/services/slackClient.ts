import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config/environment.js';
import { SlackMessageRequest, SlackBlock, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface SlackApiResponse<T = any> {
  ok: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
    messages?: string[];
  };
  data?: T;
  [key: string]: any;
}

export interface SlackMessageResponse {
  ok: boolean;
  channel: string;
  ts: string;
  message: {
    text: string;
    user: string;
    ts: string;
    type: string;
    [key: string]: any;
  };
}

export interface SlackChannelInfo {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  created: number;
  creator: string;
  is_archived: boolean;
  is_general: boolean;
  name_normalized: string;
  is_shared: boolean;
  is_ext_shared: boolean;
  is_org_shared: boolean;
  pending_shared: string[];
  is_pending_ext_shared: boolean;
  is_member: boolean;
  topic: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose: {
    value: string;
    creator: string;
    last_set: number;
  };
  num_members?: number;
}

class SlackClient {
  private client: AxiosInstance;
  private botToken?: string;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://slack.com/api/',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Nexecute-Connect/1.0'
      }
    });

    // Add request interceptor to add auth header
    this.client.interceptors.request.use((config) => {
      if (this.botToken) {
        config.headers.Authorization = `Bearer ${this.botToken}`;
      }
      return config;
    });

    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Slack API ${response.config.url} - Success`, {
          status: response.status,
          ok: response.data?.ok
        });
        return response;
      },
      (error) => {
        logger.error(`Slack API ${error.config?.url} - Error`, {
          status: error.response?.status,
          error: error.response?.data?.error,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set the bot token for API calls
   */
  setBotToken(token: string): void {
    this.botToken = token;
    logger.info('Slack bot token configured');
  }

  /**
   * Test API connection and token validity
   */
  async testConnection(): Promise<ApiResponse<any>> {
    try {
      if (!this.botToken) {
        return {
          success: false,
          error: 'No bot token configured',
          message: 'Please configure Slack bot token first'
        };
      }

      const response: AxiosResponse<SlackApiResponse> = await this.client.get('auth.test');

      if (!response.data.ok) {
        return {
          success: false,
          error: response.data.error,
          message: 'Slack API authentication failed'
        };
      }

      logger.info('Slack connection test successful', {
        team: response.data.team,
        user: response.data.user,
        team_id: response.data.team_id,
        user_id: response.data.user_id
      });

      return {
        success: true,
        data: {
          team: response.data.team,
          user: response.data.user,
          team_id: response.data.team_id,
          user_id: response.data.user_id,
          url: response.data.url
        },
        message: 'Slack connection successful'
      };

    } catch (error: any) {
      logger.error('Slack connection test failed:', error);
      
      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error,
          message: 'Slack API error'
        };
      }

      return {
        success: false,
        error: 'Connection failed',
        message: error.message || 'Unable to connect to Slack API'
      };
    }
  }

  /**
   * Send a message to a Slack channel
   */
  async postMessage(messageRequest: SlackMessageRequest): Promise<ApiResponse<SlackMessageResponse>> {
    try {
      if (!this.botToken) {
        return {
          success: false,
          error: 'No bot token configured',
          message: 'Please configure Slack bot token first'
        };
      }

      // Validate required fields
      if (!messageRequest.channel) {
        return {
          success: false,
          error: 'Missing channel',
          message: 'Channel is required for posting messages'
        };
      }

      if (!messageRequest.text && !messageRequest.blocks) {
        return {
          success: false,
          error: 'Missing content',
          message: 'Either text or blocks are required for posting messages'
        };
      }

      logger.info(`Sending message to Slack channel: ${messageRequest.channel}`);

      const response: AxiosResponse<SlackApiResponse<SlackMessageResponse>> = await this.client.post('chat.postMessage', messageRequest);

      if (!response.data.ok) {
        logger.error('Failed to send Slack message:', response.data.error);
        return {
          success: false,
          error: response.data.error,
          message: 'Failed to send message to Slack'
        };
      }

      logger.info(`Message sent successfully to ${messageRequest.channel}`, {
        ts: response.data.ts,
        channel: response.data.channel
      });

      return {
        success: true,
        data: response.data as SlackMessageResponse,
        message: 'Message sent successfully'
      };

    } catch (error: any) {
      logger.error('Error sending Slack message:', error);
      
      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error,
          message: `Slack API error: ${error.response.data.error}`
        };
      }

      return {
        success: false,
        error: 'Send failed',
        message: error.message || 'Failed to send message'
      };
    }
  }

  /**
   * Create ServiceNow incident notification message
   */
  createIncidentNotification(
    incident: any, 
    options: {
      channel: string;
      includeDetails?: boolean;
      mentionUsers?: string[];
    }
  ): SlackMessageRequest {
    const { channel, includeDetails = true, mentionUsers = [] } = options;
    
    // Create mention string
    const mentions = mentionUsers.length > 0 
      ? mentionUsers.map(user => `<@${user}>`).join(' ') + '\n'
      : '';

    // Priority color mapping
    const priorityColors: Record<string, string> = {
      '1': '#ff0000', // Critical - Red
      '2': '#ff8c00', // High - Orange  
      '3': '#ffd700', // Medium - Yellow
      '4': '#008000', // Low - Green
      '5': '#808080'  // Planning - Gray
    };

    const color = priorityColors[incident.priority] || '#808080';

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 New ServiceNow Incident: ${incident.number}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${incident.short_description}*`
        }
      }
    ];

    if (includeDetails) {
      blocks.push({
        type: 'section',
        fields: [
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
            text: `*Caller:*\n${incident.caller_id?.display_value || 'Unknown'}`
          },
          {
            type: 'mrkdwn',
            text: `*Created:*\n<!date^${Math.floor(new Date(incident.sys_created_on).getTime() / 1000)}^{date_short_pretty} at {time}|${incident.sys_created_on}>`
          }
        ]
      });

      if (incident.description) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${incident.description.length > 200 ? incident.description.substring(0, 200) + '...' : incident.description}`
          }
        });
      }

      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View in ServiceNow'
            },
            url: `${config.SERVICENOW_INSTANCE_URL}/incident.do?sys_id=${incident.sys_id}`,
            style: 'primary'
          }
        ]
      });
    }

    return {
      channel,
      text: `New ServiceNow Incident: ${incident.number} - ${incident.short_description}`,
      blocks,
      unfurl_links: false,
      unfurl_media: false
    };
  }

  /**
   * Get channels list
   */
  async getChannels(): Promise<ApiResponse<SlackChannelInfo[]>> {
    try {
      if (!this.botToken) {
        return {
          success: false,
          error: 'No bot token configured'
        };
      }

      const response: AxiosResponse<SlackApiResponse> = await this.client.get('conversations.list', {
        params: {
          types: 'public_channel,private_channel',
          exclude_archived: true
        }
      });

      if (!response.data.ok) {
        return {
          success: false,
          error: response.data.error,
          message: 'Failed to fetch Slack channels'
        };
      }

      return {
        success: true,
        data: response.data.channels,
        message: 'Channels fetched successfully'
      };

    } catch (error: any) {
      logger.error('Error fetching Slack channels:', error);
      return {
        success: false,
        error: 'Fetch failed',
        message: error.message || 'Failed to fetch channels'
      };
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
export const slackClient = new SlackClient();