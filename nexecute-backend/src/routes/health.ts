import { Router, Request, Response } from 'express';
import { HealthCheckResult, ServiceHealthStatus, ApiResponse } from '../types/index.js';
import { config } from '../config/environment.js';
import { slackClient } from '../services/slackClient.js';
import { serviceNowClient } from '../services/servicenow.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

const router = Router();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  const health: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: config.NODE_ENV,
    services: {}
  };

  res.json(health);
});

/**
 * GET /health/detailed
 * Comprehensive health check with service connectivity tests
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Run all health checks in parallel
    const [serviceNowHealth, slackHealth, databaseHealth, redisHealth] = await Promise.allSettled([
      checkServiceNowHealth(),
      checkSlackHealth(),
      checkDatabaseHealth(),
      checkRedisHealth()
    ]);

    const services: HealthCheckResult['services'] = {};

    // Process ServiceNow health
    if (serviceNowHealth.status === 'fulfilled') {
      services.servicenow = serviceNowHealth.value;
    } else {
      services.servicenow = {
        status: 'error',
        message: 'Health check failed',
        lastChecked: new Date().toISOString()
      };
    }

    // Process Slack health
    if (slackHealth.status === 'fulfilled') {
      services.slack = slackHealth.value;
    } else {
      services.slack = {
        status: 'error',
        message: 'Health check failed',
        lastChecked: new Date().toISOString()
      };
    }

    // Process Database health
    if (databaseHealth.status === 'fulfilled') {
      services.database = databaseHealth.value;
    } else {
      services.database = {
        status: 'error',
        message: 'Health check failed',
        lastChecked: new Date().toISOString()
      };
    }

    // Process Redis health
    if (redisHealth.status === 'fulfilled') {
      services.redis = redisHealth.value;
    } else {
      services.redis = {
        status: 'error',
        message: 'Health check failed',
        lastChecked: new Date().toISOString()
      };
    }

    // Determine overall health status
    const allServicesHealthy = Object.values(services).every(
      service => service?.status === 'connected'
    );

    const health: HealthCheckResult = {
      status: allServicesHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: config.NODE_ENV,
      services
    };

    const responseTime = Date.now() - startTime;
    logger.info(`Health check completed in ${responseTime}ms`, {
      status: health.status,
      services: Object.keys(services)
    });

    res.json(health);

  } catch (error) {
    logger.error('Health check error:', error);
    
    const health: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: config.NODE_ENV,
      services: {}
    };

    res.status(503).json(health);
  }
});

/**
 * GET /health/servicenow
 * ServiceNow-specific health check
 */
router.get('/servicenow', async (req: Request, res: Response) => {
  try {
    const health = await checkServiceNowHealth();
    const statusCode = health.status === 'connected' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('ServiceNow health check error:', error);
    res.status(503).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Health check failed',
      lastChecked: new Date().toISOString()
    });
  }
});

/**
 * GET /health/slack
 * Slack-specific health check
 */
router.get('/slack', async (req: Request, res: Response) => {
  try {
    const health = await checkSlackHealth();
    const statusCode = health.status === 'connected' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Slack health check error:', error);
    res.status(503).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Health check failed',
      lastChecked: new Date().toISOString()
    });
  }
});

/**
 * Check ServiceNow connectivity
 */
async function checkServiceNowHealth(): Promise<ServiceHealthStatus> {
  const startTime = Date.now();
  
  try {
    // Test basic connectivity to ServiceNow instance
    // For health checks, we'll just test the base API endpoint without authentication
    // This checks network connectivity and basic ServiceNow availability
    const response = await axios.get(`${config.SERVICENOW_INSTANCE_URL}/api/now/table/sys_user`, {
      params: {
        sysparm_limit: 1
      },
      timeout: 5000,
      validateStatus: (status) => {
        // Accept 401 (unauthorized) as a valid response for health check
        // This means ServiceNow is responding, just needs authentication
        return status < 500;
      }
    });

    const responseTime = Date.now() - startTime;

    if (response.status === 200 && response.data.result) {
      return {
        status: 'connected',
        message: 'ServiceNow API accessible and authenticated',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } else if (response.status === 401) {
      return {
        status: 'connected',
        message: 'ServiceNow API reachable (authentication required as expected)',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        status: 'disconnected',
        message: `ServiceNow API returned status ${response.status}`,
        responseTime,
        lastChecked: new Date().toISOString()
      };
    }

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    logger.warn('ServiceNow health check failed:', error.message);
    
    return {
      status: 'disconnected',
      message: `Connection failed: ${error.message}`,
      responseTime,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check Slack API connectivity
 */
async function checkSlackHealth(): Promise<ServiceHealthStatus> {
  const startTime = Date.now();
  
  try {
    // Test if we can reach Slack API
    const response = await axios.get('https://slack.com/api/api.test', {
      timeout: 5000
    });

    const responseTime = Date.now() - startTime;

    if (response.data.ok) {
      return {
        status: 'connected',
        message: 'Slack API accessible',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        status: 'disconnected',
        message: 'Slack API test failed',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    }

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'disconnected',
      message: `Slack API unreachable: ${error.message}`,
      responseTime,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check database connectivity (if configured)
 */
async function checkDatabaseHealth(): Promise<ServiceHealthStatus> {
  if (!config.DATABASE_URL) {
    return {
      status: 'disconnected',
      message: 'Database not configured',
      lastChecked: new Date().toISOString()
    };
  }

  const startTime = Date.now();

  try {
    // This would be implemented with actual database client
    // For now, just return a placeholder
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'disconnected',
      message: 'Database client not implemented',
      responseTime,
      lastChecked: new Date().toISOString()
    };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'error',
      message: `Database connection failed: ${error.message}`,
      responseTime,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check Redis connectivity (if configured)
 */
async function checkRedisHealth(): Promise<ServiceHealthStatus> {
  if (!config.REDIS_URL) {
    return {
      status: 'disconnected',
      message: 'Redis not configured',
      lastChecked: new Date().toISOString()
    };
  }

  const startTime = Date.now();

  try {
    // This would be implemented with actual Redis client
    // For now, just return a placeholder
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'disconnected',
      message: 'Redis client not implemented',
      responseTime,
      lastChecked: new Date().toISOString()
    };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'error',
      message: `Redis connection failed: ${error.message}`,
      responseTime,
      lastChecked: new Date().toISOString()
    };
  }
}

export { router as healthRoutes };