# TTS QUICK REFERENCE

## ⚡ Start Piper (Local)

### Windows - Run Setup
```powershell
cd scripts
.\setup-piper-local.ps1
```

### Windows - Manual
```powershell
python -m pip install piper-tts flask flask-cors
python -m piper.server --host 0.0.0.0 --port 5002
```

### macOS/Linux
```bash
pip3 install piper-tts
piper-tts-server --host 0.0.0.0 --port 5002
```

---

## 🧪 Test Piper

```bash
# Health check
curl http://localhost:5002/health

# List voices
curl http://localhost:5002/api/voices

# Synthesis test
curl -X POST http://localhost:5002/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "speaker": "en_US-lessac-high",
    "lengthScale": 0.9
  }' --output test.wav
```

---

## 🚀 Start Web App

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

## 📊 Deploy to VPS

```bash
# On VPS (Ubuntu 20.04+)
export DOMAIN="tts.yourdomain.com"
export CERTBOT_EMAIL="admin@yourdomain.com"

wget https://raw.githubusercontent.com/.../deploy-piper-vps.sh
sudo bash deploy-piper-vps.sh
```

---

## 🔧 Environment

```bash
# .env or .env.local for DEV
VITE_PIPER_API_URL=http://localhost:5002

# .env.production for VPS
VITE_PIPER_API_URL=https://tts.yourdomain.com
```

---

## 📚 Complete Guides

| Goal | Document |
|------|----------|
| **Test in browser** | [TTS_WEB_APP_TESTING_GUIDE.md](TTS_WEB_APP_TESTING_GUIDE.md) |
| **Technical details** | [FREE_UNLIMITED_TTS_GUIDE.md](FREE_UNLIMITED_TTS_GUIDE.md) |
| **VPS deployment** | [VPS_DEPLOYMENT_CHECKLIST.md](VPS_DEPLOYMENT_CHECKLIST.md) |
| **Everything** | [TTS_README.md](TTS_README.md) |

---

## 🎯 Available Voices

```
Female (professional):
  en_US-lessac-high  ← Use for lectures
  en_US-amy-medium

Male (authoritative):
  en_US-ryan-high    ← Use for teaching
```

---

## ⚙️ npm Scripts

```bash
npm run tts:setup              # Setup (Windows)
npm run tts:test              # Test TTS
npm run tts:pregen --all      # Pre-generate all courses
npm run tts:deploy:vps        # Deploy to VPS
```

---

## 🐛 Troubleshoot

| Issue | Fix |
|-------|-----|
| "Failed to fetch" | Start Piper: `python -m piper.server` |
| "CORS error" | Use CORS wrapper or `--host 0.0.0.0` |
| "No TTS controls" | Check lesson type (not video) |
| "Sounds robotic" | Use speed 0.85x or lessac-high voice |

---

## 💰 Costs

```
Local dev:        FREE
Production VPS:   $5-20/month
Domain:           $0-15/year
─────────────────────────
TOTAL:            $20-50/year + $60-240/year
vs Competitors:   SAVE 95%+ 
```

---

**Version:** 1.0  
**Date:** April 2, 2026  
**Status:** ✅ Production Ready
