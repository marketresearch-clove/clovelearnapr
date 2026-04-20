# Cloudflare Worker - Ollama API Proxy Setup

This Cloudflare Worker proxies Ollama API requests from your Skill Spire LMS frontend to your Ollama cloud service, eliminating CORS issues.

## 🚀 Quick Start

### Step 1: Install Wrangler (Cloudflare CLI)
```bash
npm install -g @cloudflare/wrangler
# or
yarn global add @cloudflare/wrangler
```

### Step 2: Authenticate with Cloudflare
```bash
wrangler login
# This opens your browser to authorize the CLI
```

### Step 3: Deploy the Worker
```bash
cd /path/to/Skill-Spire-LMS
wrangler deploy
```

### Step 4: Get Your Worker URL
After deployment, Wrangler will show:
```
✓ Deployed to https://skill-spire-ollama-proxy.<your-account>.workers.dev
```

Copy this URL and update in `.env.local`:
```bash
# Update aiService.ts line with your actual URL:
const CLOUDFLARE_WORKER_URL = 'https://skill-spire-ollama-proxy.<your-account>.workers.dev';
```

---

## 🔐 Environment Variables Setup

Set these in **Cloudflare Dashboard**:

1. Go to: **Workers & Pages → skill-spire-ollama-proxy → Settings → Variables**

2. Add **Environment Variables**:
   - **OLLAMA_API_KEY**: `96e436caac5b44b690f3e74ab3a15d5f.BKrXiyB8iOKgIPgLCX7PdSwa`
   - **OLLAMA_API_URL**: `https://api.ollama.ai` (or your cloud endpoint)

3. Click **Deploy** to save

---

## 🧪 Test the Worker

### Option 1: Using cURL
```bash
curl -X POST https://skill-spire-ollama-proxy.<your-account>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.1:cloud",
    "prompt": "What is machine learning?",
    "maxTokens": 100
  }'
```

### Option 2: Using your browser
1. Start Skill Spire LMS on `localhost:5173`
2. Create a new course with Ollama provider
3. Watch console for: ✅ `Ollama response received via Cloudflare Worker`

---

## 🔗 Update Your Frontend (Already Done!)

The frontend is already configured to use:
```javascript
const CLOUDFLARE_WORKER_URL = 'https://ollama-proxy.clovetech.workers.dev';
```

**After deployment**, update this URL with your actual worker URL.

---

## 📦 Deployment to Netlify

When deploying to `clovelearn.netlify.app`:

1. No environment variables needed on Netlify (they're on Cloudflare)
2. The frontend will call your Cloudflare Worker
3. Worker will proxy to Ollama cloud API

**Flow:**
```
Browser (clovelearn.netlify.app)
    ↓
Cloudflare Worker (ollama-proxy.workers.dev)
    ↓
Ollama Cloud API (api.ollama.ai)
```

---

## ✅ Troubleshooting

### 404 Not Found
- Check Worker is deployed: `wrangler deployments list`
- Verify URL in `aiService.ts` matches your worker URL

### 401/403 Unauthorized
- Check `OLLAMA_API_KEY` is correct in Cloudflare dashboard
- Verify it's not expired

### Empty Response
- Check `OLLAMA_API_URL` in Cloudflare environment variables
- Verify Ollama cloud service is accessible

### Check Worker Logs
```bash
wrangler tail
```

---

## 🛠 Advanced Configuration

### Custom Domain
Instead of `workers.dev`, use your own domain:

1. In `wrangler.toml`, set custom domain
2. Update `aiService.ts` with custom URL

### Caching Responses
To cache responses (optional), edit `src/index.ts` and add caching logic.

---

## 📝 Files Created/Modified

- ✅ `wrangler.toml` - Worker configuration
- ✅ `src/index.ts` - Worker code
- ✅ `lib/aiService.ts` - Updated to use Worker
- ✅ `CLOUDFLARE_WORKER_SETUP.md` - This file

---

## 🔗 Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/cli-wrangler/)
- [Cloudflare KV (optional caching)](https://developers.cloudflare.com/workers/runtime-apis/kv/)
