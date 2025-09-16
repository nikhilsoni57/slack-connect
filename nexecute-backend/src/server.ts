import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { config } from './config/environment.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhooks.js';
import { authRoutes } from './routes/auth.js';
import { incidentRoutes } from './routes/incidents.js';
import { statusRoutes } from './routes/status.js';
import { testRoutes } from './routes/test.js';
import { dashboardRoutes } from './routes/dashboard.js';
import dashboardAPIRoutes from './routes/dashboardAPI.js';
import { testEncryption } from './utils/encryption.js';
import { database } from './database/connection.js';
import { webSocketService } from './services/websocketService.js';

const app = express();

// Create HTTP server for Socket.IO integration
const httpServer = createServer(app);

// Trust proxy for ngrok and other reverse proxies
app.set('trust proxy', true);

// Test encryption on startup
logger.info('Testing encryption functionality...');
if (testEncryption()) {
  logger.info('✅ Encryption test passed');
} else {
  logger.error('❌ Encryption test failed - check ENCRYPTION_KEY');
  process.exit(1);
}

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", // Allow inline scripts for dashboard
        "https://unpkg.com", // Allow Chart.js and Lucide from unpkg
        "https://cdn.jsdelivr.net" // Alternative CDN if needed
      ],
      connectSrc: ["'self'", config.SERVICENOW_INSTANCE_URL, "https://slack.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"]
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? ['https://nexecute-connect.com'] 
    : [config.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Slack-Signature', 'X-Slack-Request-Timestamp']
}));

// Session middleware for OAuth flows
app.use(session({
  secret: config.SESSION_SECRET,
  name: 'nexecute.session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: config.COOKIE_MAX_AGE, // 24 hours default
    sameSite: 'lax'
  }
}));

// Rate limiting - different limits for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { 
    success: false, 
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Higher limit for webhooks
  message: { 
    success: false, 
    error: 'Webhook rate limit exceeded',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Stricter limit for auth endpoints
  message: { 
    success: false, 
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
// Temporarily disable webhook rate limiting for development
// app.use('/webhooks/', webhookLimiter);
app.use('/auth/', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (logos, assets)
app.use('/assets', express.static('public/assets'));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  });
  next();
});

// Health check endpoints (no authentication required)
app.use('/health', healthRoutes);

// Status endpoints (no authentication required for system monitoring)
app.use('/status', statusRoutes);

// Webhook endpoints (signature-based authentication)
app.use('/webhooks', webhookRoutes);

// Authentication endpoints
app.use('/auth', authRoutes);

// API endpoints (require session-based authentication)
app.use('/api/v1/incidents', incidentRoutes);

// Dashboard API endpoints (real-time data APIs) - MUST come first to take precedence
app.use('/dashboard/api', dashboardAPIRoutes);
// Dashboard endpoints (professional monitoring interface)
app.use('/dashboard', dashboardRoutes);

// Test endpoints (for development and integration testing)
app.use('/test', testRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Nexecute Connect API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      status: '/status',
      auth: '/auth',
      webhooks: '/webhooks',
      incidents: '/api/v1/incidents',
      dashboard: '/dashboard'
    },
    documentation: 'https://github.com/nexecute/nexecute-connect'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database schema
    await database.initializeSchema();
    logger.info('🗄️ Database initialized successfully');
    
    // Initialize WebSocket service
    webSocketService.initialize(httpServer);
    logger.info('🔌 WebSocket service initialized');
    
    // Start HTTP server
    const server = httpServer.listen(config.PORT, () => {
      logger.info(`🚀 Nexecute Connect API Server running on port ${config.PORT}`);
  logger.info(`📝 Environment: ${config.NODE_ENV}`);
  logger.info(`🔗 ServiceNow Instance: ${config.SERVICENOW_INSTANCE_URL}`);
  logger.info(`📱 Slack App ID: ${config.SLACK_APP_ID}`);
  logger.info(`🌐 Frontend URL: ${config.FRONTEND_URL}`);
  
  // Log available endpoints
  logger.info('🔗 Available endpoints:');
  logger.info('   GET  /health - API health check');
  logger.info('   GET  /health/detailed - Detailed service health');
  logger.info('   POST /auth/servicenow - Start ServiceNow OAuth');
  logger.info('   GET  /auth/servicenow/callback - OAuth callback');
  logger.info('   GET  /auth/servicenow/status - Auth status');
  logger.info('   POST /webhooks/slack - Slack webhook');
  logger.info('   GET  /api/v1/incidents - List incidents');
  logger.info('   POST /api/v1/incidents - Create incident');
  logger.info('   PUT  /api/v1/incidents/:id - Update incident');
  logger.info('   GET  /dashboard - Real-time monitoring dashboard');
  logger.info('   GET  /dashboard/api/* - Dashboard API endpoints');
    });

    return server;
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().then((server) => {
  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} signal received: closing HTTP server`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      // Close database connections
      try {
        await database.close();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error('Error closing database:', error);
      }
      
      // Cleanup WebSocket service
      try {
        await webSocketService.cleanup();
        logger.info('WebSocket service cleaned up');
      } catch (error) {
        logger.error('Error cleaning up WebSocket service:', error);
      }
      
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;