# TTS Web App Testing Guide

## 🎯 Quick Start - Test Piper TTS in Your Application

This guide walks you through testing the FREE + UNLIMITED Piper TTS system in the Skill-Spire LMS web application.

---

## ✅ Prerequisites

- ✅ Node.js and npm installed
- ✅ Python 3.8+ installed
- ✅ Workspace: `skill-spire-lms` fully cloned
- ✅ `.env` configured with:
  ```bash
  VITE_PIPER_API_URL=http://localhost:5002
  VITE_DEFAULT_VOICE_GENDER=female
  VITE_TTS_ENABLE_CACHE=true
  ```

---

## 🚀 Step 1: Start Piper Server (Local)

### Windows

#### Option A: Use PowerShell Setup Script
```powershell
cd scripts
.\setup-piper-local.ps1
# Follow instructions, then run the startup script
.\piper-tts.ps1
```

#### Option B: Manual Commands
```powershell
# Install Piper
python -m pip install --upgrade pip
python -m pip install piper-tts flask flask-cors

# Start server
python -m piper.server --host 0.0.0.0 --port 5002
```

### macOS/Linux

```bash
# Install
pip3 install piper-tts flask flask-cors

# Start (with CORS support)
bash scripts/setup-piper-local.sh

# Or directly
piper-tts-server --host 0.0.0.0 --port 5002
```

**Expected Output:**
```
✅ Listening at http://0.0.0.0:5002
🌐 CORS enabled for all origins
```

### Verify Piper is Running

```bash
# Test health endpoint
curl http://localhost:5002/health

# Should return:
# {"status": "healthy", "service": "piper-cors-wrapper"}
```

---

## 🎙️ Step 2: Check Available Voices

```bash
# List voices
curl http://localhost:5002/api/voices

# Shows:
# {
#   "voices": [
#     "en_US-lessac-high",
#     "en_US-amy-medium",
#     "en_US-ryan-high",
#     ...
#   ]
# }
```

---

## 🧪 Step 3: Test TTS Synthesis

### Test via cURL

```bash
# Test basic synthesis
curl -X POST http://localhost:5002/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is Piper text to speech",
    "speaker": "en_US-lessac-high",
    "lengthScale": 0.9
  }' \
  --output test-audio.wav

# Should create test-audio.wav file
ls -lh test-audio.wav
```

### Test via JavaScript

```javascript
// Open browser console on any page and run:
async function testPiper() {
  const response = await fetch('http://localhost:5002/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: "Testing Piper from the browser",
      speaker: "en_US-lessac-high",
      lengthScale: 0.9
    })
  });

  const audioBlob = await response.blob();
  const url = URL.createObjectURL(audioBlob);
  const audio = new Audio(url);
  audio.play();
  console.log("✅ Audio playing!");
}

testPiper();
```

---

## 📱 Step 4: Start Web Application

### Terminal 1: Piper Server (Keep Running)
```bash
python -m piper.server --host 0.0.0.0 --port 5002
```

### Terminal 2: Development Server
```bash
cd skill-spire-lms
npm install
npm run dev
```

**Expected:**
```
  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## 🎓 Step 5: Test TTS in Lesson Player

### Navigate to Lesson

1. **Open browser:** `http://localhost:5173`
2. **Login** with test credentials
3. **Browse to a course** with lessons
4. **Select a lesson** with text content (not video)
5. **Look for TTS controls** at the top of lesson content

### Test Controls

#### Play/Pause Button
- Click 🎙️ **Play** button
- Should see: `[TTS:FREE] 🎙️ Synthesizing lecture (quality: high, speed: 0.9x)`
- Audio should play
- Click **Pause** to stop

#### Speed Control
- Adjust speed slider (0.85x - 1.1x)
- Slower = clearer, Faster = quicker
- Default 0.9x = natural teaching pace

#### Voice Gender
- Toggle between **Female** and **Male**
- Female: calm, professional (lessac-high)
- Male: authoritative (ryan-high)

#### Provider Display
- Should show **🎤 Piper** (green = success)
- If offline: **🎙️ Browser** (fallback)

### Check Console Logs

Open **Developer Console** (F12) and filter for `TTS`:

```
[TTS:FREE] ✅ Initialized with Piper at http://localhost:5002
[TTS:FREE] 🎤 Default voice: female
[TTS:FREE] 🎙️ Synthesizing lecture (quality: high, speed: 0.9x)
[TTS:PIPER] 🎤 Using lessac-high at 0.9x speed
[TTS:PIPER] ✅ Success (18s, lessac-high)
```

✅ **Success!** Audio is working with Piper

---

## 💾 Step 6: Test Caching

After first synthesis:

1. **Play the same content again**
2. **Check console** for cache hit:
   ```
   [TTS:FREE] ⚡ CACHE HIT: lesson-content
   ```
3. **Playback should be instant** (no network delay)

---

## 🔴 Step 7: Test Fallback (Browser TTS)

### Simulate Piper Offline

1. **Stop Piper server** (Ctrl+C in terminal)
2. **Try playing audio** in lesson player
3. **Console should show:**
   ```
   [TTS:FREE] ⚠️ Piper unavailable - using Browser TTS fallback
   [TTS:BROWSER] 🎤 Using Browser TTS (Microsoft Zira Deskto)
   [TTS:BROWSER] ✅ Playback complete (15s)
   ```
