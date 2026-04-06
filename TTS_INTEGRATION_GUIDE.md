# TTS Integration Guide for Skill-Spire LMS

## Overview

This document describes the hybrid TTS (Text-to-Speech) integration for the Skill-Spire LMS, combining Coqui TTS for high-quality lectures and Piper TTS for scalable content delivery.

## Architecture

### Components

1. **ttsService.ts** - Main TTS orchestration layer
   - Intelligent provider selection based on content type
   - Automatic fallback mechanism
   - Support for Coqui (high quality), Piper (scalable), and Browser (fallback) providers

2. **audioStorageService.ts** - Audio caching and storage
   - Supabase Storage integration for persistent audio files
   - Local in-memory cache for performance
   - Automatic cache cleanup (30-day retention)

3. **contentChunker.ts** - Content parsing and chunking
   - Intelligent paragraph/section detection
   - Automatic pause insertion for better comprehension
   - Key term extraction
   - Audio chunk creation with timing

4. **ttsSettingsService.ts** - Configuration management
   - Course-level and lesson-level settings
   - Provider and quality preferences
   - Voice gender and speed controls
   - Settings validation

5. **EnhancedTextToSpeech.tsx** - React component
   - Modern UI with playback controls
   - Chunk-based playback with progress tracking
   - Settings panel for volume, speed, provider selection
   - Provider badge display

6. **useEnhancedTTS.ts** - React hook
   - Easy integration in components
   - Settings management
   - Cache control
   - Content parsing utilities

## Setup Instructions

### 1. Environment Configuration

Copy `.env.example.tts` to `.env.local` and configure:

```env
# Coqui TTS (recommended for lectures)
VITE_COQUI_API_URL=https://api.coqui.ai/v1/synthesize
VITE_COQUI_API_KEY=your_api_key

# Piper TTS (for scalability - can be self-hosted)
VITE_PIPER_API_URL=http://localhost:5002

# Cache settings
VITE_AUDIO_CACHE_ENABLED=true
VITE_AUDIO_CACHE_MAX_AGE_DAYS=30
```

### 2. Database Migration

Apply the migration to create required tables:

```bash
# Run the migration
supabase migration up 20260402_create_tts_audio_cache
```

This creates:
- `lesson_audio_cache` - Store generated audio metadata and files
- `lesson_tts_settings` - Store TTS preferences per course/lesson

### 3. Piper TTS Setup (Optional but Recommended)

For production, deployment, self-host Piper TTS for better performance:

```bash
# Docker deployment
docker run -d \
  -p 5002:5002 \
  -e PIPER_PORT=5002 \
  piper-tts:latest

# Or use pip
pip install piper-tts
piper-tts --port 5002
```

## Usage Examples

### Basic Integration in Lesson Component

```tsx
import { useEnhancedTTS } from '../hooks/useEnhancedTTS';
import EnhancedTextToSpeech from '../components/EnhancedTextToSpeech';

function LessonContent() {
  const tts = useEnhancedTTS({
    lessonId: 'lesson-123',
    courseId: 'course-456',
    contentType: 'lecture',
    autoCache: true,
    autoPreload: false,
  });

  if (tts.error) {
    return <div className="text-red-600">{tts.error}</div>;
  }

  return (
    <div>
      {/* Use the enhanced component */}
      <EnhancedTextToSpeech
        text={lessonContent}
        blockId="content-block-1"
        lessonId="lesson-123"
        contentType="lecture"
      />

      {/* Or use the hook for custom integration */}
      <button onClick={() => tts.synthesizeAudio(text, 'my-block')}>
        Generate Audio
      </button>

      {/* Cache info */}
      <div>
        Cache entries: {tts.cacheStats.totalEntries}
      </div>
    </div>
  );
}
```

### Advanced: Batch Processing Lessons

```tsx
async function prepareLessonAudio() {
  const tts = useEnhancedTTS({
    lessonId: 'lesson-123',
    courseId: 'course-456',
  });

  // Parse content into sections
  const sections = tts.contentChunker.splitBySections(lessonText);

  // Batch synthesize all sections
  const results = await tts.synthesizeBatch(
    sections.map((section, i) => ({
      text: section.content,
      blockId: `section-${i}`,
      chunkIndex: 0,
    }))
  );

  console.log(`Generated ${results.length} audio files`);
}
```

