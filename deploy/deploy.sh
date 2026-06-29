#!/usr/bin/env bash
# Deployment-Script — auf dem Server in /var/www/mermaids ausführen.
# Zieht neuesten Stand, baut Frontend + Backend, startet PM2 neu.
set -euo pipefail

APP_DIR=/var/www/mermaids

cd "$APP_DIR"

echo "=== Git pull ==="
git pull

echo "=== Frontend: npm install + build ==="
npm ci
VITE_API_URL=http://178.105.92.40 npm run build

echo "=== Backend: npm install + tsc ==="
cd server
npm ci
npm run build
cd ..

echo "=== PM2 (re)starten ==="
if pm2 describe mermaids-api > /dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
    pm2 save
fi

echo "=== Fertig ==="
pm2 status
