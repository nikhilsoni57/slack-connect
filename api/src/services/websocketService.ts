/**
 * WebSocket Service - Real-time dashboard updates
 * Provides live updates for dashboard metrics, incidents, and notifications
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger.js';
import { dashboardService } from './dashboardService.js';

interface DashboardClient {
  id: string;
  socket: Socket;
  subscriptions: Set<string>;
  lastHeartbeat: Date;
}

interface WebSocketUpdate {
  type: 'metrics' | 'incident' | 'notification' | 'health' | 'activity';
  event: string;
  data: any;
  timestamp: Date;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private clients: Map<string, DashboardClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    this.startMetricsUpdates();

    logger.info('🔌 WebSocket server initialized for real-time dashboard updates');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      this.handleClientConnection(socket);

      socket.on('subscribe', (subscriptions: string[]) => {
        this.handleSubscription(socket, subscriptions);
      });

      socket.on('unsubscribe', (subscriptions: string[]) => {
        this.handleUnsubscription(socket, subscriptions);
      });

      socket.on('heartbeat', () => {
        this.handleHeartbeat(socket);
      });

      socket.on('disconnect', (reason) => {
        this.handleClientDisconnection(socket, reason);
      });
    });
  }

  /**
   * Handle new client connection
   */
  private handleClientConnection(socket: Socket): void {
    const client: DashboardClient = {
      id: socket.id,
      socket,
      subscriptions: new Set(['dashboard-overview']), // Default subscription
      lastHeartbeat: new Date()
    };

    this.clients.set(socket.id, client);
    logger.info(`📱 Dashboard client connected: ${socket.id} (${this.clients.size} total)`);

    // Send initial data
    this.sendInitialData(socket);
  }

  /**
   * Send initial dashboard data to new client
   */
  private async sendInitialData(socket: Socket): Promise<void> {
    try {
      // Send current metrics
      const metrics = await dashboardService.getDashboardMetrics();
      socket.emit('dashboard-update', {
        type: 'metrics',
        event: 'initial-load',
        data: metrics,
        timestamp: new Date()
      });

      // Send current health status
      const health = await dashboardService.getHealthStatus();
      socket.emit('dashboard-update', {
        type: 'health',
        event: 'initial-load',
        data: health,
        timestamp: new Date()
      });

      logger.debug(`📊 Sent initial dashboard data to client ${socket.id}`);
      
    } catch (error) {
      logger.error('Failed to send initial dashboard data:', error);
    }
  }

  /**
   * Handle client subscription to specific data types
   */
  private handleSubscription(socket: Socket, subscriptions: string[]): void {
    const client = this.clients.get(socket.id);
    if (!client) return;

    subscriptions.forEach(sub => client.subscriptions.add(sub));
    logger.debug(`📡 Client ${socket.id} subscribed to: ${subscriptions.join(', ')}`);

    // Send current data for new subscriptions
    this.sendSubscriptionData(socket, subscriptions);
  }

  /**
   * Handle client unsubscription
   */
  private handleUnsubscription(socket: Socket, subscriptions: string[]): void {
    const client = this.clients.get(socket.id);
    if (!client) return;

    subscriptions.forEach(sub => client.subscriptions.delete(sub));
    logger.debug(`📡 Client ${socket.id} unsubscribed from: ${subscriptions.join(', ')}`);
  }

  /**
   * Send data for specific subscriptions
   */
  private async sendSubscriptionData(socket: Socket, subscriptions: string[]): Promise<void> {
    for (const subscription of subscriptions) {
      try {
        let data;
        let type: WebSocketUpdate['type'];

        switch (subscription) {
          case 'dashboard-overview':
          case 'metrics':
            data = await dashboardService.getDashboardMetrics();
            type = 'metrics';
            break;

          case 'health':
            data = await dashboardService.getHealthStatus();
            type = 'health';
            break;

          case 'analytics':
            data = await dashboardService.getDashboardAnalytics();
            type = 'activity';
            break;

          default:
            continue;
        }

        socket.emit('dashboard-update', {
          type,
          event: 'subscription-data',
          data: data.data,
          timestamp: new Date()
        });

      } catch (error) {
        logger.error(`Failed to send subscription data for ${subscription}:`, error);
      }
    }
  }

  /**
   * Handle client heartbeat
   */
  private handleHeartbeat(socket: Socket): void {
    const client = this.clients.get(socket.id);
    if (client) {
      client.lastHeartbeat = new Date();
    }
  }

  /**
   * Handle client disconnection
   */
  private handleClientDisconnection(socket: Socket, reason: string): void {
    this.clients.delete(socket.id);
    logger.info(`📱 Dashboard client disconnected: ${socket.id} (reason: ${reason}) (${this.clients.size} remaining)`);
  }

  /**
   * Broadcast update to all subscribed clients
   */
  async broadcastUpdate(update: WebSocketUpdate): Promise<void> {
    if (!this.io) return;

    const subscribedClients = Array.from(this.clients.values()).filter(client => 
      client.subscriptions.has('dashboard-overview') || 
      client.subscriptions.has(update.type)
    );

    if (subscribedClients.length === 0) {
      logger.debug(`No clients subscribed to ${update.type} updates`);
      return;
    }

    subscribedClients.forEach(client => {
      client.socket.emit('dashboard-update', update);
    });

    logger.debug(`📡 Broadcasted ${update.type} update to ${subscribedClients.length} clients`);
  }

  /**
   * Notify about new incident
   */
  async notifyIncidentUpdate(incidentData: any): Promise<void> {
    const update: WebSocketUpdate = {
      type: 'incident',
      event: incidentData.event_type || 'updated',
      data: {
        incident: incidentData,
        metrics_updated: true
      },
      timestamp: new Date()
    };

    await this.broadcastUpdate(update);

    // Also trigger metrics refresh
    this.triggerMetricsUpdate();
  }

  /**
   * Notify about new notification delivery
   */
  async notifyDeliveryUpdate(deliveryData: any): Promise<void> {
    const update: WebSocketUpdate = {
      type: 'notification',
      event: 'delivery',
      data: deliveryData,
      timestamp: new Date()
    };

    await this.broadcastUpdate(update);
  }

  /**
   * Notify about user activity
   */
  async notifyActivityUpdate(activityData: any): Promise<void> {
    const update: WebSocketUpdate = {
      type: 'activity',
      event: 'command',
      data: activityData,
      timestamp: new Date()
    };

    await this.broadcastUpdate(update);
  }

  /**
   * Trigger immediate metrics update
   */
  private async triggerMetricsUpdate(): Promise<void> {
    try {
      const metrics = await dashboardService.getDashboardMetrics();
      
      const update: WebSocketUpdate = {
        type: 'metrics',
        event: 'refresh',
        data: metrics,
        timestamp: new Date()
      };

      await this.broadcastUpdate(update);
    } catch (error) {
      logger.error('Failed to trigger metrics update:', error);
    }
  }

  /**
   * Start periodic heartbeat checking
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 60000; // 60 seconds

      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceHeartbeat = now.getTime() - client.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > staleThreshold) {
          logger.debug(`Removing stale client: ${clientId}`);
          client.socket.disconnect();
          this.clients.delete(clientId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start periodic metrics updates
   */
  private startMetricsUpdates(): void {
    this.metricsUpdateInterval = setInterval(async () => {
      if (this.clients.size === 0) return; // No clients connected

      try {
        await this.triggerMetricsUpdate();
      } catch (error) {
        logger.error('Periodic metrics update failed:', error);
      }
    }, 10000); // Update every 10 seconds when clients are connected
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const subscriptionCounts: Record<string, number> = {};
    
    for (const client of this.clients.values()) {
      for (const subscription of client.subscriptions) {
        subscriptionCounts[subscription] = (subscriptionCounts[subscription] || 0) + 1;
      }
    }

    return {
      total_connections: this.clients.size,
      subscription_counts: subscriptionCounts,
      server_running: this.io !== null
    };
  }

  /**
   * Cleanup WebSocket service
   */
  async cleanup(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }

    if (this.io) {
      this.io.close();
      this.io = null;
    }

    this.clients.clear();
    logger.info('🔌 WebSocket service cleaned up');
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();