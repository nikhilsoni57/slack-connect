# Webhook Processing Documentation

## Overview

The webhook system handles incoming events from ServiceNow and Slack, processing them in real-time to update the dashboard and trigger appropriate notifications. The system is designed for high reliability and comprehensive data capture.

## Architecture

### Webhook Flow
```
ServiceNow/Slack → Validation → Data Capture → Processing → Dashboard Update → WebSocket Broadcast
```

### Core Components

1. **Validation Middleware** (`src/middleware/validation.ts`)
2. **Data Capture Middleware** (`src/middleware/dataCapture.ts`)
3. **Webhook Routes** (`src/routes/webhooks.ts`)
4. **Notification Services** (`src/services/notificationService.ts`)

## ServiceNow Webhooks

### Endpoint
- **POST** `/webhooks/servicenow`
- **Content-Type**: `application/json`
- **Validation**: Payload structure and field formats

### Supported Event Types
- `created` - New incident created
- `updated` - Incident modified
- `resolved` - Incident closed/resolved
- `deleted` - Incident removed

### Payload Structure
```json
{
  "incident": {
    "sys_id": "32-character-uuid",
    "number": "INC0010001",
    "short_description": "Critical system failure",
    "description": "Detailed description",
    "priority": "1",
    "state": "1",
    "category": "hardware",
    "urgency": "1",
    "impact": "1",
    "assigned_to": "admin",
    "caller_id": "user123",
    "sys_created_on": "2024-09-12T16:45:00.000Z",
    "sys_updated_on": "2024-09-12T16:50:00.000Z",
    "resolved_at": "2024-09-12T17:30:00.000Z"
  },
  "activities": 1,
  "event_type": "created"
}
```

### Validation Rules

#### Required Fields
- `incident.sys_id` - Must be 32-character hex string
- `incident.number` - Must match pattern `INC\d{7}`
- `incident.priority` - Must be '1', '2', '3', '4', or '5'
- `incident.state` - Must be valid ServiceNow state
- `event_type` - Must be supported event type

#### Date Format Validation
```typescript
// All dates must be valid ISO 8601 strings
const isValidISODate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && 
         !isNaN(date.getTime()) && 
         date.toISOString() === dateString;
}
```

### Processing Logic

#### Incident Creation (`event_type: 'created'`)
```typescript
const incidentId = await dashboardService.createIncident({
  servicenow_id: incident.sys_id,
  servicenow_instance_id: 'd3c89498-583a-4710-958c-dc74bded1ca9',
  number: incident.number,
  title: incident.short_description,
  priority: incident.priority,
  state: incident.state,
  created_at: new Date(incident.sys_created_on),
  updated_at: new Date(incident.sys_updated_on)
});
```

#### Incident Updates (`event_type: 'updated'`)
- Uses upsert pattern to handle missing incidents
- Calculates response time for P1 incidents with activities
- Updates incident state and metadata

#### Response Time Calculation
```typescript
// For P1 incidents with first activity
if (incident.priority === '1' && req.body.activities > 0) {
  const createdAt = new Date(incident.sys_created_on);
  const updatedAt = new Date(incident.sys_updated_on);
  const responseTimeMinutes = Math.round(
    (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60)
  );
}
```

## Slack Webhooks

### Endpoints
- **POST** `/webhooks/slack` - Main event handler
- **POST** `/webhooks/slack/interactive` - Button interactions
- **POST** `/webhooks/slack/slash` - Slash commands

### Security Validation
```typescript
// HMAC-SHA256 signature verification
const signature = req.headers['x-slack-signature'];
const timestamp = req.headers['x-slack-request-timestamp'];
const body = JSON.stringify(req.body);

const isValid = verifySlackSignature(signature, body, timestamp);
```

### Event Processing
- Slash command handling (`/incident`, `/status`)
- Interactive component responses
- User activity tracking

## Data Capture System

### Comprehensive Logging
The data capture middleware records all webhook activity:

#### Webhook Request Logging
```typescript
await dashboardService.logWebhookRequest({
  source: 'servicenow' | 'slack',
  endpoint: req.path,
  method: req.method,
  headers: req.headers,
  body: JSON.stringify(req.body),
  ip_address: req.ip,
  user_agent: req.get('User-Agent')
});
```

#### User Activity Tracking
```typescript
await dashboardService.recordUserActivity({
  workspace_id: req.workspaceId,
  user_id: req.slackUser,
  activity_type: 'slash_command',
  command: req.slackCommand,
  channel_id: req.slackChannel,
  response_time_ms: responseTime,
  success: res.statusCode < 400
});
```

