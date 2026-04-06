**TTS Architecture Reference Card**

```
┌─────────────────────────────────────────────────────────────────┐
│                  LESSON PLAYER PAGE                             │
│                   (LessonPlayerPage.tsx)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    Uses Hook: useEnhancedTTS
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    Component          Services              Settings
    EnhancedTTS        Management            Management
    ┌────────────┐     ┌────────────┐        ┌───────────┐
    │ Playback   │     │ ttsService │        │ Settings  │
    │ Controls   │─────▶│ Cache      │────────▶│ Per Lesson│
    │ UI         │     │ Synthesis  │        │ Per Course│
    │ Progress   │     └────────────┘        └───────────┘
    │ Settings   │            │
    └────────────┘            │
         │              ┌──────┴─────────┐
         │              ▼                ▼
         │         PROVIDERS        STORAGE
         │     ┌──────────────┐   ┌──────────────┐
         │     │ Coqui TTS    │   │ Supabase     │
         │     │ (High Qual)  │   │ Storage      │
         │     ├──────────────┤   ├──────────────┤
         │     │ Piper TTS    │   │ Audio Cache  │
         │     │ (Fast)       │   │ Database     │
         │     ├──────────────┤   └──────────────┘
         │     │ Browser TTS  │
         │     │ (Fallback)   │
         │     └──────────────┘
         │
    Content Parsing
         │
         ▼
    ┌──────────────────┐
    │ contentChunker   │
    ├──────────────────┤
    │ • Parse HTML     │
    │ • Create Chunks  │
    │ • Add Pauses     │
    │ • Extract Terms  │
    └──────────────────┘
```

---

**DATA FLOW: First Request (Synthesis)**

```
User clicks Play
    │
    ▼
Check Cache
    │
    ├─ Cache Found? ─ YES ─▶ Play from cache (fast)
    │
    └─ NOT FOUND ─▶ Check Lesson Settings
                      │
                      ▼
               Select Provider
               (Based on contentType)
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     Lecture      Summary         Quiz
     (Coqui)      (Piper)        (Piper)
        │             │            │
        └─────┬───────┴────────────┘
              │
              ▼
       Synthesize Audio
       (2-5 seconds)
              │
              ▼
       Upload to Storage
       + Save Metadata
              │
              ▼
          Play Audio ✅
```

---

**DATA FLOW: Subsequent Requests (Cache Hit)**

```
User clicks Play
    │
    ▼
Check Cache
    │
    ├─ Cache Found? ─ YES ─▶ Retrieve from DB
                             │
                             ▼
                        Get Signed URL
                             │
                             ▼
                        Play from Storage
                        (<100ms total) ✅
    │
    └─ Backend: Return cached metadata
```

---

**CONTENT PARSING FLOW**

```
Raw HTML Content
    │
    ▼
Remove HTML Tags
    │
    ▼
Split into Chunks
┌──────────────────┐
│ • Headings       │ ──▶ Pause 2s after
│ • Paragraphs     │ ──▶ Pause 1s if complex
│ • List Items     │ ──▶ Pause 0.5s between
│ • Emphasis       │ ──▶ Mark for emphasis
└──────────────────┘
    │
    ▼
Group into Audio Chunks
(10-30 seconds each)
    │
    ▼
Generate for Each Chunk
┌──────────────────┐
│ TTS Synthesis    │ ──▶ Cache
│ Audio File       │ ──▶ Upload
│ Metadata         │ ──▶ Database
└──────────────────┘
```

---

**PROVIDER DECISION TREE**

```
Content Type?
│
├─ lecture ─────▶ Use Coqui (if available)
│                 Fallback: Piper
│                 Fallback: Browser
│
├─ summary ─────▶ Use Piper (fast)
│                 Fallback: Coqui
│                 Fallback: Browser
│
├─ quiz  ───────▶ Use Piper (fast)
│                 Fallback: Browser
│
└─ note  ───────▶ Use Piper (very fast)
                  Fallback: Browser
```

---

**DATABASE SCHEMA SUMMARY**

