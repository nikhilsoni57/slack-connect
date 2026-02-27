#!/usr/bin/env node

/**
 * Test script to verify webhook data capture is working
 * Simulates Slack slash command and ServiceNow incident webhook events
 */

// Using built-in fetch API available in Node.js 18+

const BASE_URL = 'http://localhost:3001';

async function testSlackSlashCommand() {
  console.log('🧪 Testing Slack slash command data capture...');
  
  try {
    const response = await fetch(`${BASE_URL}/webhooks/slack/slash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: 'test-token',
        team_id: 'T1234567890',
        team_domain: 'test-workspace',
        channel_id: 'C1234567890',
        channel_name: 'general',
        user_id: 'U1234567890',
        user_name: 'testuser',
        command: '/incident',
        text: 'create Test incident from data capture',
        response_url: 'https://hooks.slack.com/commands/1234567890/5678901234/abcdefghijklmnop',
        trigger_id: '1234567890.987654321.abcdefghijklmnopqrstuvwxyz'
      })
    });

    const result = await response.json();
    console.log('✅ Slack slash command response:', result);
    
    // Wait a moment for async data capture to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.error('❌ Slack slash command test failed:', error);
  }
}

async function testServiceNowWebhook() {
  console.log('🧪 Testing ServiceNow incident webhook data capture...');
  
  try {
    const incidentData = {
      incident: {
        sys_id: '12345678-1234-1234-1234-123456789012',
        number: 'INC0010002',
        state: '1',
        priority: '2',
        short_description: 'Test incident from data capture webhook',
        description: 'This is a test incident to verify data capture is working',
        category: 'Software',
        subcategory: 'Application',
        urgency: '2',
        impact: '2',
        assigned_to: 'admin',
        caller_id: 'testuser',
        sys_created_on: new Date().toISOString(),
        sys_updated_on: new Date().toISOString()
      },
      event_type: 'created'
    };

    const response = await fetch(`${BASE_URL}/webhooks/servicenow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(incidentData)
    });

    const result = await response.json();
    console.log('✅ ServiceNow webhook response:', result);
    
    // Wait a moment for async data capture to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.error('❌ ServiceNow webhook test failed:', error);
  }
}

async function checkDashboardData() {
  console.log('📊 Checking dashboard data after webhook events...');
  
  try {
    // Check metrics
    const metricsResponse = await fetch(`${BASE_URL}/dashboard/api/metrics`);
    const metrics = await metricsResponse.json();
    console.log('📈 Dashboard metrics:', JSON.stringify(metrics, null, 2));
    
    // Check analytics
    const analyticsResponse = await fetch(`${BASE_URL}/dashboard/api/analytics`);
    const analytics = await analyticsResponse.json();
    console.log('📊 Dashboard analytics:', JSON.stringify(analytics, null, 2));
    
  } catch (error) {
    console.error('❌ Dashboard data check failed:', error);
  }
}

async function runTests() {
  console.log('🚀 Starting webhook data capture tests...\n');
  
  // Test Slack slash command
  await testSlackSlashCommand();
  
  console.log('');
  
  // Test ServiceNow webhook
  await testServiceNowWebhook();
  
  console.log('');
  
  // Check resulting dashboard data
  await checkDashboardData();
  
  console.log('\n✨ Webhook data capture tests completed!');
}

// Run the tests
runTests().catch(console.error);