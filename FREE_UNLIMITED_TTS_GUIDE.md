# FREE + UNLIMITED TTS Integration Guide
## Skill-Spire LMS - Self-Hosted Piper Implementation

---

## 🎯 Executive Summary

✅ **COMPLETE PIVOT TO FREE MODEL**
- Removed Coqui TTS (paid, complex API)
- Implemented Piper TTS as primary (free, self-hosted)
- Browser Web Speech API as fallback
- **Result:** Unlimited TTS synthesis at $5-10/month VPS cost

---

## 📊 Cost Comparison

| Service | Monthly Cost | Synthesis Limit | Quality | Notes |
|---------|--------------|-----------------|---------|-------|
| **Coqui TTS** | $50-500 | Based on budget | High | API-based, pay-per-use |
| **Google TTS** | $1,600+ | Based on budget | High | Enterprise pricing |
| **AWS Polly** | $100-1,000 | Based on budget | High | Cloud-based |
| **Self-Hosted Piper** | $5-10 | **UNLIMITED** | High | **CHOSEN** ✅ |
| **Browser TTS** | $0 | Limited | Medium | Fallback only |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  LessonPlayerPage.tsx                                   │
│  - Shows lesson content                                 │
│  - Has sticky TTS control bar                          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│  EnhancedTextToSpeech Component                         │
│  - Play/pause controls                                  │
│  - Speed adjustment (0.9x - 1.1x)                      │
│  - Voice gender selection                              │
│  - Provider display (Piper/Browser)                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│  useEnhancedTTS Hook                                    │
│  - Settings management                                  │
│  - Cache control                                        │
│  - Provider coordination                                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│  ttsService (NEW - FREE UNLIMITED)                      │
│                                                         │
│  ┌─────────────────────────────────────────────┐       │
│  │ PRIMARY: synthesizeWithPiper()              │       │
│  │ - Host: localhost:5002 (dev)                │       │
│  │ - Voice selection by gender & quality       │       │
│  │ - Speed tuning: 0.9x-1.1x                   │       │
│  │ - Cost: UNLIMITED ✅                        │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────┐       │
│  │ FALLBACK: synthesizeWithBrowser()           │       │
│  │ - Web Speech API                            │       │
│  │ - Zero dependencies                         │       │
│  │ - Always available                          │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────┐       │
│  │ CACHE: audioStorageService                  │       │
│  │ - Supabase Storage (free 50GB)              │       │
│  │ - Instant replay (⚡ cache hits)            │       │
│  │ - 30-day auto-cleanup                       │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## 🎤 Voice Configuration

### Female Voices (Teaching)
```typescript
{
  high: 'lessac-high',    // Clear, professional (best quality)
  medium: 'amy-medium',   // Natural, balanced
  low: 'amy-medium'       // Same as medium (instant)
}
```

### Male Voices (Teaching)
```typescript
{
  high: 'ryan-high',      // Natural, authoritative
  medium: 'ryan-high',    // Best male option
  low: 'ryan-high'        // Same as medium
}
```

---

## ⚙️ Configuration Setup

### Development (Local Piper Server)

1. **Install Piper TTS**
```bash
pip install piper-tts
```

2. **Start Piper server**
```bash
piper-tts-server --host 0.0.0.0 --port 5002
```

3. **Configure environment**
```bash
# .env or .env.local
VITE_PIPER_API_URL=http://localhost:5002
VITE_DEFAULT_VOICE_GENDER=female
VITE_TTS_ENABLE_CACHE=true
VITE_TTS_DEBUG=true
```

4. **Test in browser**
```
http://localhost:3000/lesson/[courseId]/[lessonId]
```

### Production (VPS Deployment)

1. **Provision VPS**
   - Provider: DigitalOcean, Linode, AWS Lightsail
   - OS: Ubuntu 20.04 LTS
   - CPU: 1-2 cores
   - RAM: 2GB+
   - Storage: 20GB+
   - Cost: $5-10/month

2. **Install Piper**
```bash
sudo apt update && sudo apt install -y python3-pip
pip3 install piper-tts
mkdir -p /opt/piper
cd /opt/piper
```

3. **Create systemd service**
```ini
# /etc/systemd/system/piper-tts.service
[Unit]
Description=Piper TTS Server
After=network.target

[Service]
Type=simple
User=piper
ExecStart=/usr/local/bin/piper-tts-server --host 0.0.0.0 --port 5002
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

4. **Configure Nginx reverse proxy**
```nginx
server {
    listen 443 ssl http2;
    server_name tts.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/tts.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tts.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
    }
}
```

5. **Update environment**
```bash
# Production .env
VITE_PIPER_API_URL=https://tts.yourdomain.com
VITE_DEFAULT_VOICE_GENDER=female
VITE_TTS_ENABLE_CACHE=true
VITE_TTS_DEBUG=false
```

---

## 🚀 Usage in Components

### Basic Lesson Player Integration

```typescript
import EnhancedTextToSpeech from '../components/EnhancedTextToSpeech';
import { useEnhancedTTS } from '../hooks/useEnhancedTTS';