```
[lesson_audio_cache]
┌─────────────────────────────┐
│ id (PK)                     │
│ lesson_id (FK) ────┐        │
│ block_id           │ Unique │
│ chunk_index        │        │
├─────────────────────────────┤
│ audio_url (string)          │
│ provider (enum)             │
│ duration (seconds)          │
│ file_path (S3 path)         │
│ created_at (timestamp)      │
└─────────────────────────────┘


[lesson_tts_settings]
┌─────────────────────────────┐
│ id (PK)                     │
│ lesson_id (FK) ──┐ Unique   │
│ course_id  (FK) ─┘ Unique   │
├─────────────────────────────┤
│ default_provider (enum)     │
│ fallback_provider (enum)    │
│ lecture_quality (enum)      │
│ summary_quality (enum)      │
│ voice_gender (enum)         │
│ auto_pause_enabled (bool)   │
│ cache_audio (bool)          │
│ preload_audio (bool)        │
│ default_speed (decimal)     │
│ min_speed / max_speed       │
│ created_at, updated_at      │
└─────────────────────────────┘
```

---

**CACHING LIFECYCLE**

```
Day 0 (First Run)
├─ Audio generated
├─ Cached in database
└─ Stored in Supabase Storage

Days 1-29
├─ Cache hits every time
├─ <100ms retrieval
└─ Cost: ~$0.02 per month per lesson

Day 30
├─ Auto-cleanup triggered at 2 AM UTC
├─ Old entries (>30 days) deleted
└─ Storage freed for new content
```

---

**PERFORMANCE TIERS**

```
TIER 1: Development (Local)
├─ Browser TTS (no API needed)
├─ No storage required
├─ Response: 1-3 seconds
└─ Cost: FREE

TIER 2: Small LMS (<10k students)
├─ Piper locally (cheap to self-host)
├─ Supabase Storage
├─ Response: 1-2 seconds (Piper)
└─ Cost: ~$50/month

TIER 3: Medium LMS (10k-100k students)
├─ Piper on t3.medium EC2
├─ Supabase Storage
├─ Response: <500ms (cached)
└─ Cost: ~$100/month

TIER 4: Large LMS (100k+ students)
├─ Piper cluster (3+ instances)
├─ Piper with GPU (10x faster)
├─ Redis cache layer
├─ Response: <100ms (cached)
└─ Cost: ~$500-1000/month
```

---

**API ENDPOINTS QUICK REFERENCE**

```
POST /api/synthesize (Piper)
├─ text: string
├─ voice: string
├─ quality: 'high' | 'medium' | 'low'
└─ speed: 0.5 - 2.0

Response:
├─ audio: base64
├─ duration: seconds
└─ format: 'wav'


COQUI API
├─ Similar payload
├─ Better quality output
├─ ~3x slower than Piper
└─ Requires API key
```

---

**HOOK USAGE QUICK REFERENCE**

```typescript
// Initialize
const tts = useEnhancedTTS({
  lessonId: 'lesson-123',
  courseId: 'course-456',
  contentType: 'lecture',
  autoCache: true,
  autoPreload: false,
});

// Parse content
const parsed = tts.parseContent(htmlContent);
// Returns: chunks[], totalWordCount, totalEstimatedReadTime, summary

// Synthesize single text
const result = await tts.synthesizeAudio(text, blockId);
// Returns: audioUrl, provider, duration, cached

// Batch synthesize
const results = await tts.synthesizeBatch(textArray);

// Settings
await tts.updateSettings({ voice_gender: 'male' });
const recommended = tts.getRecommendedSettings('lecture');

// Cache
const stats = await tts.getCacheStats();
await tts.clearCache();

// Content utilities
const sections = tts.contentChunker.splitBySections(htmlContent);
const terms = tts.getKeyTerms(htmlContent);

// State
const { settings, isLoading, error, cacheStats } = tts;
```

---

**COMPONENT PROPS QUICK REFERENCE**

```typescript
<EnhancedTextToSpeech
  text={lessonContent}           // HTML content
  blockId="block-1"               // Unique block ID
  lessonId="lesson-123"           // Lesson ID
  contentType="lecture"           // 'lecture'|'summary'|'quiz'|'note'
  voiceGender="female"            // 'male'|'female'
  onSentenceChange={(idx, total) => {}} // Optional callback
  onPlayStateChange={(isPlaying) => {}} // Optional callback
  useCache={true}                 // Enable caching
/>
```