4. **Audio should still play** (browser fallback working!)
5. **Restart Piper** for full performance

---

## 🐛 Troubleshooting

### "CORS error" or "Failed to fetch from localhost:5002"

**Cause:** Piper server not running or CORS not enabled

**Solution:**
```bash
# Kill any existing piper processes
pkill -f piper-tts

# Start with explicit CORS
python -m piper.server --host 0.0.0.0 --port 5002
```

### Audio plays but sounds robotic

**Cause:** Speed too slow or voice model issue

**Solution:**
- Try increasing speed (1.0x instead of 0.9x)
- Try different voice (ryan-high for male)
- Check Piper is using correct voice:
  ```bash
  curl http://localhost:5002/api/voices
  # Verify "en_US-lessac-high" is listed
  ```

### No TTS controls visible in lesson

**Cause:** Component not integrated or wrong lesson type

**Solution:**
- Check lesson type is **not "video"** (text, pdf, quiz only)
- Verify import in LessonPlayerPage.tsx:
  ```typescript
  import EnhancedTextToSpeech from '../components/EnhancedTextToSpeech';
  ```
- Check console for errors (F12)

### "Text too long" error

**Cause:** Lesson content >5000 characters

**Solution:**
- System auto-chunks content (contentChunker.ts)
- Should work automatically
- If not, check error logs

### Cache not working (no ⚡ symbol)

**Cause:** Cache disabled or Supabase not connected

**Solution:**
- Check `.env`: `VITE_TTS_ENABLE_CACHE=true`
- Verify Supabase connection: See IMPLEMENTATION_SUMMARY.md
- Clear browser cache (Ctrl+Shift+Delete)

---

## 🎯 Quick Test Script

Save as `test-tts.js` and run in browser console:

```javascript
/**
 * Quick TTS Test Script
 * Run in browser console to test all TTS features
 */

console.log("🎤 Starting TTS System Test...\n");

async function testTTSSystem() {
  const tests = [];

  // Test 1: Piper availability
  console.log("📡 Test 1: Checking Piper server...");
  try {
    const response = await fetch('http://localhost:5002/health');
    const data = await response.json();
    if (response.ok) {
      console.log("✅ Piper is available\n");
      tests.push(true);
    }
  } catch (e) {
    console.warn("⚠️ Piper unavailable (will use Browser TTS)\n");
    tests.push(false);
  }

  // Test 2: Voice listing
  console.log("🎵 Test 2: Checking available voices...");
  try {
    const response = await fetch('http://localhost:5002/api/voices');
    const data = await response.json();
    console.log(`Found ${data.voices.length} voices:`);
    data.voices.forEach(v => console.log(`  - ${v}`));
    console.log("");
    tests.push(true);
  } catch (e) {
    console.warn("⚠️ Could not list voices\n");
    tests.push(false);
  }

  // Test 3: Synthesis
  console.log("🔊 Test 3: Synthesizing audio...");
  try {
    const response = await fetch('http://localhost:5002/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: "Testing Piper text to speech synthesis",
        speaker: "en_US-lessac-high",
        lengthScale: 0.9
      })
    });

    if (response.ok) {
      const blob = await response.blob();
      console.log(`✅ Generated ${(blob.size / 1024).toFixed(1)} KB audio`);
      
      // Auto-play
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      console.log("▶️ Playing audio...\n");
      tests.push(true);
    } else {
      console.error(`❌ Synthesis failed: ${response.status}`);
      tests.push(false);
    }
  } catch (e) {
    console.error(`❌ Error: ${e.message}\n`);
    tests.push(false);
  }

  // Summary
  console.log("📊 Test Results:");
  console.log(`Passed: ${tests.filter(t => t).length}/${tests.length}`);
  if (tests.every(t => t)) {
    console.log("✅ All tests passed! TTS is ready.");
  } else {
    console.warn("⚠️ Some tests failed. Check configuration.");
  }
}

testTTSSystem();
```

---

## ✅ Testing Checklist

- [ ] Piper server running at localhost:5002
- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] Can list voices (at least 3 available)
- [ ] Basic synthesis works (produces audio)
- [ ] Audio plays in browser
- [ ] Dev server running at localhost:5173
- [ ] Can navigate to lesson player
- [ ] TTS controls visible in lesson
- [ ] Play button works
- [ ] Speed control adjusts playback
- [ ] Voice gender toggle works
- [ ] Provider shows "🎤 Piper" or "🎙️ Browser"
- [ ] Console shows `[TTS:*]` logs
- [ ] Cache hit shows ⚡ symbol
- [ ] Stopping Piper triggers Browser fallback

---

## 🎬 Next Steps

1. ✅ **Local testing complete** - Piper working in web app
2. **Create test data** - Add lessons with TTS content
3. **Pre-generate audio** - Run batch synthesis for courses
4. **Performance testing** - Measure load times, cache hits
5. **Prepare VPS deployment** - See DEPLOYMENT_CHECKLIST.md

---

## 📚 Resources

- **Piper GitHub:** https://github.com/rhasspy/piper
- **Web Speech API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- **CORS Troubleshooting:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Implementation Guide:** See FREE_UNLIMITED_TTS_GUIDE.md

---

**Last Updated:** April 2, 2026  
**Status:** ✅ Testing Guide Complete
