# Piper TTS Deployment Guide

## Overview

Piper is a lightweight, fast, open-source TTS engine. Perfect for scalable LMS deployments.

## Local Development Setup

### Option 1: Direct Installation (Linux/MacOS)

```bash
# Install Python 3.10+
python --version  # Should be 3.10 or higher

# Create virtual environment
python -m venv piper-env
source piper-env/bin/activate  # Linux/MacOS
# or: piper-env\Scripts\activate  # Windows

# Install Piper
pip install piper-tts

# Download model (automatically downloads on first use)
# Or manually:
mkdir -p ~/.local/share/piper/models
piper-tts --download-dir ~/.local/share/piper/models

# Start server
piper-tts --port 5002
```

Server will be available at: `http://localhost:5002`

### Option 2: Docker (Recommended)

```bash
# Simplest - just run:
docker run -d -p 5002:5002 rhasspy/piper:latest

# Or with persistence:
docker run -d \
  -p 5002:5002 \
  -v ${HOME}/.local/share/piper:/home/piper/.local/share/piper \
  rhasspy/piper:latest
```

### Option 3: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  piper-tts:
    image: rhasspy/piper:latest
    ports:
      - "5002:5002"
    volumes:
      - piper-models:/home/piper/.local/share/piper
    environment:
      - PIPER_DOWNLOAD_DIR=/home/piper/.local/share/piper
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5002/api/synthesize"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  piper-models:
```

Run with:
```bash
docker-compose up -d
```

## Production Deployment

### AWS Deployment (EC2)

```bash
# 1. Launch EC2 instance
# - Type: t3.medium or t3.large (for GPU support: g4dn.xlarge)
# - OS: Ubuntu 22.04 LTS
# - Security Group: Allow port 5002

# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# 3. Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# 4. Start Piper
docker run -d \
  -p 5002:5002 \
  --restart always \
  -v /home/ubuntu/piper-models:/home/piper/.local/share/piper \
  rhasspy/piper:latest

# 5. Verify
curl http://localhost:5002/api/synthesize
```

### Google Cloud Run (Serverless)

```bash
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM rhasspy/piper:latest
EXPOSE 5002
EOF

# Deploy
gcloud run deploy piper-tts \
  --source . \
  --platform managed \
  --region us-central1 \
  --memory 2GB \
  --port 5002
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: piper-tts
spec:
  replicas: 3  # Scale as needed
  selector:
    matchLabels:
      app: piper-tts
  template:
    metadata:
      labels:
        app: piper-tts
    spec:
      containers:
      - name: piper
        image: rhasspy/piper:latest
        ports:
        - containerPort: 5002
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/synthesize
            port: 5002
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: piper-tts
spec:
  selector:
    app: piper-tts
  ports:
  - port: 5002
    targetPort: 5002
  type: LoadBalancer
```

Deploy with:
```bash
kubectl apply -f piper-deployment.yaml
```

## Performance Optimization

### With GPU Support

For significantly faster synthesis (10x faster):

```bash
# NVIDIA GPU
docker run -d \
  --gpus all \
  -p 5002:5002 \
  rhasspy/piper:latest

# Or with volume for models
docker run -d \
  --gpus all \
  -p 5002:5002 \
  -v piper-models:/home/piper/.local/share/piper \
  rhasspy/piper:latest
```

### Load Balancing

For high traffic (1000+ concurrent users):

```yaml
# Nginx config
upstream piper_backend {
  server piper1:5002;
  server piper2:5002;
  server piper3:5002;
}

server {
  listen 80;
  location /api/ {
    proxy_pass http://piper_backend;
    proxy_connect_timeout 5s;
    proxy_request_buffering off;
  }
}
```

### Caching Layer (Redis)

```yaml
# Cache first response, serve from cache on repeat
redis:
  image: redis:alpine
  ports:
    - "6379:6379"
```

## Monitoring & Health Checks

### Simple Health Check

```bash
curl http://localhost:5002/api/synthesize \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "voice": "en_US-amy-medium"
  }'
```

### Prometheus Metrics

```bash
# Add Prometheus exporter
curl -X POST http://localhost:5002/metrics
```

### Logging

```bash
# Docker logs
docker logs -f piper-tts-container

# Or with docker-compose
docker-compose logs -f piper-tts
```

## Integration with LMS

### Update .env.production

```env
VITE_PIPER_API_URL=https://piper.yourdomain.com
VITE_PIPER_API_KEY=optional_api_key