### Notification Delivery Tracking
```typescript
// Track Slack notification delivery
const notificationId = await dashboardService.createSlackNotification({
  incident_id: req.incidentId,
  workspace_id: req.workspaceId || 'd3c89498-583a-4710-958c-dc74bded1ca9',
  channel_id: req.slackChannel,
  message_ts: data.ts
});

await dashboardService.updateNotificationDelivery({
  id: notificationId,
  delivery_status: 'sent',
  delivery_latency_ms: deliveryTime
});
```

## Error Handling

### Validation Errors
```json
{
  "success": false,
  "error": "Invalid ServiceNow webhook payload",
  "validation_errors": [
    {
      "field": "incident.sys_created_on",
      "message": "Invalid created date format"
    }
  ],
  "code": "SERVICENOW_VALIDATION_FAILED"
}
```

### Processing Errors
- Comprehensive error logging
- Graceful degradation
- Webhook processing continues despite errors
- Failed operations logged for analysis

## Performance Optimizations

### Async Processing
- Uses `setImmediate()` for non-blocking operations
- Dashboard refresh triggered asynchronously
- WebSocket broadcasts don't block webhook response

### Database Efficiency
- Connection pooling
- Materialized view refresh on data changes
- Optimized queries for dashboard updates

### Memory Management
- Request data cleanup
- Connection monitoring
- Graceful error recovery

## Monitoring and Debugging

### Health Checks
```bash
# Test ServiceNow webhook
curl -X POST http://localhost:3001/webhooks/servicenow \
  -H "Content-Type: application/json" \
  -d '{"incident": {...}, "event_type": "created"}'

# Check webhook logs
curl -s http://localhost:3001/dashboard/api/analytics | jq '.webhook_activity'
```

### Common Issues

#### Webhook Validation Failures
- **Cause**: Invalid date formats or missing required fields
- **Solution**: Ensure ISO 8601 date format and complete payload structure
- **Debug**: Check validation error messages in response

#### Missing Incident Data
- **Cause**: Upsert logic not handling edge cases
- **Solution**: Verify sys_id consistency across create/update calls
- **Debug**: Check incident creation logs

#### Slow Webhook Processing
- **Cause**: Database connection issues or slow queries
- **Solution**: Monitor connection pool and query performance
- **Debug**: Review webhook processing timing logs

## Security Considerations

### Input Validation
- Strict payload validation
- SQL injection prevention
- XSS protection for logged data

### Rate Limiting
```typescript
// Webhook-specific rate limiting
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 50,                  // 50 requests per minute
  message: 'Webhook rate limit exceeded'
});
```

### Data Sanitization
- Sanitize all logged webhook data
- Remove sensitive information
- Prevent log injection attacks

## Testing

### Unit Tests
```bash
# Test webhook validation
npm run test:webhooks

# Test data capture middleware
npm run test:middleware
```

### Integration Tests
```bash
# Test full webhook flow
npm run test:integration

# Load test webhook endpoints
npm run test:load
```

### Manual Testing
```bash
# Create test incident
curl -X POST http://localhost:3001/webhooks/servicenow \
  -H "Content-Type: application/json" \
  -d @test-fixtures/incident-created.json

# Update incident
curl -X POST http://localhost:3001/webhooks/servicenow \
  -H "Content-Type: application/json" \
  -d @test-fixtures/incident-updated.json
```

## ServiceNow Configuration

### Business Rule Setup
```javascript
// ServiceNow Business Rule (Async)
if (current.operation() == 'insert' || current.operation() == 'update') {
  var payload = {
    incident: {
      sys_id: current.sys_id.toString(),
      number: current.number.toString(),
      short_description: current.short_description.toString(),
      priority: current.priority.toString(),
      state: current.state.toString(),
      sys_created_on: current.sys_created_on.getDisplayValue(),
      sys_updated_on: current.sys_updated_on.getDisplayValue()
    },
    event_type: current.operation() == 'insert' ? 'created' : 'updated',
    activities: current.activity_due.changes() ? 1 : 0
  };
  
  var request = new sn_ws.RESTMessageV2();
  request.setEndpoint('https://your-app.com/webhooks/servicenow');
  request.setHttpMethod('POST');
  request.setRequestHeader('Content-Type', 'application/json');
  request.setRequestBody(JSON.stringify(payload));
  request.executeAsync();
}