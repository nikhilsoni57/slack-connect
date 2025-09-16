# Dashboard System Documentation

## Overview

The Nexecute Connect Dashboard provides real-time monitoring and analytics for the ServiceNow-Slack integration platform. Built with WebSocket technology, it delivers live updates and comprehensive system insights.

## Architecture

### Core Components

1. **Dashboard Service** (`src/services/dashboardService.ts`)
   - Handles all dashboard data operations
   - Manages PostgreSQL queries with materialized views
   - Provides aggregated metrics and analytics

2. **WebSocket Service** (`src/services/websocketService.ts`)
   - Manages real-time client connections
   - Broadcasts live updates to connected clients
   - Handles client subscriptions and heartbeats

3. **Data Capture Middleware** (`src/middleware/dataCapture.ts`)
   - Captures webhook events for dashboard processing
   - Records user activity and incident data
   - Triggers real-time dashboard updates

## Dashboard Metrics

### Primary Metrics Cards

#### P1 Incidents Active
- **Purpose**: Count of critical open incidents (states 1, 2, 3)
- **Query**: `COUNT(CASE WHEN i.priority = '1' AND i.state IN ('1', '2', '3') THEN 1 END)`
- **Color Coding**: Green (0), Yellow (1-5), Red (6+)

#### SLA Compliance
- **Purpose**: Percentage meeting 30-second notification target
- **Calculation**: Notifications delivered ≤30s / Total notifications × 100
- **Target**: 95% compliance

#### Channel Coverage
- **Purpose**: Number of active Slack workspaces
- **Source**: Active workspace count from integrations

#### Last P1 Alert
- **Purpose**: Time since last critical incident
- **Format**: Relative time display (e.g., "2m ago")

## Analytics Charts

### Incident Response Times Chart
- **Data Sources**: 
  - P1 incident response times (creation → first activity)
  - Slack delivery latencies converted to minutes
- **Time Periods**: Last 7 days with hourly granularity
- **Visualization**: Dual-dataset line chart with Chart.js

#### Data Processing
```sql
-- P1 Response Time Calculation
AVG(CASE 
  WHEN i.priority = '1' AND i.incident_response_time_minutes IS NOT NULL 
  THEN i.incident_response_time_minutes * 60
  WHEN sn.delivery_latency_ms IS NOT NULL 
  THEN sn.delivery_latency_ms / 1000.0 
  ELSE 45 
END) as avg_response_time_seconds
```

### Critical Incident Trends Chart
- **Purpose**: P1 and P2 incident counts by hour
- **Time Window**: Last 7 days
- **Granularity**: Hourly buckets
- **Visualization**: Stacked bar chart

## WebSocket Integration

### Connection Management
```typescript
interface DashboardClient {
  id: string;
  socket: Socket;
  subscriptions: Set<string>;
  lastHeartbeat: Date;
}
```

### Subscription Types
- `dashboard-overview`: Main dashboard data
- `metrics`: Real-time metrics updates
- `health`: System health status
- `analytics`: Advanced analytics data

### Real-time Updates

#### Incident Updates
```typescript
// Triggered on incident creation/update/resolution
await webSocketService.notifyIncidentUpdate({
  incident: incidentData,
  event_type: 'created' | 'updated' | 'resolved',
  metrics_updated: true
});
```

#### Delivery Updates
```typescript
// Triggered on Slack notification delivery
await webSocketService.notifyDeliveryUpdate({
  incident_id: incidentId,
  delivery_status: 'sent' | 'failed',
  delivery_latency_ms: responseTime
});
```

## Database Schema

### Key Tables

#### Incidents
- Stores ServiceNow incident data
- Includes response time calculations
- Tracks incident lifecycle states

#### Slack Notifications
- Records notification delivery attempts
- Tracks delivery latency and success rates
- Links to incidents for analytics

#### Webhook Logs
- Captures all incoming webhook data
- Enables audit trails and debugging
- Performance metrics collection

### Materialized Views
- **Purpose**: Optimized dashboard query performance
- **Refresh**: Triggered after data changes
- **Benefits**: Sub-50ms dashboard API responses

## API Endpoints

### Dashboard Health
- **GET** `/dashboard/api/health`
- **Response**: System service status
- **Includes**: Database, Redis, ServiceNow, Slack connectivity

### Metrics API
- **GET** `/dashboard/api/metrics`
- **Parameters**: `period` (today, week, month)
- **Response**: Complete dashboard dataset
- **Performance**: <100ms average response time

### Analytics API
- **GET** `/dashboard/api/analytics`
- **Purpose**: Advanced analytics and trends
- **Includes**: Daily trends, channel efficiency, command performance

## Performance Metrics

### Current Benchmarks
- **Dashboard Load**: <2 seconds initial load
- **API Response**: <100ms average
- **WebSocket Latency**: <50ms update delivery
- **Database Queries**: <50ms with materialized views

### Optimization Features
- Connection pooling (20 max connections)
- Query result caching
- Materialized view auto-refresh
- Efficient WebSocket broadcasting

## Configuration

### Environment Variables
```env
# Dashboard-specific settings
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### WebSocket CORS
```typescript
cors: {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "POST"],
  credentials: true
}
```

## Troubleshooting

### Common Issues

#### No Live Updates
- Check WebSocket connection in browser DevTools
- Verify CORS configuration for frontend URL
- Confirm materialized views are refreshing

#### Slow Dashboard Loading
- Check database connection pool status
- Monitor materialized view refresh times
- Verify API endpoint response times

#### Missing Incident Data
- Check webhook validation logs
- Verify ServiceNow webhook configuration
- Confirm database connectivity

### Debug Commands
```bash
# Check WebSocket connections
curl -s http://localhost:3001/dashboard/api/health | jq '.data.services'

# Monitor API performance
curl -w "@curl-format.txt" -s http://localhost:3001/dashboard/api/metrics

# Check database health
curl -s http://localhost:3001/health/detailed
```

## Future Enhancements

### Planned Features
- Historical data export
- Custom alert thresholds
- Multi-tenant workspace support
- Advanced reporting dashboard
- Mobile-responsive design improvements

### Performance Optimizations
- Redis caching layer
- Database query optimization
- WebSocket connection scaling
- CDN integration for static assets