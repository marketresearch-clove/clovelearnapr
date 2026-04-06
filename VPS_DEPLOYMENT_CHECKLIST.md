# VPS Deployment Checklist & Guide

## 🎯 Complete VPS Deployment for Piper TTS

This guide walks you through deploying Piper TTS to a production VPS for unlimited, cost-effective TTS synthesis.

---

## 📋 Pre-Deployment Checklist

### Infrastructure
- [ ] VPS provisioned (Ubuntu 20.04+ LTS)
- [ ] 2GB+ RAM, 2+ CPU cores
- [ ] 20GB+ storage
- [ ] SSH access configured
- [ ] Public IP address assigned
- [ ] Domain name registered and DNS configured

### Prerequisites
- [ ] Domain pointing to VPS IP (or update ongoing)
- [ ] Email address for SSL certificate (admin@domain.com)
- [ ] SSH key pair generated and stored safely
- [ ] Terminal access to VPS

### Application
- [ ] Skill-Spire LMS application ready
- [ ] Supabase project initialized
- [ ] Database migrations applied (lesson_audio_cache, lesson_tts_settings)
- [ ] Environment variables documented

---

## 🚀 Step-by-Step Deployment

### Step 1: Provision VPS

#### Option A: DigitalOcean
1. Create new Droplet
   - Image: Ubuntu 20.04 LTS x64
   - Size: Basic ($5-10/month) or Standard ($20+/month)
   - Region: Closest to users
   - Authentication: SSH Key
2. Wait for provisioning (2-3 min)
3. Connect: `ssh root@[IP]`

#### Option B: Linode
1. Create Linode
   - Distribution: Ubuntu 20.04 LTS
   - Type: Nanode/Linode 2GB (5GB disk, $5/month)
   - Region: Closest to users
2. Boot & wait for startup
3. Connect: `ssh root@[IP]`

#### Option C: AWS Lightsail
1. Create Instance
   - Instance image: Ubuntu 20.04 LTS
   - Plan: 2GB RAM ($10/month)
   - Key pair: Generate or use existing
2. Wait for startup
3. Connect: `ssh ubuntu@[IP]`

### Step 2: Initial Server Setup

```bash
# Connect to server
ssh root@XXX.XXX.XXX.XXX

# Update hostname (optional)
hostnamectl set-hostname piper-tts

# Set timezone
timedatectl set-timezone UTC  # Or your timezone

# Update system
apt update && apt upgrade -y

# Verify domain DNS resolution
nslookup tts.yourdomain.com
```

### Step 3: Configure Domain DNS

Update your domain registrar (GoDaddy, Namecheap, etc.):

```dns
Type: A
Name: tts (or @ for root subdomain)
Value: [VPS_IP_ADDRESS]
TTL: 3600 (1 hour)
```

Wait 5-15 minutes for DNS propagation:
```bash
# Test from server
dig tts.yourdomain.com @8.8.8.8
```

### Step 4: Deploy Piper TTS

#### Automated Deployment (Recommended)
```bash
# Download and run deployment script
wget https://raw.githubusercontent.com/youruseraccount/skill-spire-lms/main/scripts/deploy-piper-vps.sh
chmod +x deploy-piper-vps.sh

# Configure environment
export DOMAIN="tts.yourdomain.com"
export CERTBOT_EMAIL="admin@yourdomain.com"
export ENABLE_SSL="true"

# Run deployment
sudo bash deploy-piper-vps.sh
```

#### Manual Deployment
See sections below for step-by-step instructions.

### Step 5: Verify Deployment

```bash
# Check service status
sudo systemctl status piper-tts

# View service logs
sudo journalctl -u piper-tts -n 20

# Test health endpoint
curl https://tts.yourdomain.com/health

# List available voices
curl https://tts.yourdomain.com/api/voices

# Test synthesis
curl -X POST https://tts.yourdomain.com/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Testing Piper TTS",
    "speaker": "en_US-lessac-high",
    "lengthScale": 0.9
  }' --output test.wav

# Play audio (if local)
ffplay test.wav
```

### Step 6: Configure Application

Update your Skill-Spire LMS `.env`:

