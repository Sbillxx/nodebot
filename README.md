# NodeBot - Telegram Bot

Bot Telegram dengan database MySQL untuk deployment di VPS.

## 📋 Tutorial Deployment Lengkap

### **STEP 1: Persiapan di Komputer Lokal**

1. **Upload ke GitHub:**

```bash
git init
git add .
git commit -m "Initial commit: NodeBot"
git remote add origin https://github.com/username/nodebot.git
git push -u origin main
```

2. **Siapkan file .env:**

```bash
# Copy file .env.example jika ada, atau buat manual
cp .env.example .env
# Edit file .env dengan konfigurasi yang benar
```

### **STEP 2: Setup VPS**

1. **Connect ke VPS via PuTTY:**

```bash
ssh username@your-vps-ip
```

2. **Jalankan script setup VPS:**

```bash
# Download script setup
wget https://raw.githubusercontent.com/username/nodebot/main/vps-setup.sh
chmod +x vps-setup.sh
./vps-setup.sh
```

### **STEP 3: Clone Repository**

```bash
# Clone repository
git clone https://github.com/username/nodebot.git
cd nodebot
```

### **STEP 4: Import Database**

1. **Upload file SQL ke VPS:**

   - Via WinSCP: Drag & drop file `.sql` ke `/home/username/`
   - Via SCP: `pscp database.sql username@vps-ip:/home/username/`

2. **Jalankan script import:**

```bash
# Edit password di script dulu
nano import-db.sh
# Jalankan script
chmod +x import-db.sh
./import-db.sh
```

### **STEP 5: Setup Environment**

```bash
# Copy file .env
cp .env.example .env
# Edit konfigurasi
nano .env
```

Isi file `.env`:

```env
BOT_TOKEN=your_bot_token_here
DB_HOST=localhost
DB_USER=nodebot_user
DB_PASSWORD=your_password
DB_NAME=nodebot
DB_PORT=3306
```

### **STEP 6: Install Dependencies & Jalankan**

```bash
# Install dependencies
npm install

# Jalankan dengan PM2
pm2 start bot.js --name "nodebot"

# Auto restart saat reboot
pm2 startup
pm2 save

# Cek status
pm2 status
pm2 logs nodebot
```

## 🔧 Perintah Berguna

### **Update Bot:**

```bash
git pull origin main
npm install
pm2 restart nodebot
```

### **Cek Log:**

```bash
pm2 logs nodebot
pm2 logs nodebot --lines 100
```

### **Restart Bot:**

```bash
pm2 restart nodebot
```

### **Stop Bot:**

```bash
pm2 stop nodebot
```

## 📁 Struktur File

```
nodebot/
├── bot.js              # File utama bot
├── package.json        # Dependencies
├── .env               # Konfigurasi (buat manual)
├── .gitignore         # File yang diignore git
├── deploy.sh          # Script deployment
├── vps-setup.sh       # Script setup VPS
├── import-db.sh       # Script import database
└── README.md          # Dokumentasi ini
```

## 🚨 Troubleshooting

### **Bot tidak jalan:**

```bash
pm2 logs nodebot
# Cek error di log
```

### **Database error:**

```bash
mysql -u nodebot_user -p nodebot
# Test koneksi database
```

### **Port error:**

```bash
sudo netstat -tlnp | grep :3000
# Cek port yang digunakan
```

## 📞 Support

Jika ada masalah, cek:

1. Log PM2: `pm2 logs nodebot`
2. Log MySQL: `sudo tail -f /var/log/mysql/error.log`
3. Status service: `sudo systemctl status mysql`
