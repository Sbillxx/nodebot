#!/bin/bash

echo "🚀 Setting up Telegram Bot on Rocky Linux..."

# Update system
echo "📦 Updating system packages..."
sudo dnf update -y

# Install Node.js and npm
echo "📦 Installing Node.js and npm..."
sudo dnf install -y nodejs npm

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Make restart script executable
echo "🔧 Making scripts executable..."
chmod +x restart-bot.sh

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Install dependencies
echo "📦 Installing project dependencies..."
npm install

# Start bot with PM2
echo "🚀 Starting bot with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup (auto-start on server reboot)
echo "🚀 Setting up PM2 startup..."
pm2 startup
pm2 save

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the PM2 startup command from above output"
echo "2. Run it as root/sudo"
echo "3. Bot will auto-start on server reboot"
echo ""
echo "🔍 Check status: pm2 status"
echo "📝 View logs: pm2 logs telegram-bot"
echo "🔄 Restart bot: ./restart-bot.sh"
