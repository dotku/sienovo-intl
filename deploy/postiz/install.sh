#!/usr/bin/env bash
# Bootstrap Postiz on a fresh Ubuntu 22.04/24.04 EC2.
#
# What this does:
#   1. installs docker, docker-compose plugin, caddy
#   2. drops the Caddyfile into /etc/caddy and reloads (auto-issues LE cert)
#   3. writes a random JWT_SECRET + POSTGRES_PASSWORD into .env if missing
#   4. `docker compose up -d`
#
# Pre-reqs you handle outside this script:
#   - DNS A record for postiz.sienovo.cn → this server's public IP
#   - Security group / firewall: open ports 80 + 443 to 0.0.0.0/0
#   - Run as a sudoer user; this script uses `sudo` itself.
#
# Run from /Users/wlin/dev/sienovo/sienovo-intl/deploy/postiz on the server.

set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="postiz.sienovo.cn"

echo "==> 1/5  installing docker + caddy"
if ! command -v docker >/dev/null; then
	curl -fsSL https://get.docker.com | sudo sh
	sudo usermod -aG docker "$USER" || true
fi
if ! command -v caddy >/dev/null; then
	sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
	curl -fsSL "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" \
		| sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -fsSL "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" \
		| sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
	sudo apt-get update
	sudo apt-get install -y caddy
fi

echo "==> 2/5  configuring Caddy for ${DOMAIN}"
sudo install -m 0644 Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "==> 3/5  generating .env if missing"
if [ ! -f .env ]; then
	cp .env.example .env
	JWT=$(openssl rand -hex 48)
	PGPW=$(openssl rand -hex 24)
	sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
	sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PGPW}|" .env
	echo "    wrote .env with random JWT_SECRET + POSTGRES_PASSWORD"
else
	echo "    .env already exists, leaving it alone"
fi

echo "==> 4/5  pulling images + starting stack"
sudo docker compose pull
sudo docker compose up -d

echo "==> 5/5  waiting for Postiz to answer on 127.0.0.1:4007"
for i in $(seq 1 60); do
	if curl -fsS -o /dev/null http://127.0.0.1:4007; then
		echo "    Postiz is up (took ${i}0s)"
		break
	fi
	sleep 10
done

echo
echo "Done. Open https://${DOMAIN} — Caddy will issue the cert on first hit."
echo "First-time setup:"
echo "  1. flip DISABLE_REGISTRATION=false in .env, then 'sudo docker compose up -d'"
echo "  2. visit https://${DOMAIN} and register the admin account"
echo "  3. flip DISABLE_REGISTRATION=true and 'sudo docker compose up -d' again"