---

**ENVIRONMENT VARIABLES**

```env
# API Configuration
VITE_COQUI_API_URL=https://api.coqui.ai/v1/synthesize
VITE_COQUI_API_KEY=sk_live_...
VITE_PIPER_API_URL=http://localhost:5002

# Cache Settings
VITE_AUDIO_CACHE_ENABLED=true
VITE_AUDIO_CACHE_MAX_AGE_DAYS=30
VITE_AUDIO_PRELOAD_ENABLED=false

# TTS Defaults
VITE_DEFAULT_TTS_PROVIDER=coqui         # Falls back to piper
VITE_DEFAULT_VOICE_GENDER=female
VITE_DEFAULT_PLAYBACK_SPEED=1.0
```

---

**TROUBLESHOOTING DECISION TREE**

```
Audio not playing?
├─ Check browser console for errors
├─ Verify audio element exists
├─ Check CORS headers
└─ Try browser TTS fallback

Audio sounds robotic?
├─ Check provider (should be 'coqui' for lectures)
├─ Verify API key is set
├─ Check Coqui API availability
└─ Try higher quality setting

Cache not working?
├─ Check lesson_audio_cache table exists
├─ Verify Supabase Storage bucket
├─ Check RLS policies
└─ Try manual: audioStorageService.getCacheStats()

Slow on first play?
├─ Normal: 2-5 seconds for Coqui
├─ Normal: 1-2 seconds for Piper
├─ Use preload for critical content
└─ Check network speed
```

---

**DEPLOYMENT CHECKLIST**

```
Before Launch
□ Environment variables configured
□ Database migration applied
□ TTS API keys validated
□ Cache permissions verified
□ Piper server running (if self-hosted)
□ Load testing completed
□ Audio quality tested
□ Mobile playback tested

During Launch
□ Monitor cache hit rates
□ Watch for API errors
□ Check response times
□ Gather user feedback

Post Launch
□ Track cache growth
□ Monitor provider selection
□ Measure audio quality ratings
□ Scale Piper if needed
```

---

**FILES CREATED: VISUAL MAP**

```
skill-spire-lms/
├─ lib/
│  ├─ ttsService.ts ──────────────── Core orchestration
│  ├─ audioStorageService.ts ─────── Caching & storage
│  ├─ contentChunker.ts ──────────── Content parsing
│  └─ ttsSettingsService.ts ─────── Settings management
│
├─ components/
│  └─ EnhancedTextToSpeech.tsx ---- UI Component
│
├─ hooks/
│  └─ useEnhancedTTS.ts ─────────── Integration hook
│
├─ supabase/migrations/
│  └─ 20260402_create_tts_audio_cache.sql ──
│
├─ Docs/
│  ├─ TTS_INTEGRATION_GUIDE.md ◄─── Start here (detailed)
│  ├─ QUICK_START_TTS.md ◄────────── Start here (fast)
│  ├─ PIPER_DEPLOYMENT_GUIDE.md ◄─── Production
│  ├─ INTEGRATION_EXAMPLE.tsx ◄───── Code examples
│  ├─ TTS_IMPLEMENTATION_SUMMARY.md ◄ Overview
│  └─ .env.example.tts ◄──────────── Configuration

Total: 1,500+ lines code + 2,000+ lines docs
```

---

**TESTING COMMANDS**

```bash
# Test Piper locally
curl -X POST http://localhost:5002/api/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "voice": "en_US-amy-medium",
    "quality": "medium"
  }'

# Check cache stats
await audioStorageService.getCacheStats()

# Clear cache
await ttsService.clearCache('lesson-123')

# View debug logs
localStorage.setItem('debug', '*')
# Then refresh page
```

---

**SUCCESS METRICS**

```
✅ Cache Hit Rate: 50-80% (target)
✅ First Play: <5 seconds (target)
✅ Cached Play: <100ms (target)
✅ Audio Quality: MOS 4.0+ (target)
✅ User Satisfaction: 4.5/5 (target)
✅ Server Load: <20% CPU (target)
✅ Storage Used: <10GB per 1000 lessons (target)
```
