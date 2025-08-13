module.exports = {
  apps: [
    {
      name: "telegram-bot",
      script: "bot.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      // Restart otomatis ketika ada error
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",

      // Logging
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Error handling
      kill_timeout: 5000,
      listen_timeout: 8000,

      // Monitoring
      pmx: true,

      // Restart conditions
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",

      // Environment variables
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