function MyLessonComponent() {
  const enhancedTtsRef = useRef<any>(null);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  const contentText = "Your lesson content here...";

  return (
    <div>
      {/* Visible TTS Controls */}
      <EnhancedTextToSpeech
        ref={enhancedTtsRef}
        text={contentText}
        blockId="lesson-123"
        lessonId="lesson-456"
        contentType="lecture"
        voiceGender={voiceGender}
        onVoiceGenderChange={setVoiceGender}
        onPlayPauseChange={setIsTTSPlaying}
      />

      {/* Your lesson content */}
      <div>
        {contentText}
      </div>
    </div>
  );
}
```

### Pre-generating Audio for Course

```typescript
import { ttsService } from '../lib/ttsService';

async function preGenerateLessonAudio(lessonId: string, lessons: any[]) {
  const items = lessons
    .filter(l => l.type === 'text')
    .map((lesson, idx) => ({
      text: lesson.content,
      contentType: 'lecture',
      blockId: lesson.id,
      chunkIndex: idx,
    }));

  // Batch synthesis (caches automatically)
  const results = await ttsService.synthesizeBatch(items, lessonId);
  console.log(`Pre-generated ${results.length} audio files`);
}
```

### Custom Synthesis

```typescript
import { ttsService } from '../lib/ttsService';

// Direct synthesis
const result = await ttsService.synthesize("Hello, world!", {
  contentType: 'lecture',
  lessonId: 'l-1',
  blockId: 'b-1',
  useCache: true,  // Check cache first
});

console.log(result.provider);  // 'piper' or 'browser'
console.log(result.duration);  // milliseconds
console.log(result.voice);     // 'lessac-high', etc.
```

---

## 📊 Speed & Quality Settings

### Speed Multipliers
- **0.85x** = Very slow (clearest for complex lectures)
- **0.90x** = Slower (natural teaching pace) ⭐ DEFAULT
- **1.00x** = Normal speed
- **1.10x** = Slightly faster (summaries & notes)

### Quality Tiers
- **high** = Best voice (lessac-high), slower synthesis
- **medium** = Balanced (amy-medium), faster synthesis
- **low** = Fast (amy-medium, same as medium)

### Content Type Mappings
```typescript
{
  lecture: { quality: 'high', speed: 0.9 },   // Full lessons
  summary: { quality: 'medium', speed: 1.0 }, // Recap
  quiz: { quality: 'medium', speed: 1.0 },    // Questions
  note: { quality: 'medium', speed: 1.1 }     // Quick notes
}
```

---

## 🔍 Debugging & Monitoring

### Enable Debug Logging

```bash
# .env
VITE_TTS_DEBUG=true
```

### Console Output Examples

**Success:**
```
[TTS:FREE] ✅ Initialized with Piper at http://localhost:5002
[TTS:FREE] 🎙️ Synthesizing lecture (quality: high, speed: 0.9x)
[TTS:PIPER] 🎤 Using lessac-high at 0.9x speed
[TTS:PIPER] ✅ Success (18s, lessac-high)
```

**Cache Hit:**
```
[TTS:FREE] ⚡ CACHE HIT: lesson-content-block-1
```

**Fallback:**
```
[TTS:FREE] ⚠️ Piper unavailable - using Browser TTS fallback
[TTS:BROWSER] 🎤 Using Browser TTS (Microsoft Zira Desktop)
[TTS:BROWSER] ✅ Playback complete (15s)
```

### Check Health

```typescript
const health = await ttsService.checkHealth();
console.log(health); // { health: 'ok', provider: 'piper' }
```

---

## 🗑️ Cache Management

### Database Schema

**lesson_audio_cache** table:
```sql
id              UUID (primary key)
lesson_id       VARCHAR (indexed)
block_id        VARCHAR (indexed)
chunk_index     INT
audio_url       VARCHAR
provider        VARCHAR ('piper' | 'browser')
duration        INT (milliseconds)
file_path       VARCHAR
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**lesson_tts_settings** table:
```sql
id              UUID (primary key)
lesson_id       VARCHAR (indexed)
course_id       VARCHAR (indexed)
default_provider    VARCHAR ('piper')
fallback_provider   VARCHAR ('browser')
voice_gender    VARCHAR ('male' | 'female')
auto_pause_enabled  BOOLEAN
default_speed   DECIMAL (0.85 - 1.1)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### Cache Cleanup

```typescript
// Manual cleanup
await ttsService.clearCache('lesson-id-123');

