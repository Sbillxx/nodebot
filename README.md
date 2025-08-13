# 🤖 Telegram Bot QnA dengan PM2 Auto-Restart

Bot Telegram untuk sistem QnA dengan fitur admin panel dan auto-restart menggunakan PM2.

## 🚀 **Deployment di Rocky Linux Server**

### **Quick Setup:**

```bash
# Clone repository
git clone <your-repo>
cd nodebot

# Setup otomatis
chmod +x setup-rocky-linux.sh
./setup-rocky-linux.sh
```

### **Manual Setup:**

```bash
# 1. Install dependencies
sudo dnf install -y nodejs npm
sudo npm install -g pm2

# 2. Install project dependencies
npm install

# 3. Setup environment variables
cp env.example .env
# Edit .env dengan credentials yang benar

# 4. Start bot
pm2 start ecosystem.config.js
pm2 save

# 5. Setup auto-start
pm2 startup
pm2 save
```

## 📁 **File Penting:**

- `bot.js` - Bot Telegram utama
- `ecosystem.config.js` - Konfigurasi PM2
- `restart-bot.sh` - Script restart untuk Linux
- `setup-rocky-linux.sh` - Setup otomatis untuk Rocky Linux

## 🔧 **PM2 Commands:**

```bash
# Start bot
pm2 start ecosystem.config.js

# Stop bot
pm2 stop telegram-bot

# Restart bot
pm2 restart telegram-bot

# View logs
pm2 logs telegram-bot

# Monitor real-time
pm2 monit

# View status
pm2 status

# Restart dengan script
./restart-bot.sh
```

## 🚨 **Auto-Restart Features:**

Bot akan **otomatis restart** ketika:

- ❌ Uncaught exception
- ❌ Unhandled promise rejection
- ❌ Bot error
- ❌ Memory > 1GB
- ❌ Process crash

## 📊 **Monitoring:**

```bash
# View logs
pm2 logs telegram-bot --lines 100

# Monitor resources
pm2 monit

# View process info
pm2 show telegram-bot
```

## 🔄 **Restart Bot:**

```bash
# Restart dengan script
./restart-bot.sh

# Atau manual
pm2 restart telegram-bot
```

## 💡 **Tips:**

1. **Selalu gunakan `ecosystem.config.js`** untuk start bot
2. **Jangan lupa `pm2 save`** setelah konfigurasi
3. **Monitor logs** secara berkala
4. **Gunakan `pm2 monit`** untuk monitoring real-time

## 🎯 **Hasil:**

- ✅ **Bot selalu online** - Auto-restart ketika crash
- ✅ **Error terdeteksi** - PM2 tau kalau ada masalah
- ✅ **Monitoring real-time** - Bisa lihat status bot
- ✅ **Logs lengkap** - Semua error tercatat
- ✅ **Startup otomatis** - Bot jalan sendiri setelah reboot server

**Tidak ada lagi bot yang stuck karena error!** 🚀
