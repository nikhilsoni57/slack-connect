import { Router, Request, Response } from 'express';
import { serviceNowClient } from '../services/servicenow.js';
import { slackClient } from '../services/slackClient.js';
import { logger } from '../utils/logger.js';
import { dashboardService } from '../services/dashboardService.js';
import { database } from '../database/connection.js';

const router = Router();

// In-memory analytics store (replace with database in production)
interface AnalyticsData {
  incidentsProcessed: number;
  notificationsDelivered: number;
  notificationFailures: number;
  lastActivity: Date;
  integrationHealth: {
    servicenow: { status: 'healthy' | 'degraded' | 'down'; responseTime: number };
    slack: { status: 'healthy' | 'degraded' | 'down'; responseTime: number };
  };
  dailyMetrics: Array<{
    date: string;
    incidents: number;
    notifications: number;
    errors: number;
  }>;
  channelMappings: Array<{
    priority: string;
    channels: string[];
    description: string;
  }>;
}

const analyticsStore: AnalyticsData = {
  incidentsProcessed: 147,
  notificationsDelivered: 98,
  notificationFailures: 2,
  lastActivity: new Date(),
  integrationHealth: {
    servicenow: { status: 'healthy', responseTime: 245 },
    slack: { status: 'healthy', responseTime: 156 }
  },
  dailyMetrics: [
    { date: '2025-09-01', incidents: 12, notifications: 12, errors: 0 },
    { date: '2025-09-02', incidents: 8, notifications: 8, errors: 1 },
    { date: '2025-09-03', incidents: 15, notifications: 14, errors: 1 },
    { date: '2025-09-04', incidents: 22, notifications: 22, errors: 0 },
    { date: '2025-09-05', incidents: 18, notifications: 18, errors: 0 },
    { date: '2025-09-06', incidents: 25, notifications: 24, errors: 0 }
  ],
  channelMappings: [
    { priority: 'P1 - Critical', channels: ['#critical-ops', '#nexecute'], description: 'Critical incidents routed to ops teams immediately' },
    { priority: 'P2 - High', channels: ['#nexecute'], description: 'High priority incidents to main channel' },
    { priority: 'P3-P5 - Medium/Low', channels: ['#nexecute'], description: 'Standard incidents to main channel' }
  ]
};

/**
 * GET /dashboard
 * Main dashboard view
 */
router.get('/', (req: Request, res: Response) => {
  // Set CSP headers to allow inline styles but secure scripts
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data:; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self';"
  );
  
  res.send(getDashboardHTML());
});

/**
 * GET /dashboard/api/health
 * Real-time integration health status
 */
router.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Test ServiceNow connection
    const startSN = Date.now();
    const snHealth = await serviceNowClient.getConnectionStatus();
    const snResponseTime = Date.now() - startSN;

    // Test Slack connection  
    const startSlack = Date.now();
    let slackHealth = { success: false, message: 'Not configured' };
    let slackResponseTime = 0;
    
    try {
      slackHealth = await slackClient.testConnection();
      slackResponseTime = Date.now() - startSlack;
    } catch (error) {
      slackResponseTime = Date.now() - startSlack;
    }

    // Update analytics store
    analyticsStore.integrationHealth = {
      servicenow: {
        status: snHealth.success ? 'healthy' : 'down',
        responseTime: snResponseTime
      },
      slack: {
        status: slackHealth.success ? 'healthy' : 'degraded',
        responseTime: slackResponseTime
      }
    };

    res.json({
      success: true,
      data: {
        overall_status: snHealth.success && slackHealth.success ? 'healthy' : 'degraded',
        servicenow: {
          status: analyticsStore.integrationHealth.servicenow.status,
          response_time_ms: analyticsStore.integrationHealth.servicenow.responseTime,
          authenticated: snHealth.data?.authenticated || false
        },
        slack: {
          status: analyticsStore.integrationHealth.slack.status,
          response_time_ms: analyticsStore.integrationHealth.slack.responseTime,
          bot_configured: slackHealth.success
        },
        last_check: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Dashboard health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

/**
 * GET /dashboard/api/analytics
 * Customer activity analytics
 */
router.get('/api/analytics', (req: Request, res: Response) => {
  try {
    // Calculate ROI metrics
    const totalIncidents = analyticsStore.incidentsProcessed;
    const avgTimePerIncident = 8; // minutes saved per incident
    const totalTimeSaved = totalIncidents * avgTimePerIncident;
    const hoursSaved = Math.floor(totalTimeSaved / 60);

    const successRate = analyticsStore.notificationsDelivered / 
                       (analyticsStore.notificationsDelivered + analyticsStore.notificationFailures) * 100;

    res.json({
      success: true,
      data: {
        overview: {
          incidents_processed: analyticsStore.incidentsProcessed,
          notifications_delivered: analyticsStore.notificationsDelivered,
          notification_failures: analyticsStore.notificationFailures,
          success_rate: Math.round(successRate * 100) / 100,
          last_activity: analyticsStore.lastActivity
        },
        roi: {
          total_time_saved_minutes: totalTimeSaved,
          hours_saved: hoursSaved,
          automation_efficiency: successRate
        },
        daily_metrics: analyticsStore.dailyMetrics,
        channel_mappings: analyticsStore.channelMappings
      }
    });

  } catch (error) {
    logger.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Analytics fetch failed'
    });
  }
});

/**
 * POST /dashboard/api/analytics/incident
 * Track incident processing
 */
router.post('/api/analytics/incident', (req: Request, res: Response) => {
  try {
    const { incident_number, success, error_message } = req.body;

    // Update analytics
    analyticsStore.incidentsProcessed++;
    if (success) {
      analyticsStore.notificationsDelivered++;
    } else {
      analyticsStore.notificationFailures++;
    }
    analyticsStore.lastActivity = new Date();

    // Update daily metrics
    const today = new Date().toISOString().split('T')[0];
    let todayMetric = analyticsStore.dailyMetrics.find(m => m.date === today);
    if (!todayMetric) {
      todayMetric = { date: today, incidents: 0, notifications: 0, errors: 0 };
      analyticsStore.dailyMetrics.push(todayMetric);
    }
    
    todayMetric.incidents++;
    if (success) {
      todayMetric.notifications++;
    } else {
      todayMetric.errors++;
    }

    logger.info('Analytics updated for incident:', { incident_number, success });

    res.json({
      success: true,
      message: 'Analytics updated',
      current_stats: {
        incidents: analyticsStore.incidentsProcessed,
        delivered: analyticsStore.notificationsDelivered,
        failures: analyticsStore.notificationFailures
      }
    });

  } catch (error) {
    logger.error('Analytics update error:', error);
    res.status(500).json({
      success: false,
      error: 'Analytics update failed'
    });
  }
});

/**
 * GET /dashboard/api/metrics
 * Real-time metrics from database
 */
router.get('/api/metrics', async (req: Request, res: Response) => {
  try {
    const { period = 'today' } = req.query;
    
    // Calculate time range based on period filter
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const endDate = now;

    // Get real data from dashboard service
    const dashboardMetrics = await dashboardService.getDashboardMetrics();
    const incidentData = await getIncidentTrends(startDate, endDate, period as string);
    const responseTimeData = await getResponseTimeData(startDate, endDate, period as string);

    res.json({
      success: true,
      data: {
        summary: dashboardMetrics.summary,
        incident_trends: incidentData,
        response_times: responseTimeData,
        period: period,
        start_date: startDate,
        end_date: endDate
      }
    });

  } catch (error) {
    logger.error('Real-time metrics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real-time metrics'
    });
  }
});

