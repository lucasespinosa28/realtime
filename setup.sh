#!/bin/bash

# Simple deployment script for VPS
# Run this on your VPS after cloning the repository

echo "Setting up Polymarket Realtime App..."

# Install Bun if not already installed
if ! command -v bun &> /dev/null; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc
    echo "Bun installed successfully"
fi

# Install dependencies
echo "Installing dependencies..."
bun install --frozen-lockfile

# Setup environment file
if [[ ! -f ".env" ]]; then
    echo "Setting up environment file..."
    cp .env.example .env
    echo "✓ Environment file created (.env)"
    echo ""
    echo "IMPORTANT: Please edit .env and add your Airtable credentials:"
    echo "  API_KEY=your_airtable_api_key"
    echo "  BASE_ID=your_airtable_base_id"
    echo ""
    echo "After configuring .env, run: ./start.sh"
else
    echo "✓ Environment file already exists"
fi

# Make start script executable
chmod +x start.sh

echo ""
echo "Setup completed! 🚀"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Airtable API keys"
echo "2. Run: ./start.sh"
echo ""
echo "To run in background: nohup ./start.sh > app.log 2>&1 &"
