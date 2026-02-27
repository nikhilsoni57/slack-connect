# Deployment Guide

## Overview

This guide covers deploying Nexecute Connect to production environments with comprehensive setup instructions, security configurations, and monitoring guidelines.

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **PostgreSQL**: 13.x or higher
- **Redis**: 6.x or higher (optional, for session management)
- **Memory**: Minimum 2GB RAM
- **Storage**: Minimum 20GB disk space

### External Services
- **ServiceNow Instance**: Developer or enterprise instance with OAuth app configured
- **Slack App**: Created in Slack App Management console
- **Domain/SSL**: Valid SSL certificate for webhook endpoints

## Environment Setup

### Production Environment Variables

Create a `.env.production` file:

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Database Configuration
DATABASE_URL=postgresql://username:password@host:5432/nexecute_connect
REDIS_URL=redis://host:6379

# ServiceNow Configuration
SERVICENOW_INSTANCE_URL=https://your-instance.service-now.com
SERVICENOW_CLIENT_ID=your_oauth_client_id
SERVICENOW_CLIENT_SECRET=your_oauth_client_secret

# Slack Configuration
SLACK_APP_ID=A1234567890
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_VERIFICATION_TOKEN=your_verification_token

# Security Configuration
ENCRYPTION_KEY=your_64_character_hex_encryption_key
JWT_SECRET=your_jwt_secret_minimum_32_characters
SESSION_SECRET=your_session_secret

# External URLs
FRONTEND_URL=https://your-domain.com
```

### Security Key Generation

```bash
# Generate encryption key (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate session secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## Database Setup

### PostgreSQL Installation

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### CentOS/RHEL
```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Database Configuration

```bash
# Connect as postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE nexecute_connect;
CREATE USER nexecute_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE nexecute_connect TO nexecute_user;
GRANT USAGE ON SCHEMA public TO nexecute_user;
GRANT CREATE ON SCHEMA public TO nexecute_user;
\q
```

### Database Schema Migration

```bash
# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

## Application Deployment

### Method 1: PM2 (Recommended)

#### Install PM2
```bash
npm install -g pm2
```

#### Create PM2 Configuration
Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'nexecute-connect',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
```

#### Deploy with PM2
```bash
# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 auto-startup
pm2 startup
```

### Method 2: Docker

#### Create Dockerfile
```dockerfile
FROM node:18-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nexecute -u 1001
USER nexecute

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "dist/server.js"]
```

#### Create docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/usr/src/app/logs

  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=nexecute_connect
      - POSTGRES_USER=nexecute_user
      - POSTGRES_PASSWORD=your_secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### Deploy with Docker
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Update deployment
docker-compose pull
docker-compose up -d --no-deps app
```

## Reverse Proxy Setup

### Nginx Configuration

