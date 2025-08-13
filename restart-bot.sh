#!/bin/bash

echo "🔄 Restarting Telegram Bot..."

# Stop the current bot process
echo "⏹️  Stopping current bot..."
pm2 stop telegram-bot

# Wait a moment
sleep 2

# Delete the old process
echo "🗑️  Removing old process..."
pm2 delete telegram-bot

# Wait a moment
sleep 2

# Start with new ecosystem config
echo "🚀 Starting bot with new ecosystem config..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup (optional - uncomment if needed)
# echo "🚀 Setting up PM2 startup..."
# pm2 startup
# pm2 save

# Show status
echo "📊 Bot status:"
pm2 status

echo "✅ Bot restarted successfully!"
echo "📝 Use 'pm2 logs telegram-bot' to view logs"
echo "📝 Use 'pm2 monit' to monitor the bot"
