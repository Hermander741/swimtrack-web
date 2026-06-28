module.exports = {
  apps: [
    {
      name: 'mermaids-api',
      script: './dist/index.js',
      cwd: '/var/www/mermaids/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
