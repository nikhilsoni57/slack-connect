// Load and validate environment variables FIRST
import config from './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { serviceNowRoutes } from './routes/servicenow.js';
import { serviceNowBasicRoutes } from './routes/servicenow-basic.js';
import { slackRoutes } from './routes/slack.js';
import { healthRoutes } from './routes/health.js';


const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://nexecute-connect.com'] 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check (before API versioning)
app.use('/health', healthRoutes);

// API Routes
app.use('/api/v1/connections/servicenow', serviceNowRoutes);
app.use('/api/v1/connections/servicenow', serviceNowBasicRoutes);
app.use('/api/v1/connections/slack', slackRoutes);

// OAuth callback routes (matching ServiceNow configuration)
app.use('/auth/servicenow', serviceNowRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Nexecute Connect API Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 ServiceNow Instance: ${process.env.SERVICENOW_INSTANCE_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;