/**
 * GET /dashboard/api/configuration
 * Current integration configuration
 */
router.get('/api/configuration', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        channel_mappings: analyticsStore.channelMappings,
        notification_rules: {
          critical_escalation: true,
          business_hours_only: false,
          max_retry_attempts: 3,
          retry_delay_seconds: 30
        },
        integration_settings: {
          servicenow_instance: 'https://dev203615.service-now.com',
          slack_workspace: 'Nexecute',
          webhook_timeout_ms: 30000,
          rate_limit_enabled: false
        }
      }
    });

  } catch (error) {
    logger.error('Configuration fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Configuration fetch failed'
    });
  }
});

function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nexecute Connect - Integration Dashboard</title>
    <script src="https://unpkg.com/chart.js"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #9D00FF 0%, #6a00cc 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .dashboard-container {
            max-width: 1400px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }
        
        .dashboard-header {
            padding: 30px 40px;
            border-bottom: 1px solid #e5e7eb;
            background: white;
            border-radius: 20px 20px 0 0;
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .action-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
        }
        
        .action-btn.primary {
            background: #9D00FF;
            color: white;
        }
        
        .action-btn.primary:hover {
            background: #6C00B2;
            transform: translateY(-1px);
        }
        
        .action-btn.secondary {
            background: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
        }
        
        .action-btn.secondary:hover {
            background: #e5e7eb;
            transform: translateY(-1px);
        }
        
        .dropdown {
            position: relative;
            display: inline-block;
        }
        
        .dropdown-menu {
            position: absolute;
            top: 100%;
            right: 0;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            z-index: 100;
            min-width: 200px;
            display: none;
        }
        
        .dropdown-menu.show {
            display: block;
        }
        
        .dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            color: #374151;
            text-decoration: none;
            font-size: 14px;
            border-bottom: 1px solid #f3f4f6;
            transition: background-color 0.2s ease;
        }
        
        .dropdown-item:last-child {
            border-bottom: none;
        }
        
        .dropdown-item:hover {
            background: #f9fafb;
        }
        
        .dropdown-item:first-child {
            border-radius: 8px 8px 0 0;
        }
        
        .dropdown-item:last-child {
            border-radius: 0 0 8px 8px;
        }
        
        .action-btn.small {
            padding: 6px 12px;
            font-size: 12px;
        }
        
        .config-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .config-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .config-title {
            display: flex;
            align-items: center;
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
        }
        
        .quick-actions {
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border: 1px solid #f3f4f6;
        }
        
        .actions-title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 25px;
        }
        
        .actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        
        .quick-action-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            padding: 20px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
        }
        
        .quick-action-card:hover {
            background: #f3f4f6;
            border-color: #4f46e5;
            transform: translateY(-2px);
            box-shadow: 0 8px 16px -4px rgba(79, 70, 229, 0.2);
        }
        
        .quick-action-card i {
            color: #4f46e5;
        }
        
        .quick-action-card span {
            font-weight: 600;
            color: #1f2937;
        }
        
        .quick-action-card small {
            color: #6b7280;
            font-size: 12px;
        }
        
        .last-updated {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #6b7280;
            margin-right: 16px;
        }
        
        .metric-card:hover {
            border: 2px solid #9D00FF;
            background: linear-gradient(135deg, #f8fafc 0%, #E4D5FF 100%);
        }
        
        .metric-tooltip {
            cursor: help;
            color: #9ca3af;
        }
        
        .trend-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            margin-left: 8px;
        }
        
        .trend-badge.positive {
            background: #dcfce7;
            color: #166534;
        }
        
        .system-status {
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border: 1px solid #f3f4f6;
        }
        
        .status-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }
        
        .status-title {
            display: flex;
            align-items: center;
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
        }
        
        .status-indicators {
            display: flex;
            gap: 20px;
        }
        
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 500;
        }
        
        .indicator-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        .status-indicator.healthy .indicator-dot {
            background: #10b981;
        }
        
        .status-indicator.degraded .indicator-dot {
            background: #f59e0b;
        }
        
        .status-indicator.down .indicator-dot {
            background: #ef4444;
        }
        
        .quick-action-card.primary {
            border-color: #4f46e5;
            background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
        }
        
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.7;
            }
        }
        
        .action-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .refresh-loading {
            animation: spin 1s linear infinite;
            color: #9D00FF !important;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .success-feedback {
            background: #9D00FF !important;
            color: white !important;
            border: none !important;
            animation: brand-success 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        .error-feedback {
            background: #ef4444 !important;
            color: white !important;
            transition: all 0.3s ease;
        }
        
        /* Success Rate Health Indicators */
        .success-rate-excellent {
            color: #10b981 !important;
            font-weight: 700;
        }
        
        .success-rate-good {
            color: #059669 !important;
            font-weight: 600;
        }
        
        .success-rate-warning {
            color: #f59e0b !important;
            font-weight: 600;
        }
        
        .success-rate-critical {
            color: #ef4444 !important;
            font-weight: 700;
            animation: pulse-warning 2s infinite;
        }
        
        @keyframes pulse-warning {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .logo img {
            height: 80px;
            width: auto;
            object-fit: contain;
        }
        
        .header-info h1 {
            font-size: 28px;
            color: #1f2937;
            font-weight: 700;
        }
        
        .header-info p {
            color: #6b7280;
            margin-top: 5px;
        }
        
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 600;
        }
        
        .status-healthy {
            background: #dcfce7;
            color: #166534;
        }
        
        .status-degraded {
            background: #fef3c7;
            color: #92400e;
        }
        
        .dashboard-content {
            padding: 30px 40px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }
        
        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border: 2px solid transparent;
            transition: border 0.2s, background 0.2s;
        }
        
        
        .metric-header {
            display: flex;
            align-items: center;
            justify-content: between;
            margin-bottom: 15px;
        }
        
        .metric-icon {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            position: relative;
        }
        
        
        .icon-incidents {
            background: #dbeafe;
            color: #1d4ed8;
        }
        
        .icon-notifications {
            background: #d1fae5;
            color: #059669;
        }
        
        .icon-health {
            background: #fce7f3;
            color: #be185d;
        }
        
        .icon-roi {
            background: #fef3c7;
            color: #d97706;
        }
        
        .metric-value {
            font-size: 32px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 5px;
        }
        
        .metric-label {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 10px;
        }
        
        .metric-change {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 13px;
        }
        
        .change-positive {
            color: #059669;
        }
        
        .change-neutral {
            color: #6b7280;
        }
        
        .charts-section {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .chart-card {
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border: 2px solid transparent;
            transition: border 0.2s, background 0.2s;
        }
        
        .chart-card:hover {
            border: 2px solid #9D00FF;
            background: linear-gradient(135deg, #f8fafc 0%, #E4D5FF 100%);
        }
        
        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .chart-header-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .chart-title {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
        }
        
        .chart-period {
            font-size: 14px;
            color: #6b7280;
        }
        
        .time-filter {
            display: flex;
            gap: 8px;
        }
        
        .filter-btn {
            padding: 6px 12px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: white;
            color: #6b7280;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .filter-btn:hover {
            background: #f9fafb;
            color: #374151;
        }
        
        .filter-btn.active {
            background: #9D00FF;
            color: white;
            border-color: #9D00FF;
        }
        
        .config-section {
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border: 1px solid #f3f4f6;
        }
        
        .config-title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 25px;
        }
        
        .config-item {
            display: flex;
            justify-content: between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .config-item:last-child {
            border-bottom: none;
        }
        
        .config-key {
            font-weight: 500;
            color: #374151;
        }
        
        .config-value {
            color: #6b7280;
            font-size: 14px;
        }
        
        .priority-tag {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .priority-critical {
            background: #fee2e2;
            color: #dc2626;
        }
        
        .priority-high {
            background: #fef3c7;
            color: #d97706;
        }
        
        .priority-normal {
            background: #e0e7ff;
            color: #4338ca;
        }
        
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f4f6;
            border-radius: 50%;
            border-top-color: #4f46e5;
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        @keyframes brand-success {
            0% { 
                box-shadow: 0 2px 8px rgba(157, 0, 255, 0.2);
            }
            50% { 
                box-shadow: 0 4px 16px rgba(157, 0, 255, 0.4);
            }
            100% { 
                box-shadow: 0 2px 8px rgba(157, 0, 255, 0.3);
            }
        }
        
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .dashboard-header {
                padding: 20px;
            }
            
            .dashboard-content {
                padding: 20px;
            }
            
            .charts-section {
                grid-template-columns: 1fr;
            }
            
            .header-content {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <div class="dashboard-header">
            <div class="header-content">
                <div class="logo-section">
                    <div class="logo">
                        <img src="/assets/Nexecute-connect.svg" alt="Nexecute Connect" style="height: 80px; width: auto;">
                    </div>
                    <div class="header-info">
                        <h1>Nexecute Connect Dashboard</h1>
                        <p>ServiceNow-Slack Integration Management</p>
                    </div>
                </div>
                <div class="header-actions">
                    <div class="last-updated" id="last-updated">
                        <i data-lucide="clock" style="width: 14px; height: 14px;"></i>
                        <span>Last updated: --</span>
                    </div>
                    <button class="action-btn secondary" id="refresh-btn">
                        <i data-lucide="refresh-cw" style="width: 16px; height: 16px;"></i>
                        Refresh
                    </button>
                </div>
            </div>
        </div>
        
        <div class="dashboard-content">
            <!-- MVP-Focused Key Metrics -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value" id="p1-incidents-active">-</div>
                    <div class="metric-label">P1 Incidents Active</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value" id="sla-compliance">-</div>
                    <div class="metric-label">SLA Compliance</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value" id="channel-coverage">-</div>
                    <div class="metric-label">Channel Coverage</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value" id="last-p1-alert">-</div>
                    <div class="metric-label">Last P1 Alert</div>
                </div>
            </div>
            
            <!-- Charts -->
            <div class="charts-section">
                <div class="chart-card">
                    <div class="chart-header">
                        <div class="chart-title">Incident Response Times</div>
                        <div class="chart-header-right">
                            <div class="time-filter">
                                <button class="filter-btn active" data-period="today">Today</button>
                                <button class="filter-btn" data-period="week">This Week</button>
                                <button class="filter-btn" data-period="month">This Month</button>
                            </div>
                        </div>
                    </div>
                    <canvas id="activity-chart" width="600" height="300"></canvas>
                </div>
                
                <div class="chart-card">
                    <div class="chart-header">
                        <div class="chart-title">Critical Incident Trends</div>
                        <div class="chart-period" id="critical-trends-period">7 Days</div>
                    </div>
                    <canvas id="health-chart" width="300" height="300"></canvas>
                </div>
            </div>
            
        </div>
    </div>

    <script>
        // Initialize Lucide icons
        lucide.createIcons();
        
        // Dashboard data management
        let dashboardData = {
            health: null,
            metrics: null,
            analytics: null,
            config: null
        };
        
        // Current filter state
        let currentPeriod = 'today';

        // WebSocket connection for real-time updates
        let socket = null;
        
        function initializeWebSocket() {
            try {
                socket = io();
                
                socket.on('connect', () => {
                    console.log('🔌 Connected to WebSocket server');
                    // Subscribe to dashboard updates
                    socket.emit('subscribe', ['dashboard-overview', 'metrics', 'health']);
                });
                
                socket.on('dashboard-update', (update) => {
                    console.log('📊 Real-time dashboard update received:', update);
                    
                    // Update appropriate data based on update type
                    switch (update.type) {
                        case 'metrics':
                            dashboardData.metrics = { data: update.data };
                            updateMetrics();
                            break;
                        case 'health':
                            dashboardData.health = { data: update.data };
                            updateMetrics(); // Health affects response time metric
                            break;
                        case 'incident':
                            // Refresh metrics and charts when new incident occurs
                            loadMetricsData().then(async () => {
                                updateMetrics();
                                await updateHealthChart(); // Update Critical Incident Trends
                            });
                            break;
                        case 'notification':
                            // Refresh metrics when notification is delivered
                            loadMetricsData().then(async () => {
                                updateMetrics();
                                await updateHealthChart(); // Update Critical Incident Trends if needed
                            });
                            break;
                    }
                });
                
                socket.on('disconnect', () => {
                    console.log('🔌 Disconnected from WebSocket server');
                });
                
                socket.on('connect_error', (error) => {
                    console.error('🔌 WebSocket connection error:', error);
                });
                
            } catch (error) {
                console.error('🔌 Failed to initialize WebSocket:', error);
            }
        }
        
        // Initialize WebSocket connection
        if (typeof io !== 'undefined') {
            initializeWebSocket();
        }
        
        // Update dashboard every 30 seconds as fallback for data
        setInterval(loadDashboardData, 30000);
        
        // Update charts with enhanced real-time refresh every 10 minutes
        setInterval(async () => {
            console.log('🔄 Auto-refreshing charts for real-time updates...');
            await updateCharts();
        }, 10 * 60 * 1000); // 10 minutes
        
        // Update metrics display every 5 minutes for near real-time experience  
        setInterval(() => {
            console.log('📊 Auto-refreshing metrics for live updates...');
            loadMetricsData().then(() => updateMetrics());
        }, 5 * 60 * 1000); // 5 minutes
        
        // Initial load
        loadDashboardData();
        
        async function loadDashboardData() {
            try {
                // Show loading state
                setLoadingState(true);
                console.log('🔄 Loading dashboard data...');
                
                await Promise.all([
                    loadHealthData(),
                    loadMetricsData(),
                    loadAnalyticsData(),
                    loadConfigData()
                ]);
                
                await updateUI();
                console.log('✅ Dashboard data loaded successfully');
            } catch (error) {
                console.error('❌ Failed to load dashboard data:', error);
                // Keep loading indicators on error so user knows something went wrong
            }
        }
        
        async function loadHealthData() {
            try {
                console.log('Loading health data...');
                const response = await fetch('/dashboard/api/health');
                console.log('Health API response:', response.status);
                if (response.ok) {
                    dashboardData.health = await response.json();
                    console.log('Health data loaded:', dashboardData.health);
                } else {
                    console.error('Health API failed:', response.status, response.statusText);
                }
            } catch (error) {
                console.error('Health API error:', error);
            }
        }

        async function loadMetricsData() {
            try {
                console.log('Loading metrics data for period: ' + currentPeriod + '...');
                const response = await fetch('/dashboard/api/metrics?period=' + currentPeriod);
                console.log('Metrics API response:', response.status);
                if (response.ok) {
                    dashboardData.metrics = await response.json();
                    console.log('Metrics data loaded:', dashboardData.metrics);
                    
                    // Period is now shown only by the active filter button
                    
                    // Keep Critical Incident Trends period fixed at 7 Days
                    const criticalPeriodElement = document.getElementById('critical-trends-period');
                    if (criticalPeriodElement) {
                        criticalPeriodElement.textContent = '7 Days';
                    }
                } else {
                    console.error('Metrics API failed:', response.status, response.statusText);
                }
            } catch (error) {
                console.error('Metrics API error:', error);
            }
        }
        
        async function loadAnalyticsData() {
            try {
                console.log('Loading analytics data...');
                const response = await fetch('/dashboard/api/analytics');
                console.log('Analytics API response:', response.status);
                if (response.ok) {
                    dashboardData.analytics = await response.json();
                    console.log('Analytics data loaded:', dashboardData.analytics);
                } else {
                    console.error('Analytics API failed:', response.status, response.statusText);
                }
            } catch (error) {
                console.error('Analytics API error:', error);
            }
        }
        
        async function loadConfigData() {
            try {
                console.log('Loading config data...');
                const response = await fetch('/dashboard/api/configuration');
                console.log('Config API response:', response.status);
                if (response.ok) {
                    dashboardData.config = await response.json();
                    console.log('Config data loaded:', dashboardData.config);
                } else {
                    console.error('Config API failed:', response.status, response.statusText);
                }
            } catch (error) {
                console.error('Config API error:', error);
            }
        }
        
        async function updateUI() {
            console.log('Updating UI with data:', {
                health: !!dashboardData.health,
                analytics: !!dashboardData.analytics,
                config: !!dashboardData.config
            });
            
            updateMetrics();
            await updateCharts();
            updateLastUpdated();
        }
        
        
        function setLoadingState(isLoading) {
            const metricElements = ['p1-incidents-active', 'sla-compliance', 'channel-coverage', 'last-p1-alert'];
            metricElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = isLoading ? '⏳' : '-';
                    element.style.opacity = isLoading ? '0.6' : '1';
                }
            });
        }

        function updateMetrics() {
            // Update MVP-focused metrics from the new API structure
            if (dashboardData.metrics?.data?.summary) {
                const summary = dashboardData.metrics.data.summary;
                
                // P1 Incidents Active
                const p1ActiveElement = document.getElementById('p1-incidents-active');
                if (p1ActiveElement) {
                    const p1Active = summary.p1_incidents_active || 0;
                    p1ActiveElement.textContent = p1Active;
                    // Color coding for P1 incidents
                    p1ActiveElement.className = 'metric-value';
                    if (p1Active === 0) {
                        p1ActiveElement.style.color = '#10b981'; // Green - good
                    } else if (p1Active <= 2) {
                        p1ActiveElement.style.color = '#f59e0b'; // Orange - warning
                    } else {
                        p1ActiveElement.style.color = '#ef4444'; // Red - critical
                    }
                }
                
                // SLA Compliance
                const slaElement = document.getElementById('sla-compliance');
                if (slaElement) {
                    const slaCompliance = summary.sla_compliance_percent || 100;
                    slaElement.textContent = Math.round(slaCompliance) + '%';
                    // Color coding for SLA compliance
                    slaElement.className = 'metric-value';
                    if (slaCompliance >= 98) {
                        slaElement.style.color = '#10b981'; // Green - excellent
                    } else if (slaCompliance >= 95) {
                        slaElement.style.color = '#059669'; // Dark green - good
                    } else if (slaCompliance >= 90) {
                        slaElement.style.color = '#f59e0b'; // Orange - warning
                    } else {
                        slaElement.style.color = '#ef4444'; // Red - critical
                    }
                }
                
                // Channel Coverage
                const coverageElement = document.getElementById('channel-coverage');
                if (coverageElement) {
                    const coverage = summary.channel_coverage || 0;
                    coverageElement.textContent = coverage;
                    coverageElement.style.color = coverage > 0 ? '#10b981' : '#6b7280';
                }
                
                // Last P1 Alert
                const lastP1Element = document.getElementById('last-p1-alert');
                if (lastP1Element) {
                    if (summary.last_p1_alert) {
                        const lastAlert = new Date(summary.last_p1_alert);
                        const now = new Date();
                        const diffMs = now - lastAlert;
                        const diffMinutes = Math.floor(diffMs / (1000 * 60));
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffDays = Math.floor(diffHours / 24);
                        
                        let timeText;
                        if (diffDays > 0) {
                            timeText = diffDays + 'd ago';
                        } else if (diffHours > 0) {
                            timeText = diffHours + 'h ago';
                        } else if (diffMinutes > 0) {
                            timeText = diffMinutes + 'm ago';
                        } else {
                            timeText = 'Just now';
                        }
                        
                        lastP1Element.textContent = timeText;
                        // Color coding based on recency
                        if (diffHours < 1) {
                            lastP1Element.style.color = '#ef4444'; // Red - very recent
                        } else if (diffHours < 24) {
                            lastP1Element.style.color = '#f59e0b'; // Orange - recent
                        } else {
                            lastP1Element.style.color = '#10b981'; // Green - older
                        }
                    } else {
                        lastP1Element.textContent = 'None';
                        lastP1Element.style.color = '#10b981'; // Green - no recent P1s
                    }
                }
                
                // Remove loading state from all MVP metric elements
                const metricElements = ['p1-incidents-active', 'sla-compliance', 'channel-coverage', 'last-p1-alert'];
                metricElements.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) element.style.opacity = '1';
                });
            }
        }
        
        async function updateCharts() {
            // Always update charts - use real data if available, fallback data if not
            updateActivityChart();
            await updateHealthChart();
        }
        
        // Store chart instances to prevent memory leaks
        let activityChart = null;
        let healthChart = null;
        
        function updateActivityChart() {
            const canvas = document.getElementById('activity-chart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            let labels = [];
            let responseTimeData = [];
            let notificationDeliveryData = [];
            
            // Use real data from API if available
            if (dashboardData.metrics?.data?.response_times && dashboardData.metrics.data.response_times.length > 0) {
                const responseData = dashboardData.metrics.data.response_times;
                console.log('Using real response time data:', responseData);
                
                labels = responseData.map(item => {
                    const date = new Date(item.time_period);
                    if (currentPeriod === 'today') {
                        return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
                    } else if (currentPeriod === 'week') {
                        return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
                    } else {
                        return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                    }
                });
                responseTimeData = responseData.map(item => item.avg_response_time_minutes);
                notificationDeliveryData = responseData.map(item => Math.round((item.avg_slack_delivery_seconds / 60) * 100) / 100);
            } else {
                // No fallback data - chart will show empty if no real data exists
                console.log('No response time data available');
                labels = [];
                responseTimeData = [];
                notificationDeliveryData = [];
            }
            
            // Destroy existing chart if it exists
            if (activityChart) {
                activityChart.destroy();
            }
            
            activityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Incident Response Time (min)',
                            data: responseTimeData,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: responseTimeData.map(time => 
                                time > 10 ? '#dc2626' : time > 5 ? '#f59e0b' : '#10b981'
                            ),
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 5
                        },
                        {
                            label: 'Slack Delivery Time (min)',
                            data: notificationDeliveryData,
                            borderColor: '#9D00FF',
                            backgroundColor: 'rgba(157, 0, 255, 0.1)',
                            fill: false,
                            tension: 0.3,
                            pointBackgroundColor: '#9D00FF',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 4
                        },
                    ]
                },
                options: {
                    responsive: true,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y + 'min';
                                },
                                afterLabel: function(context) {
                                    if (context.datasetIndex === 0) {
                                        const value = context.parsed.y;
                                        if (value > 10) return 'Status: ❌ CRITICAL (>10min)';
                                        if (value > 5) return 'Status: ⚠️ WARNING (>5min)';
                                        return 'Status: ✅ GOOD (<5min)';
                                    }
                                    if (context.datasetIndex === 1) {
                                        const value = context.parsed.y;
                                        if (value < 0.5) return 'Delivery: ✅ FAST (<30s)';
                                        if (value < 1) return 'Delivery: ⚠️ MODERATE (<1min)';
                                        return 'Delivery: ❌ SLOW (>1min)';
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: currentPeriod === 'today' ? 'Time (Last 24 Hours)' : 
                                      currentPeriod === 'week' ? 'Date (Last 7 Days)' : 
                                      'Date (Last 30 Days)',
                                color: '#6b7280',
                                font: { size: 12, weight: 'bold' }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Response Time (minutes)',
                                color: '#ef4444',
                                font: { size: 12, weight: 'bold' }
                            },
                            beginAtZero: true,
                            max: Math.max(15, Math.max(...responseTimeData) + 2),
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + 'min';
                                }
                            }
                        }
                    }
                }
            });
        }
        
        async function updateHealthChart() {
            const canvas = document.getElementById('health-chart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            let labels = [];
            let p1IncidentData = [];
            let p2IncidentData = [];
            
            // Always fetch 7 days of data for Critical Incident Trends, regardless of current period filter
            try {
                console.log('Fetching 7 days incident trend data for Critical Incident Trends...');
                const response = await fetch('/dashboard/api/metrics?period=week');
                if (response.ok) {
                    const weekData = await response.json();
                    if (weekData.data?.incident_trends && weekData.data.incident_trends.length > 0) {
                        const incidentData = weekData.data.incident_trends;
                        console.log('Using real 7-day incident trend data:', incidentData);
                        
                        labels = incidentData.map(item => {
                            const date = new Date(item.time_period);
                            return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                        });
                        p1IncidentData = incidentData.map(item => item.p1_incidents || 0);
                        p2IncidentData = incidentData.map(item => item.p2_incidents || 0);
                    } else {
                        throw new Error('No incident trend data available');
                    }
                } else {
                    throw new Error('Failed to fetch incident trend data');
                }
            } catch (error) {
                console.error('Error fetching 7-day incident data:', error);
                // Fallback to 7 days of sample data only if API fails
                console.log('Using 7-day sample incident trend data as fallback');
                const now = new Date();
                
                for (let i = 6; i >= 0; i--) {
                    const time = new Date(now);
                    time.setDate(time.getDate() - i);
                    labels.push(time.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
                    
                    // Daily incident simulation - realistic weekday vs weekend patterns
                    const dayOfWeek = time.getDay();
                    const p1Count = (dayOfWeek >= 1 && dayOfWeek <= 5) ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2);
                    const p2Count = (dayOfWeek >= 1 && dayOfWeek <= 5) ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 3);
                    
                    p1IncidentData.push(p1Count);
                    p2IncidentData.push(p2Count);
                }
            }
            
            // Destroy existing chart if it exists
            if (healthChart) {
                healthChart.destroy();
            }
            
            healthChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'P1 (Critical)',
                            data: p1IncidentData,
                            backgroundColor: '#ef4444',
                            borderColor: '#dc2626',
                            borderWidth: 1,
                            borderRadius: 4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'P2 (High)',
                            data: p2IncidentData,
                            backgroundColor: '#f59e0b',
                            borderColor: '#d97706',
                            borderWidth: 1,
                            borderRadius: 4,
                            yAxisID: 'y'
                        },
                    ]
                },
                options: {
                    responsive: true,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                afterLabel: function(context) {
                                    if (context.datasetIndex === 0) {
                                        const value = context.parsed.y;
                                        if (value === 0) return 'Status: ✅ NO CRITICAL INCIDENTS';
                                        if (value === 1) return 'Status: ⚠️ ONE CRITICAL INCIDENT';
                                        return 'Status: ❌ MULTIPLE CRITICAL INCIDENTS';
                                    }
                                    if (context.datasetIndex === 1) {
                                        const value = context.parsed.y;
                                        if (value <= 2) return 'Load: ✅ LIGHT';
                                        if (value <= 4) return 'Load: ⚠️ MODERATE';
                                        return 'Load: ❌ HEAVY';
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Date (Last 7 Days)',
                                color: '#6b7280',
                                font: { size: 12, weight: 'bold' }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Incident Count',
                                color: '#ef4444',
                                font: { size: 12, weight: 'bold' }
                            },
                            beginAtZero: true,
                            max: Math.max(6, Math.max(...p1IncidentData, ...p2IncidentData) + 1),
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
        
        
        // Interactive Functions
        function refreshDashboard() {
            console.log('🔄 Refresh button clicked!');
            const refreshBtn = document.getElementById('refresh-btn');
            if (!refreshBtn) {
                console.error('❌ Refresh button not found!');
                return;
            }
            
            // Store original content
            const originalContent = refreshBtn.innerHTML;
            console.log('📝 Original button content saved');
            
            // Set loading state
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i data-lucide="loader-2" style="width: 16px; height: 16px;" class="refresh-loading"></i> Refreshing...';
            console.log('⏳ Loading state applied');
            
            // Reinitialize lucide icons for the new loading icon
            try {
                lucide.createIcons();
            } catch (e) {
                console.log('Note: Lucide icon creation skipped');
            }
            
            console.log('🚀 Starting dashboard refresh...');
            loadDashboardData().then(() => {
                console.log('✅ Dashboard refresh completed successfully');
                
                // Continue spinning for a moment before showing success
                setTimeout(() => {
                    // Show success feedback with brand vibe
                    refreshBtn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i> Updated';
                    refreshBtn.classList.add('success-feedback');
                    console.log('🎉 Success feedback applied');
                    
                    try {
                        lucide.createIcons();
                    } catch (iconError) {
                        console.warn('⚠️ Could not create icons:', iconError);
                    }
                }, 500); // 500ms delay to let the spinner complete a few rotations
                
                // Restore original state after delay
                setTimeout(() => {
                    console.log('🔄 Restoring original button state');
                    refreshBtn.innerHTML = originalContent;
                    refreshBtn.classList.remove('success-feedback');
                    refreshBtn.disabled = false;
                    
                    try {
                        lucide.createIcons();
                    } catch (e) {
                        console.log('Note: Lucide icon creation skipped');
                    }
                }, 1500);
                
            }).catch((error) => {
                console.error('❌ Refresh failed:', error);
                
                // Show error feedback
                refreshBtn.innerHTML = '<i data-lucide="x-circle" style="width: 16px; height: 16px;"></i> Error';
                refreshBtn.classList.add('error-feedback');
                console.log('💥 Error feedback applied');
                
                try {
                    lucide.createIcons();
                } catch (e) {
                    console.log('Note: Lucide icon creation skipped');
                }
                
                // Restore original state after delay
                setTimeout(() => {
                    console.log('🔄 Restoring original button state after error');
                    refreshBtn.innerHTML = originalContent;
                    refreshBtn.classList.remove('error-feedback');
                    refreshBtn.disabled = false;
                    
                    try {
                        lucide.createIcons();
                    } catch (e) {
                        console.log('Note: Lucide icon creation skipped');
                    }
                }, 2000);
            });
        }
        
        function updateLastUpdated() {
            const lastUpdatedEl = document.getElementById('last-updated');
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            lastUpdatedEl.querySelector('span').textContent = 'Last updated: ' + timeStr;
        }
        
        
        
        // Handle time filter changes
        function handleFilterChange(period) {
            console.log('Filter changed to: ' + period);
            currentPeriod = period;
            
            // Update active filter button
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.period === period) {
                    btn.classList.add('active');
                }
            });
            
            // Reload data and update only activity chart (not critical incidents chart)
            loadMetricsData().then(async () => {
                updateMetrics();
                updateActivityChart(); // Only update the response times chart
                updateLastUpdated();
            });
        }

        // Initialize event listeners when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Initializing dashboard event listeners...');
            
            // Main refresh button
            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', refreshDashboard);
                console.log('✅ Main refresh button event listener added');
            }
            
            // Time filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const period = btn.dataset.period;
                    if (period) {
                        handleFilterChange(period);
                    }
                });
            });
            console.log('✅ Filter button event listeners added');
            
            console.log('🎉 All event listeners initialized successfully!');
        });
        
    </script>
