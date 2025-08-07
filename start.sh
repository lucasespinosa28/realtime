#!/bin/bash

# Production startup script for Polymarket Realtime App
# For VPS deployment with 512MB RAM

echo "Starting Polymarket Realtime App in production mode..."

# Check if .env file exists
if [[ ! -f ".env" ]]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure your API keys:"
    echo "cp .env.example .env"
    echo "Then edit .env with your Airtable API_KEY and BASE_ID"
    exit 1
fi

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    echo "Installing dependencies..."
    bun install --frozen-lockfile
fi

# Set memory limits for VPS with 512MB RAM
export NODE_OPTIONS="--max-old-space-size=256 --max-semi-space-size=32"

# Enable garbage collection exposure for manual triggering
export BUN_FLAGS="--expose-gc"

echo "Memory optimizations enabled for production"
echo "Starting application..."

# Start the application with Bun and memory monitoring
exec bun --expose-gc run app.ts
