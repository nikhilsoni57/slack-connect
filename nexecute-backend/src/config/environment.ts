import dotenv from 'dotenv';
import { EnvironmentConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

// Comprehensive environment variable validation
const validateEnvironment = (): EnvironmentConfig => {
  const errors: string[] = [];
  
  // Required variables
  const requiredVars = [
    'SERVICENOW_INSTANCE_URL',
    'SERVICENOW_CLIENT_ID', 
    'SERVICENOW_CLIENT_SECRET',
    'SLACK_APP_ID',
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET',
    'SLACK_SIGNING_SECRET',
    'SLACK_VERIFICATION_TOKEN',
    'ENCRYPTION_KEY',
    'JWT_SECRET',
    'SESSION_SECRET'
  ] as const;

  // Check required variables
  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate specific formats
  if (process.env.SERVICENOW_INSTANCE_URL && !process.env.SERVICENOW_INSTANCE_URL.startsWith('https://')) {
    errors.push('SERVICENOW_INSTANCE_URL must start with https://');
  }

  if (process.env.ENCRYPTION_KEY) {
    if (process.env.ENCRYPTION_KEY.length !== 64) {
      errors.push('ENCRYPTION_KEY must be exactly 64 characters (32 bytes hex)');
    }
    
    // Validate hex format
    if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
      errors.push('ENCRYPTION_KEY must be a valid 64-character hexadecimal string');
    }
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1024 || port > 65535) {
      errors.push('PORT must be a valid port number between 1024 and 65535');
    }
  }

  // If there are validation errors, log them and exit
  if (errors.length > 0) {
    logger.error('❌ Environment validation failed:');
    errors.forEach(error => logger.error(`  - ${error}`));
    process.exit(1);
  }

  // Build configuration object
  const config: EnvironmentConfig = {
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    
    // ServiceNow
    SERVICENOW_INSTANCE_URL: process.env.SERVICENOW_INSTANCE_URL!,
    SERVICENOW_CLIENT_ID: process.env.SERVICENOW_CLIENT_ID!,
    SERVICENOW_CLIENT_SECRET: process.env.SERVICENOW_CLIENT_SECRET!,
    
    // Slack
    SLACK_APP_ID: process.env.SLACK_APP_ID!,
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID!,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET!,
    SLACK_VERIFICATION_TOKEN: process.env.SLACK_VERIFICATION_TOKEN!,
    
    // Security
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
    JWT_SECRET: process.env.JWT_SECRET!,
    SESSION_SECRET: process.env.SESSION_SECRET!,
    
    // Optional
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    SERVICENOW_RATE_LIMIT: parseInt(process.env.SERVICENOW_RATE_LIMIT || '2000', 10),
    SLACK_RATE_LIMIT: parseInt(process.env.SLACK_RATE_LIMIT || '50', 10),
    COOKIE_MAX_AGE: parseInt(process.env.COOKIE_MAX_AGE || '86400000', 10)
  };

  return config;
};

// Validate and export configuration
export const config = validateEnvironment();

// Log successful validation
logger.info('✅ Environment variables loaded and validated successfully');
logger.info(`🔧 Running in ${config.NODE_ENV} mode on port ${config.PORT}`);
logger.info(`🔗 ServiceNow Instance: ${config.SERVICENOW_INSTANCE_URL}`);
logger.info(`📱 Slack App ID: ${config.SLACK_APP_ID}`);

export default config;