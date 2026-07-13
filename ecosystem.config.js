module.exports = {
  apps: [{
    name: 'kingdoms-harvest',
    cwd: '/home/kingdoms/app/server',
    script: 'src/index.js',
    env: { NODE_ENV: 'production' },
    // ⚠️ NO CAMBIAR A CLUSTER. La DB es sql.js: SQLite in-memory POR PROCESO,
    // persistida exportando la imagen COMPLETA y sobrescribiendo el archivo
    // entero. En cluster, N workers tendrían N bases divergentes y el flush de
    // uno pisa los writes de otro → créditos de gemas y ledger de retiros TON
    // se BORRAN. Además cada worker pollearía el mismo bot (409 + updates de
    // pago partidos). Un solo proceso hasta migrar a better-sqlite3/Postgres.
    instances: 1,
    exec_mode: 'fork',
    kill_timeout: 20000,   // give workers time to drain in-flight requests on shutdown
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    error_file: '/home/kingdoms/app/logs/err.log',
    out_file: '/home/kingdoms/app/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
