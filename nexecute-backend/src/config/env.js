import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'SERVICENOW_INSTANCE_URL',
  'SERVICENOW_CLIENT_ID', 
  'SERVICENOW_CLIENT_SECRET',
  'ENCRYPTION_KEY',
  'JWT_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Validate ENCRYPTION_KEY format
const encryptionKey = process.env.ENCRYPTION_KEY;
if (encryptionKey.length !== 64) {
  console.error('❌ ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  process.exit(1);
}

console.log('✅ Environment variables loaded and validated');

export default {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3001,
  
  // ServiceNow
  SERVICENOW_INSTANCE_URL: process.env.SERVICENOW_INSTANCE_URL,
  SERVICENOW_CLIENT_ID: process.env.SERVICENOW_CLIENT_ID,
  SERVICENOW_CLIENT_SECRET: process.env.SERVICENOW_CLIENT_SECRET,
  
  // Security
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  
  // Frontend URL
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};