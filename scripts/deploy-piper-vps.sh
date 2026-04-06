#!/bin/bash
# =================================================================
# Piper TTS VPS Deployment Script
# =================================================================
# Deploy self-hosted Piper TTS to production VPS
# 
# Supports:
# - Ubuntu 20.04 LTS and higher
# - DigitalOcean, Linode, AWS Lightsail, etc.
# 
# Prerequisites:
# - Fresh Ubuntu 20.04+ server
# - sudo/root access
# - Domain name (with DNS pointing to server)
# - 2GB+ RAM, 2 CPU cores minimum
#
# Usage: sudo bash deploy-piper-vps.sh
# =================================================================

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

echo -e "${BLUE}"
echo "=========================================="
echo "Piper TTS VPS Deployment"
echo "=========================================="
echo -e "${NC}"

# Variables (customize these)
PIPER_USER="piper"
PIPER_HOME="/opt/piper"
PIPER_PORT=5002
DOMAIN="${DOMAIN:-tts.example.com}"
ENABLE_SSL="${ENABLE_SSL:-true}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@example.com}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Piper user: $PIPER_USER"
echo "  Install dir: $PIPER_HOME"
echo "  Port: $PIPER_PORT"
echo "  Domain: $DOMAIN"
echo "  SSL: $ENABLE_SSL"
echo ""

# ==================== STEP 1: System Updates ====================
echo -e "${YELLOW}[1/7] System updates...${NC}"
apt update
apt upgrade -y
apt install -y \
  python3.10 \
  python3-pip \
  python3-dev \
  nginx \
  curl \
  wget \
  git \
  build-essential \
  libssl-dev \
  libffi-dev \
  podman

echo -e "${GREEN}✅ System updated${NC}"
echo ""

# ==================== STEP 2: Create User ====================
echo -e "${YELLOW}[2/7] Creating piper user...${NC}"

if ! id "$PIPER_USER" &>/dev/null; then
    useradd -m -d "$PIPER_HOME" -s /bin/bash -u 5002 "$PIPER_USER"
    echo -e "${GREEN}✅ User '$PIPER_USER' created${NC}"
else
    echo -e "${GREEN}✅ User '$PIPER_USER' already exists${NC}"
fi
echo ""

# ==================== STEP 3: Install Piper ====================
echo -e "${YELLOW}[3/7] Installing Piper TTS...${NC}"

mkdir -p "$PIPER_HOME"
chown -R "$PIPER_USER:$PIPER_USER" "$PIPER_HOME"

su - "$PIPER_USER" -c "
  python3.10 -m venv venv
  source venv/bin/activate
  pip install --upgrade pip
  pip install piper-tts flask flask-cors gunicorn
"

echo -e "${GREEN}✅ Piper installed${NC}"
echo ""

# ==================== STEP 4: Create Systemd Service ====================
echo -e "${YELLOW}[4/7] Creating systemd service...${NC}"

cat > /etc/systemd/system/piper-tts.service << EOF
[Unit]
Description=Piper TTS Server
After=network.target
Wants=network-online.target

[Service]
Type=notify
User=$PIPER_USER
WorkingDirectory=$PIPER_HOME
Environment="PATH=$PIPER_HOME/venv/bin"
ExecStart=$PIPER_HOME/venv/bin/python3 -m piper.server --host 0.0.0.0 --port $PIPER_PORT
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=piper-tts

# Security settings
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=full
ProtectHome=yes
ReadWritePaths=$PIPER_HOME

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable piper-tts
systemctl start piper-tts

echo -e "${GREEN}✅ Systemd service created and started${NC}"
systemctl status piper-tts
echo ""

# ==================== STEP 5: Configure Nginx ====================
echo -e "${YELLOW}[5/7] Configuring Nginx reverse proxy...${NC}"

cat > /etc/nginx/sites-available/piper-tts << EOF
# Piper TTS Server - Reverse Proxy
# Auto-generated - $(date)

upstream piper_backend {
    server 127.0.0.1:$PIPER_PORT;
    keepalive 32;
}

server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 10M;

    location / {
        proxy_pass http://piper_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '\*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
        add_header 'Access-Control-Max-Age' '86400' always;
        
        # Cache headers
        add_header 'Cache-Control' 'public, max-age=86400' always;
    }
}
EOF

ln -sf /etc/nginx/sites-available/piper-tts /etc/nginx/sites-enabled/piper-tts
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

systemctl restart nginx

echo -e "${GREEN}✅ Nginx configured${NC}"
echo ""

