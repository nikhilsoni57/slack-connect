import { Router, Request, Response } from 'express';
import { serviceNowClient } from '../services/servicenow.js';
import { slackClient } from '../services/slackClient.js';
import { config } from '../config/environment.js';
import { ApiResponse, IntegrationStatus } from '../types/index.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

const router = Router();

/**
 * GET /status
 * Get comprehensive system and integration status
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Run all status checks in parallel
    const [serviceNowStatus, slackStatus, systemHealth] = await Promise.allSettled([
      checkServiceNowIntegrationStatus(req),
      checkSlackIntegrationStatus(),
      checkSystemHealth()
    ]);

    const status: IntegrationStatus & { system?: any; responseTime?: number } = {
      servicenow: {
        connected: false,
        authType: 'none'
      },
      slack: {
        connected: false
      },
      system: {
        healthy: true,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      },
      responseTime: Date.now() - startTime
    };

    // Process ServiceNow status
    if (serviceNowStatus.status === 'fulfilled' && serviceNowStatus.value.success) {
      status.servicenow = serviceNowStatus.value.data;
    } else {
      status.servicenow = {
        connected: false,
        authType: 'none',
        lastTested: new Date().toISOString(),
        error: serviceNowStatus.status === 'rejected' 
          ? serviceNowStatus.reason?.message 
          : (serviceNowStatus.value as any)?.error
      };
    }

    // Process Slack status
    if (slackStatus.status === 'fulfilled' && slackStatus.value.success) {
      status.slack = slackStatus.value.data;
    } else {
      status.slack = {
        connected: false,
        lastTested: new Date().toISOString(),
        error: slackStatus.status === 'rejected' 
          ? slackStatus.reason?.message 
          : (slackStatus.value as any)?.error
      };
    }

    // Process system health
    if (systemHealth.status === 'fulfilled' && systemHealth.value.success) {
      status.system = { ...status.system, ...systemHealth.value.data };
    }

    // Determine overall health
    const overallHealthy = status.servicenow.connected && status.slack.connected && status.system.healthy;

    logger.info('Status check completed', {
      responseTime: status.responseTime,
      servicenow: status.servicenow.connected,
      slack: status.slack.connected,
      overall: overallHealthy
    });

    res.json({
      success: true,
      data: {
        overall: {
          healthy: overallHealthy,
          status: overallHealthy ? 'operational' : 'degraded'
        },
        ...status
      },
      message: `System status: ${overallHealthy ? 'operational' : 'degraded'}`
    });

  } catch (error: any) {
    logger.error('Status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      message: error.message || 'Unable to retrieve system status',
      data: {
        overall: {
          healthy: false,
          status: 'error'
        },
        responseTime: Date.now() - startTime
      }
    });
  }
});

/**
 * GET /status/servicenow
 * Get ServiceNow integration status specifically
 */
router.get('/servicenow', async (req: Request, res: Response) => {
  try {
    const result = await checkServiceNowIntegrationStatus(req);
    const statusCode = result.success ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error: any) {
    logger.error('ServiceNow status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'ServiceNow status check failed',
      message: error.message || 'Unable to check ServiceNow status'
    });
  }
});

/**
 * GET /status/slack
 * Get Slack integration status specifically
 */
router.get('/slack', async (req: Request, res: Response) => {
  try {
    const result = await checkSlackIntegrationStatus();
    const statusCode = result.success ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error: any) {
    logger.error('Slack status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Slack status check failed',
      message: error.message || 'Unable to check Slack status'
    });
  }
});

/**
 * Check ServiceNow integration status
 */
async function checkServiceNowIntegrationStatus(req: Request): Promise<ApiResponse<any>> {
  try {
    const connectionStatus = await serviceNowClient.getConnectionStatus();
    
    // Check session authentication status
    const sessionAuthenticated = req.session?.servicenow_authenticated || false;
    const sessionExpiresAt = req.session?.servicenow_expires_at;
    
    const statusData = {
      connected: connectionStatus.data?.connected || false,
      authenticated: connectionStatus.data?.authenticated || false,
      authType: connectionStatus.data?.authenticated ? 'oauth' : 'none',
      instanceUrl: config.SERVICENOW_INSTANCE_URL,
      lastTested: new Date().toISOString(),
      sessionAuthenticated,
      sessionExpiresAt: sessionExpiresAt ? new Date(sessionExpiresAt).toISOString() : null,
      tokenExpiration: connectionStatus.data?.tokenExpiration
    };

    return {
      success: true,
      data: statusData,
      message: connectionStatus.message || 'ServiceNow status retrieved'
    };

  } catch (error: any) {
    return {
      success: false,
      error: 'ServiceNow status check failed',
      message: error.message || 'Unable to check ServiceNow status',
      data: {
        connected: false,
        authenticated: false,
        authType: 'none',
        instanceUrl: config.SERVICENOW_INSTANCE_URL,
        lastTested: new Date().toISOString()
      }
    };
  }
}

/**
 * Check Slack integration status
 */
async function checkSlackIntegrationStatus(): Promise<ApiResponse<any>> {
  try {
    const connectionTest = await slackClient.testConnection();
    
    const statusData = {
      connected: connectionTest.success,
      lastTested: new Date().toISOString(),
      workspaceId: connectionTest.data?.team_id,
      botUserId: connectionTest.data?.user_id,
      teamName: connectionTest.data?.team,
      botUsername: connectionTest.data?.user
    };

    return {
      success: connectionTest.success,
      data: statusData,
      message: connectionTest.message || 'Slack status retrieved'
    };

  } catch (error: any) {
    return {
      success: false,
      error: 'Slack status check failed',
      message: error.message || 'Unable to check Slack status',
      data: {
        connected: false,
        lastTested: new Date().toISOString()
      }
    };
  }
}

/**
 * Check system health
 */
async function checkSystemHealth(): Promise<ApiResponse<any>> {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };

    // Check if memory usage is concerning (> 512 MB total heap)
    const memoryHealthy = memoryUsageMB.heapTotal < 512;
    
    // Check uptime (system is healthy if it's been running for a reasonable time)
    const uptimeSeconds = process.uptime();
    const uptimeHealthy = uptimeSeconds > 10; // At least 10 seconds

    const systemData = {
      healthy: memoryHealthy && uptimeHealthy,
      uptime: {
        seconds: uptimeSeconds,
        human: formatUptime(uptimeSeconds)
      },
      memory: {
        ...memoryUsageMB,
        unit: 'MB'
      },
      environment: config.NODE_ENV,
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    };

    return {
      success: true,
      data: systemData,
      message: 'System health retrieved successfully'
    };

  } catch (error: any) {
    return {
      success: false,
      error: 'System health check failed',
      message: error.message || 'Unable to check system health'
    };
  }
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export { router as statusRoutes };