</body>
</html>`;
}

// =============================================
// DATABASE HELPER FUNCTIONS FOR REAL DATA
// =============================================

/**
 * Get incident trends from database
 */
async function getIncidentTrends(startDate: Date, endDate: Date, period: string) {
  try {
    let groupBy = 'DATE(i.created_at)';
    let dateFormat = 'YYYY-MM-DD';
    
    if (period === 'today') {
      groupBy = 'DATE_TRUNC(\'hour\', i.created_at)';
      dateFormat = 'HH24:MI';
    } else if (period === 'week') {
      groupBy = 'DATE(i.created_at)';
      dateFormat = 'MM-DD';
    }

    const result = await database.query(`
      SELECT 
        ${groupBy} as time_bucket,
        COUNT(CASE WHEN i.priority = '1' THEN 1 END) as p1_incidents,
        COUNT(CASE WHEN i.priority = '2' THEN 1 END) as p2_incidents,
        COUNT(CASE WHEN i.priority IN ('3','4','5') THEN 1 END) as other_incidents,
        AVG(CASE WHEN sn.delivery_latency_ms IS NOT NULL THEN sn.delivery_latency_ms / 60000.0 END) as avg_resolution_time_minutes
      FROM incidents i
      LEFT JOIN slack_notifications sn ON i.id = sn.incident_id
      WHERE i.created_at >= $1 AND i.created_at <= $2
      GROUP BY ${groupBy}
      ORDER BY time_bucket ASC
    `, [startDate, endDate]);

    return result.rows.map(row => ({
      time_period: row.time_bucket,
      p1_incidents: parseInt(row.p1_incidents) || 0,
      p2_incidents: parseInt(row.p2_incidents) || 0,
      other_incidents: parseInt(row.other_incidents) || 0,
      avg_resolution_time_minutes: Math.round(parseFloat(row.avg_resolution_time_minutes) || 120)
    }));
    
  } catch (error) {
    logger.error('Failed to get incident trends:', error);
    return [];
  }
}

/**
 * Get response time data from database
 */
async function getResponseTimeData(startDate: Date, endDate: Date, period: string) {
  try {
    // Use incident creation time for grouping to show response times for all incidents
    let groupBy = period === 'today' ? 'DATE_TRUNC(\'hour\', i.created_at)' : 'DATE_TRUNC(\'day\', i.created_at)';

    const result = await database.query(`
      SELECT 
        ${groupBy} as time_bucket,
        AVG(CASE 
          WHEN i.priority = '1' AND i.incident_response_time_minutes IS NOT NULL 
          THEN i.incident_response_time_minutes * 60  -- Convert minutes to seconds for P1 incidents
          WHEN sn.delivery_latency_ms IS NOT NULL 
          THEN sn.delivery_latency_ms / 1000.0 
          ELSE 45 
        END) as avg_response_time_seconds,
        AVG(CASE 
          WHEN sn.sent_at IS NOT NULL AND sn.created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (sn.sent_at - sn.created_at)) 
          ELSE 20 
        END) as avg_slack_delivery_seconds,
        COUNT(i.id) as incident_count,
        COUNT(CASE WHEN i.priority = '1' AND i.incident_response_time_minutes IS NOT NULL THEN 1 END) as p1_with_response_time
      FROM incidents i
      LEFT JOIN slack_notifications sn ON i.id = sn.incident_id
      WHERE i.created_at >= $1 AND i.created_at <= $2
      GROUP BY ${groupBy}
      ORDER BY time_bucket ASC
    `, [startDate, endDate]);

    return result.rows.map(row => ({
      time_period: row.time_bucket,
      avg_response_time_seconds: Math.round(parseFloat(row.avg_response_time_seconds) || 45),
      avg_slack_delivery_seconds: Math.round(parseFloat(row.avg_slack_delivery_seconds) || 20),
      incident_count: parseInt(row.incident_count) || 0
    }));
    
  } catch (error) {
    logger.error('Failed to get response time data:', error);
    return [];
  }
}

export { router as dashboardRoutes };