# ==================== STEP 6: SSL Certificate (Let's Encrypt) ====================
if [ "$ENABLE_SSL" = "true" ]; then
    echo -e "${YELLOW}[6/7] Setting up SSL certificate...${NC}"
    
    apt install -y certbot python3-certbot-nginx
    
    # Obtain certificate
    certbot certonly --nginx \
        -d "$DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email "$CERTBOT_EMAIL"
    
    # Update Nginx config with SSL
    cat > /etc/nginx/sites-available/piper-tts << EOF
# Piper TTS Server - Reverse Proxy (SSL)
# Auto-generated - $(date)

upstream piper_backend {
    server 127.0.0.1:$PIPER_PORT;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    client_max_body_size 10M;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://piper_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '\*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
        add_header 'Access-Control-Max-Age' '86400' always;
        
        # Cache headers
        add_header 'Cache-Control' 'public, max-age=86400' always;
    }
}
EOF

    nginx -t
    systemctl restart nginx
    
    echo -e "${GREEN}✅ SSL certificate configured${NC}"
else
    echo -e "${YELLOW}[6/7] SSL disabled (skipped)${NC}"
fi
echo ""

# ==================== STEP 7: Monitoring & Maintenance ====================
echo -e "${YELLOW}[7/7] Setting up monitoring...${NC}"

# Create health check script
cat > /usr/local/bin/piper-health-check.sh << 'EOF'
#!/bin/bash
# Piper TTS Health Check
# Restarts service if unhealthy

PIPER_URL="http://127.0.0.1:5002/health"
TIMEOUT=5

response=$(curl -s -m $TIMEOUT "$PIPER_URL")

if [[ "$response" == *"healthy"* ]]; then
    exit 0
else
    echo "[ALERT] Piper health check failed. Restarting..."
    systemctl restart piper-tts
    exit 1
fi
EOF

chmod +x /usr/local/bin/piper-health-check.sh

# Add to crontab
crontab -l 2>/dev/null | grep -q "piper-health-check" || \
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/piper-health-check.sh >> /var/log/piper-health.log 2>&1") | crontab -

echo -e "${GREEN}✅ Health checks configured${NC}"
echo ""

# ==================== Summary ====================
echo -e "${BLUE}"
echo "=========================================="
echo "✅ Deployment Complete"
echo "=========================================="
echo -e "${NC}"

echo -e "${GREEN}Summary:${NC}"
echo "  Service: piper-tts"
echo "  Listen: 127.0.0.1:$PIPER_PORT"
echo "  Proxy: $DOMAIN (Nginx reverse proxy)"
echo "  User: $PIPER_USER"
echo "  Home: $PIPER_HOME"
echo ""

echo -e "${GREEN}Verification:${NC}"
echo "  Check service: systemctl status piper-tts"
echo "  View logs: journalctl -u piper-tts -f"
echo "  Test health: curl https://$DOMAIN/health"
echo ""

echo -e "${GREEN}Configuration:${NC}"
echo "  Update app .env:"
echo "    VITE_PIPER_API_URL=https://$DOMAIN"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Wait 30s for service to stabilize"
echo "  2. Test: curl https://$DOMAIN/health"
echo "  3. List voices: curl https://$DOMAIN/api/voices"
echo "  4. Update app configuration"
echo "  5. Monitor: tail -f /var/log/syslog | grep piper"
echo ""

echo -e "${YELLOW}Maintenance:${NC}"
echo "  View service logs: journalctl -u piper-tts -f"
echo "  Restart service: systemctl restart piper-tts"
echo "  Stop service: systemctl stop piper-tts"
echo "  Renew SSL: certbot renew --nginx"
echo ""

echo -e "${BLUE}=========================================="
echo "Deployment Details Saved"
echo "=========================================="
echo -e "${NC}"

# Save deployment info
cat > "$PIPER_HOME/DEPLOYMENT.txt" << EOF
Piper TTS Deployment Info
Generated: $(date)

Server: $DOMAIN
User: $PIPER_USER
Home: $PIPER_HOME
Port: $PIPER_PORT
SSL: $ENABLE_SSL

Service Status: $(systemctl is-active piper-tts)
Service Enabled: $(systemctl is-enabled piper-tts)

Useful commands:
  systemctl status piper-tts
  journalctl -u piper-tts -f
  curl https://$DOMAIN/health
EOF

chown "$PIPER_USER:$PIPER_USER" "$PIPER_HOME/DEPLOYMENT.txt"

echo -e "${GREEN}✅ All set! Your Piper TTS server is ready.${NC}"
