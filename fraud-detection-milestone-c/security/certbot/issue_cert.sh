#!/usr/bin/env bash
# security/certbot/issue_cert.sh
# Issue a Let's Encrypt certificate for production deployment.
#
# Prerequisites:
#   - Domain DNS A record points to this server
#   - Port 80 open in firewall
#   - Docker running with nginx on port 80
#
# Usage:
#   chmod +x security/certbot/issue_cert.sh
#   ./security/certbot/issue_cert.sh yourdomain.com admin@yourdomain.com

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

[[ -z "$DOMAIN" ]] && { echo "Usage: $0 <domain> <email>"; exit 1; }
[[ -z "$EMAIL"  ]] && { echo "Usage: $0 <domain> <email>"; exit 1; }

echo "Issuing Let's Encrypt certificate for: $DOMAIN"
echo "Contact email: $EMAIL"

# Create webroot directory for ACME challenge
mkdir -p /var/www/certbot

# Issue certificate using certbot standalone (stops nginx briefly)
# Or use webroot if nginx is already running with the certbot location block
if docker ps --format '{{.Names}}' | grep -q 'fraud_nginx'; then
    echo "Nginx is running — using webroot challenge..."
    docker run --rm \
        -v /etc/letsencrypt:/etc/letsencrypt \
        -v /var/lib/letsencrypt:/var/lib/letsencrypt \
        -v /var/www/certbot:/var/www/certbot \
        certbot/certbot certonly \
            --webroot \
            --webroot-path /var/www/certbot \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN"
else
    echo "Nginx not running — using standalone challenge..."
    docker run --rm \
        -p 80:80 \
        -v /etc/letsencrypt:/etc/letsencrypt \
        -v /var/lib/letsencrypt:/var/lib/letsencrypt \
        certbot/certbot certonly \
            --standalone \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN"
fi

echo ""
echo "Certificate issued to: /etc/letsencrypt/live/$DOMAIN/"
echo ""
echo "Next steps:"
echo "  1. Copy nginx-certbot.conf to security/nginx/nginx.conf"
echo "  2. Replace DOMAIN_PLACEHOLDER with $DOMAIN in the config"
echo "  3. Rebuild nginx: make up-security"
echo "  4. Set up auto-renewal: ./security/certbot/renew_certs.sh (add to cron)"