```bash
# .env or .env.production
VITE_PIPER_API_URL=https://tts.yourdomain.com
VITE_DEFAULT_VOICE_GENDER=female
VITE_TTS_ENABLE_CACHE=true
VITE_TTS_DEBUG=false
```

Redeploy application:
```bash
npm run build
npm run start
```

### Step 7: Monitor & Maintain

#### Health Checks
```bash
# Manual health check
curl https://tts.yourdomain.com/health

# Automated (runs every 5 minutes)
# Via cron job (automatically installed)
```

#### View Logs
```bash
# Recent logs
sudo journalctl -u piper-tts -n 50

# Real-time logs
sudo journalctl -u piper-tts -f

# System logs
sudo tail -f /var/log/syslog | grep piper
```

#### Restart Service
```bash
# Quick restart
sudo systemctl restart piper-tts

# If needed
sudo systemctl stop piper-tts
sudo systemctl start piper-tts
```

#### SSL Certificate Renewal
```bash
# Manual renewal (auto-runs via cron)
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal

# Check renewal status
sudo certbot certificates
```

---

## 🛠️ Manual Deployment Steps

If not using automated script, follow these steps:

### 1. User & Directory Setup
```bash
useradd -m -d /opt/piper -s /bin/bash piper
sudo -u piper mkdir -p /opt/piper/app
```

### 2. Install Python & Dependencies
```bash
apt install -y python3.10 python3-pip python3-venv
apt install -y nginx certbot python3-certbot-nginx
apt install -y build-essential libssl-dev libffi-dev

# Create virtual environment
sudo -u piper python3.10 -m venv /opt/piper/venv

# Activate and install packages
sudo -u piper /opt/piper/venv/bin/pip install --upgrade pip
sudo -u piper /opt/piper/venv/bin/pip install piper-tts flask flask-cors gunicorn
```

### 3. Create Systemd Service
Save as `/etc/systemd/system/piper-tts.service`:

```ini
[Unit]
Description=Piper TTS Server
After=network.target

[Service]
Type=simple
User=piper
WorkingDirectory=/opt/piper
Environment="PATH=/opt/piper/venv/bin"
ExecStart=/opt/piper/venv/bin/python3 -m piper.server --host 0.0.0.0 --port 5002
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
systemctl daemon-reload
systemctl enable piper-tts
systemctl start piper-tts
```

### 4. Configure Nginx
Save as `/etc/nginx/sites-available/piper-tts`:

```nginx
upstream piper_backend {
    server 127.0.0.1:5002;
}

server {
    listen 80;
    server_name tts.yourdomain.com;

    location / {
        proxy_pass http://piper_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
    }
}
```

Then:
```bash
ln -s /etc/nginx/sites-available/piper-tts /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 5. Setup SSL (Let's Encrypt)
```bash
certbot certonly --nginx -d tts.yourdomain.com

