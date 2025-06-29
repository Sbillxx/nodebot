#!/bin/bash

# Script Setup VPS untuk NodeBot
echo "=== Setup VPS untuk NodeBot ==="

# Update sistem
echo "Updating sistem..."
sudo apt update && sudo apt upgrade -y

# Install Node.js dan npm
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
echo "Installing MySQL..."
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo systemctl enable mysql

# Install PM2 untuk process management
echo "Installing PM2..."
sudo npm install -g pm2

# Buat direktori untuk aplikasi
echo "Membuat direktori aplikasi..."
mkdir -p ~/nodebot
cd ~/nodebot

echo "=== Setup VPS selesai ==="
echo "Langkah selanjutnya:"
echo "1. Upload file bot.js, package.json, dan .env ke ~/nodebot/"
echo "2. Jalankan: npm install"
echo "3. Jalankan: pm2 start bot.js"
echo "4. Setup MySQL database" 