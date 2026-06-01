module.exports = {
  apps: [
    {
      name: 'bravo-backend',
      script: '../backend/server.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '../../logs/backend-error.log',
      out_file: '../../logs/backend-out.log',
      log_file: '../../logs/backend-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000
    },
    {
      name: 'bravo-worker',
      script: '../backend/worker.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '../../logs/worker-error.log',
      out_file: '../../logs/worker-out.log',
      time: true,
      autorestart: true
    }
  ]
};