# Nexecute Connect API Documentation

> Professional API documentation for the ServiceNow-Slack integration platform

## Getting Started

The Nexecute Connect API provides enterprise-grade endpoints for ServiceNow integration, real-time monitoring, and webhook processing. All endpoints include comprehensive error handling, input validation, and performance optimization.

### Base URL
```
http://localhost:3001
```

### Authentication
OAuth 2.0 flow with ServiceNow and JWT session management for API access.

## Core API Endpoints

### Authentication Endpoints

#### Initialize ServiceNow OAuth Flow
```http
POST /auth/servicenow
```

Initiates the OAuth 2.0 authorization flow with ServiceNow.

**Response:**
```json
{
  "success": true,
  "authorization_url": "https://instance.service-now.com/oauth_auth.do?...",
  "state": "secure_random_state"
}
```

#### OAuth Callback Handler
```http
GET /auth/servicenow/callback?code={code}&state={state}
```

Handles the OAuth callback and exchanges authorization code for access tokens.

## Dashboard API Endpoints

### System Health Check
```http
GET /dashboard/api/health
```

Returns comprehensive system health and connectivity status.

**Response:**
```json
{
  "success": true,
  "data": {
    "system_status": "healthy",
    "database": {
      "status": "connected",
      "response_time_ms": 12
    },
    "servicenow": {
      "status": "connected", 
      "response_time_ms": 245
    },
    "slack": {
      "status": "connected",
      "response_time_ms": 156
    }
  }
}
```

### Real-time Metrics
```http
GET /dashboard/api/metrics?period={period}
```

Retrieves live system metrics and incident analytics.

**Parameters:**
- `period` (optional): `today`, `week`, `month` (default: `week`)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "p1_incidents_active": 12,
      "sla_compliance_percent": 98.5,
      "avg_response_time_minutes": 4.2,
      "total_incidents": 156
    },
    "incident_trends": [...],
    "response_times": [...]
  }
}
```

### Advanced Analytics
```http
GET /dashboard/api/analytics
```

Returns detailed analytics data for dashboard visualizations.

## Webhook Endpoints

### ServiceNow Incident Webhook
```http
POST /webhooks/servicenow
```

Processes ServiceNow incident creation, updates, and resolution events.

**Headers:**
```
Content-Type: application/json
```

**Body Example:**
```json
{
  "incident": {
    "sys_id": "32char_servicenow_id",
    "number": "INC0001234",
    "state": "2",
    "priority": "1",
    "short_description": "Critical service outage",
    "sys_created_on": "2025-09-15T10:00:00.000Z"
  },
  "event_type": "created"
}
```

### Slack Webhook Handler
```http
POST /webhooks/slack
```

Handles Slack events, interactive components, and slash commands with signature verification.

## Incident Management API

### List Incidents
```http
GET /api/v1/incidents?priority={priority}&state={state}&limit={limit}
```

Retrieves incidents with filtering and pagination.

**Parameters:**
- `priority` (optional): `1`, `2`, `3`, `4`, `5`
- `state` (optional): `1` (New), `2` (In Progress), `6` (Resolved)
- `limit` (optional): Maximum results (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "incidents": [...],
    "total": 156,
    "page": 1,
    "limit": 50
  }
}
```

## Security Features

### Rate Limiting
- **API Endpoints**: 100 requests per 15 minutes
- **Webhook Endpoints**: 50 requests per minute
- **Authentication**: 10 attempts per 15 minutes

### Input Validation
- Comprehensive payload validation for all endpoints
- Sanitization of user inputs and webhook data
- HMAC-SHA256 signature verification for webhooks

### Error Handling
All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2025-09-15T10:00:00.000Z"
}
```

## Performance

### Response Times
- **Health Checks**: < 50ms average
- **Metrics API**: < 100ms average  
- **Webhook Processing**: < 200ms average
- **Database Queries**: < 50ms average

### Optimization Features
- PostgreSQL connection pooling
- Materialized views for analytics
- WebSocket for real-time updates
- Comprehensive caching strategies

## Development

### Testing Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Dashboard metrics
curl http://localhost:3001/dashboard/api/metrics

# System health
curl http://localhost:3001/dashboard/api/health
```

### WebSocket Events
The dashboard supports real-time updates via WebSocket connection:
```javascript
const socket = io('http://localhost:3001');
socket.on('incident_update', (data) => {
  // Handle real-time incident updates
});
```

---

**For Internal Documentation**: See `docs/internal/` for detailed technical implementation, deployment guides, and system architecture documentation.