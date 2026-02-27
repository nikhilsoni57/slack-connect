# ServiceNow & Slack Integration

## Project Overview

Integration platform that bridges ServiceNow incident management with Slack notifications. This project showcases advanced ServiceNow API integration, OAuth 2.0 authentication flows, and real-time monitoring capabilities.

## Key Features

### Enterprise Authentication & Security
- OAuth 2.0 Implementation: Complete ServiceNow OAuth flow with refresh token handling
- JWT Session Management: Secure authentication with configurable session policies
- AES-256-GCM Encryption: Enterprise grade encryption for sensitive data storage
- Multi-tier Security: Rate limiting, input validation, CORS, and security headers

### Real-time Monitoring Dashboard
- Live Metrics: Real time incident tracking with WebSocket-powered updates
- Advanced Analytics: Chart.js visualizations for incident response time trends
- System Health Monitoring: Multi service connectivity and performance tracking
- SLA Compliance: Automated monitoring with configurable thresholds

### ServiceNow Integration
- Complete API Integration: Full incident lifecycle management (CRUD operations)
- Advanced Query Building: Dynamic GlideRecord-style filtering and search
- Webhook Processing: Real time incident event handling with comprehensive validation
- Error Handling: Robust retry logic and comprehensive error management

### Slack Integration
- Rich Bot Implementation: Interactive notifications with buttons and slash commands
- Signature Verification: HMAC-SHA256 webhook security validation
- Event Subscriptions: Real time Slack event processing and responses
- Enhanced Scopes: Complete Slack bot token scope implementation

## Technical Architecture

### Core Technology Stack
```
Frontend:  React
Backend:   Node.js
Database:  PostgreSQL
Security:  OAuth 2.0 • JWT
DevOps:    Docker
```

### System Architecture
```
┌─────────────────┐    ┌─────────────────────────┐    ┌─────────────────┐
│   React UI      │◄──►│  Node.js/Express API    │◄──►│   PostgreSQL    │
│  • Dashboard    │    │  • REST Endpoints       │    │  • Incidents    │
│  • Real-time    │    │  • WebSocket Server     │    │  • Analytics    │
│  • Analytics    │    │  • OAuth 2.0 Flow       │    │  • Materialized │
└─────────────────┘    │  • Webhook Processors   │    │    Views        │
                       └─────────────────────────┘    └─────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       │                         │
              ┌─────────────────┐    ┌─────────────────┐
              │   ServiceNow    │    │      Slack      │
              │  • REST API     │    │  • Web API      │
              │  • OAuth 2.0    │    │  • Events API   │
              │  • Webhooks     │    │  • Bot Token    │
              └─────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- ServiceNow Developer Instance
- Slack App with Bot Token

### Installation & Setup

1. Clone and Install
   ```bash
   git clone https://github.com/your-username/slack-connect.git
   cd slack-connect/Slack-backend
   npm install
   ```

2. Environment Configuration
   ```bash
   cp .env.example .env
   # Configure your ServiceNow, Slack, and database credentials
   ```

3. Database Setup
   ```bash
   # Create PostgreSQL database
   createdb slack_connect
   
   # Run migrations (if available)
   npm run migrate
   ```

4. Start Development Server
   ```bash
   npm run dev
   ```

5. Access Application
   - API Server: http://localhost:3001
   - Dashboard: http://localhost:3001/dashboard
   - API Health: http://localhost:3001/health

## API Documentation

### Core Endpoints
- `POST /auth/servicenow` - Initialize OAuth 2.0 flow
- `GET /auth/servicenow/callback` - Handle OAuth callback
- `GET /api/v1/incidents` - List incidents with filtering
- `POST /webhooks/servicenow` - ServiceNow webhook processor
- `POST /webhooks/slack` - Slack event handler

### Dashboard & Analytics
- `GET /dashboard` - Real-time monitoring interface
- `GET /dashboard/api/health` - System health status
- `GET /dashboard/api/metrics` - Live metrics and analytics
- `GET /dashboard/api/analytics` - Advanced incident analytics

## Project Structure

```
slack-connect/
├── README.md                           # This file (project overview)
├── backend/                            # Main application
│   ├── src/
│   │   ├── routes/                     # API endpoints & dashboard
│   │   ├── services/                   # Business logic & integrations
│   │   ├── middleware/                 # Express middleware
│   │   ├── config/                     # Configuration management
│   │   └── utils/                      # Utility functions
│   ├── docs/
│   │   ├── ARCHITECTURE.md             # System architecture
│   │   ├── API.md                      # API documentation
│   │   └── internal/                   # Internal technical docs
│   │       ├── DASHBOARD.md            # Dashboard implementation
│   │       ├── WEBHOOKS.md             # Webhook processing
│   │       ├── DEPLOYMENT.md           # Production deployment
│   │
│   └── package.json
└── vercel.json                         # Deployment configuration
```

## Production Deployment

### Docker Deployment
```bash
cd backend
docker-compose up -d
```

