module.exports = {
  apps: [{
    name: 'kingdoms-harvest',
    cwd: '/home/kingdoms/app/server',
    script: 'src/index.js',
    env: { NODE_ENV: 'production' },
    instances: 1,
    exec_mode: 'fork',
    kill_timeout: 20000,   // allow sql.js to flush DB to disk on shutdown
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    error_file: '/home/kingdoms/app/logs/err.log',
    out_file: '/home/kingdoms/app/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
