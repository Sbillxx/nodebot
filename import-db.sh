#!/bin/bash

# Script Import Database NodeBot
echo "=== Import Database NodeBot ==="

# Set variabel
DB_NAME="nodebot"
DB_USER="nodebot_user"
DB_PASSWORD="your_password"
SQL_FILE="database_dump.sql"

# Cek apakah file SQL ada
if [ ! -f "$SQL_FILE" ]; then
    echo "Error: File $SQL_FILE tidak ditemukan!"
    echo "Pastikan file SQL sudah diupload ke direktori ini."
    exit 1
fi

# Buat database jika belum ada
echo "Membuat database $DB_NAME..."
sudo mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"

# Import database
echo "Importing database dari $SQL_FILE..."
sudo mysql -u root -p $DB_NAME < $SQL_FILE

# Buat user jika belum ada
echo "Membuat user database..."
sudo mysql -u root -p -e "
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
"

echo "=== Import Database Selesai ==="
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASSWORD"

# Test koneksi
echo "Testing koneksi database..."
mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW TABLES;"

echo "=== Database siap digunakan ===" 