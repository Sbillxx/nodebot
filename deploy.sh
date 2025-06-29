#!/bin/bash

# Script Deployment untuk VPS
echo "=== Script Deployment NodeBot ==="

# Buat direktori backup
echo "Membuat backup..."
if [ -d "backup" ]; then
    rm -rf backup
fi
mkdir backup

# Copy file penting ke backup
cp bot.js backup/
cp package.json backup/
cp package-lock.json backup/

# Buat file .env template jika belum ada
if [ ! -f ".env" ]; then
    echo "Membuat file .env template..."
    cat > .env << EOF
# Konfigurasi Bot Telegram
BOT_TOKEN=your_bot_token_here

# Konfigurasi Database MySQL
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_PORT=3306
EOF
    echo "File .env template telah dibuat. Silakan edit dengan konfigurasi yang benar."
fi

echo "=== Siap untuk upload ke VPS ==="
echo "Langkah selanjutnya:"
echo "1. Upload folder backup/ ke VPS"
echo "2. Setup environment di VPS"
echo "3. Install dependencies"
echo "4. Jalankan bot" 