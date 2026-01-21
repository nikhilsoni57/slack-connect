# ServiceNow & Slack Integration

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## Project Overview

Integration platform that bridges ServiceNow incident management with Slack notifications. This project showcases advanced ServiceNow API integration, OAuth 2.0 authentication flows, and real-time monitoring capabilities.

## Key Features

### Enterprise Authentication & Security
- **OAuth 2.0 Implementation**: Complete ServiceNow OAuth flow with refresh token handling
- **JWT Session Management**: Secure authentication with configurable session policies
- **AES-256-GCM Encryption**: Enterprise-grade encryption for sensitive data storage
- **Multi-tier Security**: Rate limiting, input validation, CORS, and security headers

### Real-time Monitoring Dashboard
- **Live Metrics**: Real-time incident tracking with WebSocket-powered updates
- **Advanced Analytics**: Chart.js visualizations for incident response time trends
- **System Health Monitoring**: Multi-service connectivity and performance tracking
- **SLA Compliance**: Automated monitoring with configurable thresholds

### ServiceNow Integration
- **Complete API Integration**: Full incident lifecycle management (CRUD operations)
- **Advanced Query Building**: Dynamic GlideRecord-style filtering and search
- **Webhook Processing**: Real-time incident event handling with comprehensive validation
- **Error Handling**: Robust retry logic and comprehensive error management

### Slack Integration
- **Rich Bot Implementation**: Interactive notifications with buttons and slash commands
- **Signature Verification**: HMAC-SHA256 webhook security validation
- **Event Subscriptions**: Real-time Slack event processing and responses
- **Enhanced Scopes**: Complete Slack bot token scope implementation

<img width="1507" height="309" alt="nexecute-servicenow-p1" src="https://github.com/user-attachments/assets/d55d9f19-d144-42f5-85e5-cc6e36ff9bfd" />

<img width="750" height="859" alt="nexecute-slackbot" src="https://github.com/user-attachments/assets/e2e41209-54db-4d8f-806b-63bc21d7d1dc" />


## Technical Architecture

### Core Technology Stack
```
Frontend:  React • TypeScript • Chart.js • WebSocket Client
Backend:   Node.js • Express.js • TypeScript • Socket.IO
Database:  PostgreSQL • Materialized Views • Connection Pooling
Security:  OAuth 2.0 • JWT • bcryptjs • Helmet.js
DevOps:    Docker • PM2 • Nginx • Health Monitoring
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

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-username/slack-connect.git
   cd slack-connect/nexecute-backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Configure your ServiceNow, Slack, and database credentials
   ```

3. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb slack_connect
   
   # Run migrations (if available)
   npm run migrate
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Access Application**
   - **API Server**: http://localhost:3001
   - **Dashboard**: http://localhost:3001/dashboard
   - **API Health**: http://localhost:3001/health

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

*For complete API documentation, see [nexecute-backend/docs/API.md](nexecute-backend/docs/API.md)*

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

### PM2 Process Manager
```bash
npm run build
pm2 start ecosystem.config.js --env production
```

*For detailed deployment instructions, see [nexecute-backend/docs/internal/DEPLOYMENT.md](nexecute-backend/docs/internal/DEPLOYMENT.md)*

## Technical Highlights

### Enterprise Integration Patterns

- **Complete OAuth 2.0 Flow**: ServiceNow authentication with token refresh
- **Webhook Security**: HMAC-SHA256 signature validation and comprehensive input validation
- **Real-time Architecture**: WebSocket-based dashboard with sub-second updates
- **RESTful API Design**: Consistent endpoints with comprehensive error handling

### Performance & Scalability

- **Database Optimization**: PostgreSQL with materialized views for analytics
- **Connection Pooling**: Efficient database resource management
- **Caching Strategies**: Multi-layer caching for optimal performance
- **Horizontal Scaling**: Containerized architecture supporting load balancing

### Security Implementation

- **Multi-tier Authentication**: OAuth 2.0, JWT sessions, and API key validation
- **Data Encryption**: AES-256-GCM for sensitive credential storage
- **Rate Limiting**: Tiered protection against abuse and DoS attacks
- **Comprehensive Validation**: Input sanitization and payload validation

### Modern Development Practices

- **TypeScript**: Fully typed codebase with strict compilation
- **Modular Architecture**: Clean separation of concerns and reusable components
- **Comprehensive Testing**: Health checks and integration testing framework
- **Professional Documentation**: Complete API docs and deployment guides

## Documentation

- **[Architecture Guide](nexecute-backend/docs/ARCHITECTURE.md)** - System design and technical architecture
- **[API Reference](nexecute-backend/docs/API.md)** - Complete endpoint documentation
- **[Internal Documentation](nexecute-backend/docs/internal/)** - Detailed implementation guides

## Contact

**Nikhil Soni**  
🔗 [LinkedIn](https://www.linkedin.com/in/nikhilsoni57/)  

