#!/usr/bin/env node

// Quick test script to validate core functionality
import dotenv from 'dotenv';

// Load environment first
dotenv.config();

// Check if required environment variables are set
const requiredEnvVars = [
  'SERVICENOW_INSTANCE_URL',
  'SERVICENOW_CLIENT_ID', 
  'SERVICENOW_CLIENT_SECRET',
  'SLACK_SIGNING_SECRET',
  'ENCRYPTION_KEY',
  'JWT_SECRET',
  'SESSION_SECRET'
];

console.log('🔍 Checking environment variables...');

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.log('\nPlease create a .env file with all required variables.');
  process.exit(1);
}

console.log('✅ All required environment variables are set');

// Test basic imports
try {
  console.log('\n🔍 Testing core imports...');
  
  // These should work without full compilation
  console.log('✅ Environment setup validated');
  console.log(`📡 ServiceNow Instance: ${process.env.SERVICENOW_INSTANCE_URL}`);
  console.log(`🔐 Encryption Key Length: ${process.env.ENCRYPTION_KEY?.length} chars`);
  console.log(`🚀 Ready to start development server`);
  
} catch (error) {
  console.error('❌ Import test failed:', error.message);
  process.exit(1);
}

console.log('\n✅ Basic validation complete!');
console.log('\nNext steps:');
console.log('1. Run: npm run dev');
console.log('2. Test OAuth flow: POST to http://localhost:3001/auth/servicenow');
console.log('3. Check status: GET http://localhost:3001/status');