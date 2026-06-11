#!/usr/bin/env bash
# security/certbot/renew_certs.sh
# Renews Let's Encrypt certificates and reloads nginx.
# Add to crontab to run twice daily (certbot only renews when < 30 days remain):
#
#   0 0,12 * * * /path/to/fraud-detection/security/certbot/renew_certs.sh >> /var/log/certbot-renew.log 2>&1

set -euo pipefail

echo "$(date -u): Checking certificate renewal..."

docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/lib/letsencrypt:/var/lib/letsencrypt \
    -v /var/www/certbot:/var/www/certbot \
    certbot/certbot renew --quiet

# Reload nginx to pick up renewed certs
if docker ps --format '{{.Names}}' | grep -q 'fraud_nginx'; then
    docker exec fraud_nginx nginx -s reload
    echo "$(date -u): Nginx reloaded with renewed certificates"
else
    echo "$(date -u): Nginx not running — skipping reload"
fi