### Custom TTS Provider Configuration

```tsx
// In your course settings
const customSettings = {
  default_provider: 'coqui',
  fallback_provider: 'piper',
  lecture_quality: 'high',
  summary_quality: 'medium',
  voice_gender: 'male',
  auto_pause_enabled: true,
  cache_audio: true,
};

await ttsSettingsService.saveCourseSettings(customSettings);
```

## Content Type Strategy

### 🎓 Lectures (Use Coqui)
- **Provider**: Coqui (high naturalness)
- **Quality**: High
- **Features**: Auto-pause enabled, pauses after heading/concepts
- **Use case**: Main course content, explanations, concept teaching

```tsx
<EnhancedTextToSpeech
  text={lectureContent}
  contentType="lecture"
  blockId="lecture-1"
  lessonId={lessonId}
/>
```

### ⚡ Summaries (Use Piper)
- **Provider**: Piper (fast, scalable)
- **Quality**: Medium
- **Features**: No auto-pause, quick playback
- **Use case**: Quick reviews, chapter summaries

### 📝 Quizzes (Use Piper)
- **Provider**: Piper
- **Quality**: Medium
- **Features**: Fast delivery, clear pronunciation
- **Use case**: Quiz questions, answer options

### 📌 Notes (Use Piper)
- **Provider**: Piper
- **Quality**: Low (fast)
- **Features**: Minimal overhead
- **Use case**: Additional notes, supplementary material

## Caching Strategy

### How Caching Works

1. **First Generation**: Content is synthesized with selected provider
2. **Storage**: Audio is uploaded to Supabase Storage (persistent)
3. **Database**: Metadata stored in `lesson_audio_cache`
4. **Retrieval**: Cache is checked before generating new audio

### Cache Lifecycle

- **Maximum Age**: 30 days (configurable)
- **Automatic Cleanup**: Runs daily at 2 AM UTC
- **Manual Cleanup**: `audioStorageService.clearLessonAudio(lessonId)`

### Cache Statistics

```tsx
const tts = useEnhancedTTS({ lessonId, courseId });

console.log(`Total cached: ${tts.cacheStats.totalEntries} entries`);

// Clear cache if needed
await tts.clearCache();
```

## Content Chunking

The `contentChunker` automatically:

1. **Parses HTML** - Extracts text from HTML content blocks
2. **Creates Chunks** - Breaks into logical units (paragraphs, lists)
3. **Adds Pauses** - Inserts strategic pauses after:
   - Headings (2 seconds)
   - Complex paragraphs (1 second)
   - List items (0.5 seconds)
4. **Groups for TTS** - Creates 10-30 second audio chunks
5. **Estimates Timing** - Calculates playback duration

### Example: Parsing Content

```tsx
const tts = useEnhancedTTS({ lessonId, courseId });

const parsed = tts.parseContent(htmlContent);
console.log(`Total words: ${parsed.totalWordCount}`);
console.log(`Read time: ${parsed.totalEstimatedReadTime}s`);
console.log(`Summary: ${parsed.summary}`);

// Get key terms for emphasis
const keyTerms = tts.getKeyTerms(htmlContent);
```

## Performance Optimization

### Key Optimization Points

1. **Provider Selection**
   - Coqui: Best quality (takes longer for generation)
   - Piper: Fast and scalable (sufficient quality)
   - Hybrid: Use Coqui for main content, Piper for bulk

2. **Caching**
   - Audio cached for 30 days
   - Local in-memory cache for session
   - One-time generation per content block

3. **Chunking**
   - Content split into 10-30 second chunks
   - Parallel generation possible
   - Better UX with resume capability

4. **Preloading** (Optional)
   - Enable for courses where TTS is critical
   - Preloads audio in background
   - Costs more upfront but smooth playback

### Estimated Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Parse content | <100ms | Once per lesson |
| Generate audio (Coqui) | 2-5s per chunk | First time, then cached |
| Retrieve cached audio | <50ms | Subsequent loads |
| Batch process (10 chunks) | 10-20s | Piper with parallel |

## Monitoring and Debugging

### Enable Debug Logging

```tsx
// In browser console
localStorage.setItem('debug', '*');
// Then refresh page
```