Create `/etc/nginx/sites-available/nexecute-connect`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=webhook:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    # Webhook endpoints
    location /webhooks/ {
        limit_req zone=webhook burst=20 nodelay;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dashboard and static files
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/nexecute-connect /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate Setup

### Using Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## ServiceNow Configuration

### OAuth Application Setup

1. Navigate to **System OAuth → Application Registry**
2. Click **New → Create an OAuth API endpoint for external clients**
3. Configure:
   - **Name**: Nexecute Connect
   - **Client ID**: (auto-generated, copy to env file)
   - **Client Secret**: (copy to env file)
   - **Redirect URL**: `https://your-domain.com/auth/servicenow/callback`
   - **Refresh Token Lifespan**: 7776000 (90 days)

### Business Rule Configuration

Create a new Business Rule for the Incident table:

```javascript
// Name: Nexecute Webhook Notification
// Table: Incident [incident]
// Active: true
// Advanced: true
// When: after
// Insert: true
// Update: true
// Delete: true
// Order: 1000
// Condition: priority == 1 || priority == 2

(function executeRule(current, previous) {
    
    // Determine event type
    var eventType = 'updated';
    if (current.operation() == 'insert') {
        eventType = 'created';
    } else if (current.operation() == 'delete') {
        eventType = 'deleted';
    } else if (current.state == 6 || current.state == 7) {
        eventType = 'resolved';
    }
    
    // Build webhook payload
    var payload = {
        incident: {
            sys_id: current.sys_id.toString(),
            number: current.number.toString(),
            short_description: current.short_description.toString(),
            description: current.description.toString(),
            priority: current.priority.toString(),
            state: current.state.toString(),
            category: current.category.toString(),
            urgency: current.urgency.toString(),
            impact: current.impact.toString(),
            assigned_to: current.assigned_to.toString(),
            caller_id: current.caller_id.toString(),
            sys_created_on: current.sys_created_on.getDisplayValue(),
            sys_updated_on: current.sys_updated_on.getDisplayValue(),
            resolved_at: current.resolved_at ? current.resolved_at.getDisplayValue() : null
        },
        event_type: eventType,
        activities: current.activity_due.changes() ? 1 : 0
    };
    
    // Send webhook
    try {
        var request = new sn_ws.RESTMessageV2();
        request.setEndpoint('https://your-domain.com/webhooks/servicenow');
        request.setHttpMethod('POST');
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('User-Agent', 'ServiceNow-Webhook/1.0');
        request.setRequestBody(JSON.stringify(payload));
        
        var response = request.executeAsync();
        gs.info('Nexecute webhook sent for incident ' + current.number + 
                ' (event: ' + eventType + ')');
                
    } catch (ex) {
        gs.error('Failed to send Nexecute webhook for incident ' + current.number + 
                 ': ' + ex.getMessage());
    }
    
})(current, previous);
```

## Slack App Configuration

### App Manifest

Use this manifest when creating your Slack app:

```yaml
display_information:
  name: Nexecute Connect
  description: ServiceNow incident management integration
  background_color: "#7c3aed"
features:
  bot_user:
    display_name: Nexecute
    always_online: false
  slash_commands:
    - command: /incident
      url: https://your-domain.com/webhooks/slack/slash
      description: Create or manage ServiceNow incidents
      usage_hint: create [description]
    - command: /status
      url: https://your-domain.com/webhooks/slack/slash
      description: Check system status
oauth_config:
  redirect_urls:
    - https://your-domain.com/auth/slack/callback
  scopes:
    bot:
      - channels:manage
      - chat:write
      - chat:write.public
      - commands
      - groups:write
      - im:write
      - links:read
      - links:write
      - mpim:write
      - users:read
      - workflow.steps:execute
settings:
  event_subscriptions:
    request_url: https://your-domain.com/webhooks/slack
    bot_events:
      - app_mention
      - message.channels
  interactivity:
    is_enabled: true
    request_url: https://your-domain.com/webhooks/slack/interactive
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

## Monitoring and Logging

### Log Configuration

Create log rotation configuration `/etc/logrotate.d/nexecute-connect`:

```
/path/to/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 nexecute nexecute
    postrotate
        pm2 reload nexecute-connect
    endscript
}
```

### Health Check Script

Create `healthcheck.js`:

```javascript
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const request = http.request(options, (response) => {
  if (response.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('timeout', () => {
  request.destroy();
  process.exit(1);
});

request.on('error', () => {
  process.exit(1);
});

request.end();
```

### Monitoring Setup

```bash
# System monitoring
sudo apt install htop iotop nethogs

# Application monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup-db.sh

DB_NAME="nexecute_connect"
DB_USER="nexecute_user"
BACKUP_DIR="/var/backups/nexecute"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/nexecute_$DATE.sql.gz

# Remove old backups (keep 30 days)
find $BACKUP_DIR -name "nexecute_*.sql.gz" -mtime +30 -delete

echo "Backup completed: nexecute_$DATE.sql.gz"
```

### Application Backup

```bash
#!/bin/bash
# backup-app.sh

APP_DIR="/path/to/app"
BACKUP_DIR="/var/backups/nexecute"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup configuration and logs
tar -czf $BACKUP_DIR/app_config_$DATE.tar.gz \
  $APP_DIR/.env.production \
  $APP_DIR/ecosystem.config.js \
  $APP_DIR/logs/

echo "Application backup completed: app_config_$DATE.tar.gz"
```

### Automated Backup with Cron

```bash
# Add to crontab: crontab -e
0 2 * * * /path/to/backup-db.sh
0 3 * * * /path/to/backup-app.sh
```

## Security Hardening

### Firewall Configuration

```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### System Updates

```bash
# Automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### Fail2Ban Setup

```bash
# Install Fail2Ban
sudo apt install fail2ban

# Configure for Nginx
sudo cat > /etc/fail2ban/jail.local << EOF
[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true

[nginx-noproxy]
enabled = true
EOF

sudo systemctl restart fail2ban
```

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_incidents_priority_state ON incidents(priority, state) WHERE state IN ('1', '2', '3');
CREATE INDEX CONCURRENTLY idx_incidents_created_at ON incidents(created_at);
CREATE INDEX CONCURRENTLY idx_slack_notifications_incident_id ON slack_notifications(incident_id);
CREATE INDEX CONCURRENTLY idx_webhook_logs_created_at ON webhook_logs(created_at);

-- Analyze tables
ANALYZE incidents;
ANALYZE slack_notifications;
ANALYZE webhook_logs;
```

### Application Tuning

```javascript
// ecosystem.config.js optimizations
module.exports = {
  apps: [{
    name: 'nexecute-connect',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    node_args: '--max_old_space_size=2048',
    env: {
      NODE_ENV: 'production',
      UV_THREADPOOL_SIZE: 16
    }
  }]
};
```

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
pm2 logs nexecute-connect
# or
docker-compose logs app

# Check environment variables
pm2 env 0

# Verify database connection
psql -U nexecute_user -h localhost nexecute_connect -c "SELECT 1;"
```

#### High Memory Usage
```bash
# Monitor memory
pm2 monit

# Restart if needed
pm2 restart nexecute-connect
```

#### Webhook Failures
```bash
# Check webhook logs
tail -f logs/webhook.log

# Test webhook endpoint
curl -X POST https://your-domain.com/webhooks/servicenow \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

