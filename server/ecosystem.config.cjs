const path = require('path')

module.exports = {
  apps: [{
    name: 'swimtrack-api',
    script: 'src/index.ts',
    interpreter: 'ts-node',
    interpreter_args: '--project tsconfig.json',
    cwd: path.join(__dirname),
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: '3001',
      ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:4173',
    },
  }],
}