Logs will appear with `[TTS]`, `[AudioStorage]`, `[TTS]` prefixes.

### Common Issues

#### "Coqui API key not configured"
- Set `VITE_COQUI_API_KEY` in `.env.local`
- If not set, automatically falls back to Piper

#### "Piper API error"
- Ensure Piper service is running on configured URL
- Check `VITE_PIPER_API_URL`
- If down, falls back to browser TTS

#### Audio not playing
- Check browser console for errors
- Verify audio element has crossOrigin="anonymous"
- Test in different browser (Safari has different audio policies)

#### Cache not working
- Verify `lesson_audio_cache` table exists
- Check Supabase Storage bucket permissions
- Run: `audioStorageService.getCacheStats()`

## API Reference

### ttsService

```tsx
// Synthesize single audio
const result = await ttsService.synthesize(text, {
  contentType: 'lecture',
  lessonId: 'lesson-123',
  blockId: 'block-1',
  useCache: true,
});

// Batch process
const results = await ttsService.synthesizeMultiple(texts, lessonId);

// Clear cache
await ttsService.clearCache(lessonId);

// Get provider for content type
const provider = ttsService.getRecommendedProvider('lecture');
```

### audioStorageService

```tsx
// Get cached audio
const cached = await audioStorageService.getAudio(lessonId, blockId, chunkIndex);

// Save audio
await audioStorageService.saveAudio(lessonId, blockId, chunkIndex, result);

// Clear lesson cache
await audioStorageService.clearLessonAudio(lessonId);

// Get stats
const stats = await audioStorageService.getCacheStats();

// Preload
const loaded = await audioStorageService.preloadLessonAudio(lessonId, blockIds);
```

### ttsSettingsService

```tsx
// Get/save settings
const settings = await ttsSettingsService.getLessonSettings(lessonId);
await ttsSettingsService.saveLessonSettings(settings);

// Get merged settings (lesson overrides course)
const merged = await ttsSettingsService.getMergedSettings(lessonId, courseId);

// Validate
const errors = ttsSettingsService.validateSettings(settings);

// Get recommendations
const recommended = ttsSettingsService.getRecommendedSettings('lecture');
```

### contentChunker

```tsx
// Parse content
const parsed = contentChunker.parse(htmlContent);

// Split by sections
const sections = contentChunker.splitBySections(htmlContent);

// Extract key terms
const terms = contentChunker.extractKeyTerms(htmlContent);

// Create audio chunks
const audioChunks = contentChunker.createAudioChunks(parsedChunks);
```

## Migration and Rollout

### Phase 1: Setup (Week 1)
- [ ] Configure environment variables
- [ ] Apply database migration
- [ ] Setup Piper TTS server (optional)
- [ ] Test with single course

### Phase 2: Integration (Week 2)
- [ ] Add EnhancedTextToSpeech to lesson player
- [ ] Test playback and caching
- [ ] Gather user feedback
- [ ] Monitor cache growth

### Phase 3: Rollout (Week 3)
- [ ] Enable for all courses
- [ ] Update course settings
- [ ] Train instructors on TTS options
- [ ] Monitor performance

### Phase 4: Optimization (Week 4)
- [ ] Analyze cache hit rates
- [ ] Optimize provider selection
- [ ] Fine-tune pause timing
- [ ] Scale Piper if needed

## Troubleshooting Guide

### Logs to Check

```tsx
// In browser DevTools Console
// Filter by [TTS] to see TTS-specific logs
// Check timing and provider selection
```

### Performance Benchmarks

Expected performance metrics:
- Cache hit: 50-80% for repeated content
- Coqui generation: 2-3s per 2-3 minute lecture
- Piper generation: 1-2s per 2-3 minute lecture
- Total wait (first time): < 10 seconds

## Roadmap

### Future Enhancements
- [ ] Multi-language support
- [ ] Voice cloning for personalized lessons
- [ ] Real-time transcription
- [ ] Student voice preference sync across courses
- [ ] Analytics on audio engagement
- [ ] Offline mode with pre-cached audio
- [ ] Custom voice profiles per instructor

## Support and Questions

For issues or questions:
1. Check `/lib` services for implementation details
2. Review component props and interfaces
3. Check debug logs in browser console
4. Verify environment configuration