# Optional: Advanced settings
PIPER_POOL_SIZE=10  # Connection pool
PIPER_TIMEOUT=30000  # 30 second timeout
PIPER_RETRY_COUNT=3  # Retries on failure
```

### Application Configuration

```typescript
// lib/ttsService.ts - already configured for both local and remote

const piperApiUrl = import.meta.env.VITE_PIPER_API_URL || 'http://localhost:5002';

// Auto-detects: local development → production
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 5002
lsof -i :5002

# Kill process
kill -9 <PID>

# Or use different port
docker run -p 5003:5002 rhasspy/piper:latest
```

### Out of Memory

```bash
# Increase memory limit
docker run -m 4g -p 5002:5002 rhasspy/piper:latest

# Or in docker-compose
services:
  piper-tts:
    mem_limit: 4g
```

### Audio Quality Issues

```bash
# Use higher quality voice
curl -X POST http://localhost:5002/api/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "High quality speech",
    "voice": "en_US-glow-tts"  # Higher quality
  }'

# Available voices:
# en_US-glow-tts (High quality, slower)
# en_US-amy-medium (Medium quality, fast)
# en_US-ryan-low (Lower quality, very fast)
```

## Cost Analysis

### Self-Hosted Piper

- **Development**: Free (local)
- **Production (1M requests/month)**:
  - EC2 t3.medium: ~$30/month
  - GPU (g4dn.xlarge): ~$1.50/hour
  - Storage: ~$5/month
  - **Total**: ~$400-500/month with GPU

### Compared to Services

- **Google Cloud Text-to-Speech**: $16 per 1M characters
  - 1M requests × 100 avg chars = $1.60/month ✅ Cheaper
  - But less control, API limits
  
- **Azure Text-to-Speech**: $4 per 1M characters
  - Similar cost to Google
  - Better for enterprise with SLA

**Verdict**: Self-hosted Piper is most cost-effective for LMS at scale

## Scaling Strategy

### Phase 1: Single Instance (0-100k students)
```
Local Piper → t3.medium EC2 → Cached responses
```

### Phase 2: Multi-Instance (100k-1M students)
```
Load Balancer → 3x Piper instances → Shared Redis cache
```

### Phase 3: Global Distribution (1M+ students)
```
CDN → Regional Piper clusters → Distributed cache
```

## API Reference

### Synthesize Endpoint

```bash
POST /api/synthesize

{
  "text": "Hello world",
  "voice": "en_US-amy-medium",
  "quality": "medium",  # high, medium, low
  "speed": 1.0         # 0.5 to 2.0
}

Response:
{
  "audio": "base64_encoded_audio",
  "duration": 1.5,
  "format": "wav"
}
```

### Available Voices

- `en_US-glow-tts` - High quality, female, slow
- `en_US-amy-medium` - Medium quality, female, fast
- `en_US-ryan-low` - Low quality, male, very fast
- `en_US-ryan-high` - High quality, male

### Health Check Endpoint

```bash
GET /health

Response:
{
  "status": "ok",
  "version": "1.0.0"
}
```

## Maintenance

### Update Piper

```bash
# Docker
docker pull rhasspy/piper:latest
docker-compose down
docker-compose up -d

# Python
pip install --upgrade piper-tts
```

### Clean Up Old Models

```bash
# Remove cache (models) to free space
rm -rf ~/.local/share/piper/models/*

# Or keep only specific voices
rm ~/.local/share/piper/models/en_US-glow-tts.onnx
```

### Backup Strategy

```bash
# Backup models directory
tar -czf piper-backup-$(date +%Y%m%d).tar.gz \
  ~/.local/share/piper/

# Or with S3
aws s3 sync ~/.local/share/piper/ s3://my-backup/piper/
```

## Quick Reference Commands

```bash
# Development
docker run -p 5002:5002 rhasspy/piper:latest

# Production
docker run -d --restart always -p 5002:5002 rhasspy/piper:latest

# With persistent storage
docker run -d \
  -v piper-models:/home/piper/.local/share/piper \
  -p 5002:5002 \
  rhasspy/piper:latest

# With GPU
docker run -d --gpus all -p 5002:5002 rhasspy/piper:latest

# Check logs
docker logs <container_id>

# Test
curl -X POST http://localhost:5002/api/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"test","voice":"en_US-amy-medium"}'
```

## Support

- **Piper Project**: https://github.com/rhasspy/piper
- **Docker Hub**: https://hub.docker.com/r/rhasspy/piper
- **Documentation**: https://github.com/rhasspy/piper/README.md
