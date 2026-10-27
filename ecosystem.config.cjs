const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'ecosistema-educativo',
      cwd: __dirname,
      script: 'servidor/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      max_memory_restart: '512M',
      time: true,
      merge_logs: true,
      out_file: path.join(__dirname, 'logs', 'pm2-salida.log'),
      error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
      env: {
        NODE_ENV: 'production',
        PUERTO: 3000
      }
    }
  ]
};