# Update Nginx config with SSL certificate paths
```

---

## 📊 Performance Tuning

### Nginx Optimization
Add to Nginx configuration:
```nginx
# Connection pooling
upstream piper_backend {
    server 127.0.0.1:5002 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Caching
location / {
    proxy_cache PIPER;
    proxy_cache_valid 200 24h;
    proxy_cache_key "$scheme$request_method$host$request_uri";
}
```

### Piper Optimization
```bash
# Check current processes
ps aux | grep piper

# Monitor CPU/Memory
top -u piper

# Adjust if needed (requires more RAM/CPU)
# Edit: /etc/systemd/system/piper-tts.service
# Add: EXE Environment variables like THREADS=4
```

### Supabase Caching
Enable in `.env`:
```bash
VITE_TTS_CACHE_RETENTION_DAYS=30
VITE_TTS_ENABLE_CACHE=true
```

---

## 🚨 Troubleshooting

### Service Won't Start
```bash
# Check logs
journalctl -u piper-tts -n 50

# Check port availability
lsof -i :5002

# Manually test Python
/opt/piper/venv/bin/python3 -m piper.server
```

### SSL Certificate Issues
```bash
# Check certificate status
certbot certificates

# Force renewal
certbot renew --force-renewal --nginx

# Check expiration
openssl x509 -enddate -noout -in /etc/letsencrypt/live/tts.yourdomain.com/cert.pem
```

### Nginx Not Proxying
```bash
# Test Nginx config
nginx -t

# Check logs
tail -f /var/log/nginx/error.log

# Test proxy manually
curl -v http://127.0.0.1:5002/health
```

### Domain Not Resolving
```bash
# Check DNS propagation
dig tts.yourdomain.com

# Check from VPS
nslookup tts.yourdomain.com

# Clear DNS cache
systemctl restart systemd-resolved
```

### CORS Errors
```bash
# Nginx is handling CORS, but verify headers are sent
curl -I https://tts.yourdomain.com/health

# Should see:
# Access-Control-Allow-Origin: *
```

---

## 📈 Monitoring & Alerts

### Set Up Monitoring
```bash
# Install Prometheus (optional)
apt install -y prometheus

# Or use external service (Datadog, New Relic, etc.)
```

### Health Check Cron Job
```bash
# Auto-installed by deployment script
# Restarts service if unhealthy
crontab -l | grep piper-health
```

### Disk Space Monitoring
```bash
# Check disk usage
df -h

# Monitor Piper cache directory
du -sh /opt/piper

# Clean old cache if needed
find /opt/piper -mtime +30 -delete
```

---

## 🔐 Security Hardening

### Firewall Configuration
```bash
# Allow SSH, HTTP, HTTPS only
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

### User Permissions
```bash
# Piper user has restricted shell
su - piper -c "whoami"  # Should show 'piper'

# Cannot use sudo
sudo -u piper sudo whoami  # Should fail
```

### SSL Security
```bash
# Check cert strength
openssl s_client -connect tts.yourdomain.com:443

# Recommended: A+ rating on SSL Labs
# https://www.ssllabs.com/ssltest/
```

### Rate Limiting (Advanced Nginx)
```nginx
limit_req_zone $binary_remote_addr zone=piper:10m rate=30r/m;

server {
    location /api/tts {
        limit_req zone=piper burst=10;
        proxy_pass http://piper_backend;
    }
}
```

---

## 💰 Cost Breakdown

### Server Costs (per month)
```
DigitalOcean Basic ($5):
  - 512 MB RAM, 1 vCPU, 20GB SSD
  - Limited: ~10-20 concurrent requests

DigitalOcean Standard ($12):
  - 2GB RAM, 2 vCPU, 60GB SSD
  - Good: ~50-100 concurrent requests (recommended)

DigitalOcean Advanced ($24):
  - 4GB RAM, 4 vCPU, 80GB SSD
  - Excellent: 200+ concurrent requests
```

### Bandwidth Costs
```
Most VPS: 1-5TB included
Audio bandwidth: ~1MB per minute of synthesis
Estimate: 5TB ≈ 5 million minutes of audio per month
```

### Additional Costs
```
Domain: $10-15/year
SSL: FREE (Let's Encrypt)
Backup: Included or $5-10/month

TOTAL PER MONTH (basic): $5-10
TOTAL PER MONTH (recommended): $15-20
```

---

## 🎯 Post-Deployment Tasks

1. **[ ] Update Application Configuration**
   ```bash
   # .env or .env.production
   VITE_PIPER_API_URL=https://tts.yourdomain.com
   ```

2. **[ ] Pre-generate Audio** (optional)
   ```bash
   npm run tts:pregen -- --all-courses
   ```

3. **[ ] Load Testing**
   ```bash
   npm run test:tts-load
   ```

4. **[ ] Monitor for 24 Hours**
   - Check logs regularly
   - Monitor resource usage
   - Test audio playback in app

5. **[ ] Set Up Automated Backups**
   - Backup certificate files
   - Backup service configuration

6. **[ ] Document Setup**
   - Save deployment scripts
   - Document domain/IP addresses
   - Save certificate renewal dates

---

## 📞 Support Resources

- **Piper GitHub:** https://github.com/rhasspy/piper
- **Nginx Documentation:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/
- **DigitalOcean Docs:** https://docs.digitalocean.com/
- **Ubuntu Docs:** https://help.ubuntu.com/

---

**Last Updated:** April 2, 2026  
**Status:** ✅ VPS Deployment Complete  
**Maintenance:** Monthly SSL renewal + quarterly updates recommended