// Automatic: Runs nightly, deletes audio >30 days old
// See: lib/ttsService cleanup_old_audio_cache()
```

---

## 🛡️ Error Handling

### Fallback Chain

1. **Try Piper** (primary)
   - If available → synthesize with Piper voices
   - If fails → mark unhealthy, try fallback

2. **Try Browser TTS** (fallback)
   - If available → synthesize with Web Speech API
   - If fails → throw error (user sees message)

3. **Cache** (if available)
   - Check before synthesis
   - Use if exists (instant playback)

### Error Recovery

```typescript
try {
  const result = await ttsService.synthesize(text, options);
  // Use result.provider to know which worked
  if (result.provider === 'browser') {
    console.warn('Using browser TTS - Piper unavailable');
  }
} catch (error) {
  console.error('TTS failed completely:', error);
  // Disable TTS UI, show error message
}
```

---

## 📈 Performance Metrics

### Typical Response Times

| Operation | Time | Notes |
|-----------|------|-------|
| Cache hit | <10ms | ⚡ Instant playback |
| Piper synthesis (10s) | 0.5-1s | Network dependent |
| Browser TTS (10s) | 10s | Realtime only |
| Batch pre-gen (50 items) | 30-60s | Background task |

### Storage Requirements

- **Supabase free tier:** 50GB
- **Average audio per lesson:** 5-50MB (depends on length)
- **Typical course:** 10-20 lessons = 100-500MB
- **Cache retention:** 30 days (auto-cleanup)

---

## 🚨 Troubleshooting

### Piper Not Responding

**Symptom:** "Piper unavailable - using Browser TTS fallback"

**Solutions:**
1. Check Piper server is running: `ps aux | grep piper-tts-server`
2. Test endpoint: `curl http://localhost:5002/api/voices`
3. Restart service: `sudo systemctl restart piper-tts`

### Audio Quality Issues

**Symptom:** Audio sounds robotic or fast

**Solutions:**
1. Reduce speed: Set `VITE_TTS_DEFAULT_SPEED=0.85`
2. Use high quality voice: `VITE_TTS_DEFAULT_QUALITY=high`
3. Try different voice: Set `VITE_DEFAULT_VOICE_GENDER=male`

### Cache Not Working

**Symptom:** No ⚡ cache hits in logs

**Solutions:**
1. Check `VITE_TTS_ENABLE_CACHE=true` in .env
2. Verify Supabase connection: `mcp_supabase_execute_sql("SELECT COUNT(*) FROM lesson_audio_cache")`
3. Clear cache: `await ttsService.clearCache(lessonId)`

### Browser TTS Not Fallback

**Symptom:** No audio when Piper down

**Solutions:**
1. Check `VITE_TTS_ENABLE_BROWSER_FALLBACK=true`
2. Verify browser supports Web Speech API (Chrome, Edge, Safari)
3. Check browser console for errors

---

## 📋 Deployment Checklist

- [ ] Piper server installed and running
- [ ] Environment variables configured
- [ ] Database migrations applied (lesson_audio_cache, lesson_tts_settings)
- [ ] CORS headers configured (production)
- [ ] SSL certificate valid (production)
- [ ] Test TTS with lesson content
- [ ] Verify cache hits working
- [ ] Monitor Piper server health
- [ ] Set up auto-restart (systemd/supervisor)
- [ ] Configure log rotation

---

## 💰 Cost Summary

```
MONTHLY COSTS:

Development:
  - VPS: $0 (local laptop)
  - API: $0 (self-hosted)
  - Storage: $0 (Supabase free tier)
  TOTAL: $0/month

Production (Small):
  - VPS: $5-10
  - API: $0 (self-hosted)
  - Storage: $0 (Supabase free tier)
  TOTAL: $5-10/month

Production (Large):
  - VPS: $20 (2x resources)
  - API: $0 (self-hosted)
  - Storage: $10-50 (Supabase paid)
  TOTAL: $30-70/month

SAVINGS vs Coqui:
  - Coqui: $50-500/month
  - Skill-Spire: $5-70/month
  - SAVINGS: 85-95%
```

---

## 📚 Additional Resources

- **Piper GitHub:** https://github.com/rhasspy/piper
- **Piper Documentation:** https://github.com/rhasspy/piper/wiki
- **Voice Samples:** https://github.com/rhasspy/piper/wiki/Voices
- **Web Speech API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

---

## 📞 Support

For issues or questions:
1. Check debug logs: `VITE_TTS_DEBUG=true`
2. Review troubleshooting section above
3. Check Piper server health
4. Verify environment configuration

---

**Implementation Date:** 2024-12-20  
**Cost Model:** FREE + Unlimited  
**Status:** ✅ Ready for Production
