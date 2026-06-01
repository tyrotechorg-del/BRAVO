module.exports = {
  apps: [{
    name: 'bravo-music-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 5001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    listen_timeout: 5000,
    shutdown_with_message: true,
    node_args: '--max-old-space-size=512'
  }],
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/bravo-music-platform.git',
      path: '/var/www/bravo-music-platform',
      'post-deploy': 'cd backend && npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};