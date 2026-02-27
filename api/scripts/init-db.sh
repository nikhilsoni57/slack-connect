#!/bin/bash

# Database initialization script for Nexecute Connect
# This script sets up PostgreSQL database for development

echo "🗄️ Initializing Nexecute Connect Database..."

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on localhost:5432"
    echo "Please start PostgreSQL first:"
    echo "  - macOS with Homebrew: brew services start postgresql"
    echo "  - Ubuntu/Debian: sudo systemctl start postgresql"
    echo "  - Docker: docker run --name postgres -e POSTGRES_PASSWORD= -p 5432:5432 -d postgres"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Create database if it doesn't exist
echo "📊 Creating nexecute_connect database..."
createdb nexecute_connect 2>/dev/null || echo "Database already exists or could not be created"

# Run setup script
echo "🔧 Running database setup..."
psql -d nexecute_connect -f scripts/setup-database.sql

# Run schema creation
echo "📋 Creating database schema..."
psql -d nexecute_connect -f database/schema.sql

echo "✅ Database initialization complete!"
echo ""
echo "Database connection details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: nexecute_connect"
echo "  User: postgres (or your default PostgreSQL user)"
echo ""
echo "You can now start the server with: npm run dev"