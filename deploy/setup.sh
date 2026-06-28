#!/usr/bin/env bash
# Einmalige Server-Einrichtung auf einem frischen Hetzner-Ubuntu-Server.
# Als root oder mit sudo ausführen.
set -euo pipefail

APP_DIR=/var/www/mermaids
DB_NAME=mermaids
DB_USER=mermaids

echo "=== 1. System aktualisieren ==="
apt-get update && apt-get upgrade -y

echo "=== 2. Node.js 22 (LTS) installieren ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "=== 3. PM2 global installieren ==="
npm install -g pm2

echo "=== 4. PostgreSQL installieren ==="
apt-get install -y postgresql postgresql-contrib

echo "=== 5. Nginx installieren ==="
apt-get install -y nginx

echo "=== 6. PostgreSQL-Datenbank anlegen ==="
echo "Bitte ein sicheres Passwort für den DB-User '$DB_USER' eingeben:"
read -r -s DB_PASS
sudo -u postgres psql <<SQL
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
SQL
echo "Datenbank '$DB_NAME' und User '$DB_USER' angelegt."

echo "=== 7. App-Verzeichnis anlegen ==="
mkdir -p "$APP_DIR"
# Repo klonen (URL anpassen falls nötig)
# git clone https://github.com/Hermander741/swimtrack-web.git "$APP_DIR"
echo "Klone das Repo manuell: git clone <repo-url> $APP_DIR"

echo "=== 8. Nginx-Config einrichten ==="
cp "$(dirname "$0")/nginx.conf" /etc/nginx/sites-available/mermaids
ln -sf /etc/nginx/sites-available/mermaids /etc/nginx/sites-enabled/mermaids
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== 9. PM2 beim Systemstart aktivieren ==="
pm2 startup systemd -u root --hp /root
echo ""
echo "=== Setup abgeschlossen ==="
echo "Nächste Schritte:"
echo "  1. Repo nach $APP_DIR klonen"
echo "  2. $APP_DIR/server/.env anlegen (siehe .env.example)"
echo "  3. deploy/deploy.sh ausführen"
