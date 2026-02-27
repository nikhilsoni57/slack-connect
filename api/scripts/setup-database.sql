-- Database setup script for Nexecute Connect
-- Run this script to create the database and initial setup

-- Create database (run as postgres user)
-- createdb nexecute_connect

-- Connect to the database
\c nexecute_connect;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create a function to generate random UUIDs (if not available)
CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS $$
BEGIN
    RETURN uuid_generate_v4();
END;
$$ LANGUAGE plpgsql;