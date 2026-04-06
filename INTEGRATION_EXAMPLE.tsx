/**
 * Example: Integrating Enhanced TTS into LessonPlayerPage
 * 
 * This file shows how to update the existing LessonPlayerPage to use
 * the new enhanced TTS service with caching and intelligent provider selection.
 */

// =====================================================================
// Step 1: Add imports at the top of LessonPlayerPage.tsx
// =====================================================================

// Add these imports alongside existing imports:
import EnhancedTextToSpeech, { EnhancedTextToSpeechRef } from '../components/EnhancedTextToSpeech';
import { useEnhancedTTS } from '../hooks/useEnhancedTTS';
import type { TTSProvider } from '../lib/ttsService';

// =====================================================================
// Step 2: Remove old TTS ref and add new ones in component
// =====================================================================

// OLD:
// const ttsRef = useRef<TextToSpeechRef>(null);

// NEW:
const enhancedTtsRef = useRef<EnhancedTextToSpeechRef>(null);
const [useLegacyTTS, setUseLegacyTTS] = useState(false); // Toggle between old and new

// Add TTS hook
const tts = useEnhancedTTS({
    lessonId: lessonId || '',
    courseId: courseId || '',
    contentType: 'lecture',
    autoCache: true,
    autoPreload: false,
});

// =====================================================================
// Step 3: Add TTS UI toggle (in the header or sidebar)
// =====================================================================

// Add this button to control TTS mode selection:
<div className="mb-4 p-3 bg-blue-50 rounded flex items-center gap-3">
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={!useLegacyTTS}
      onChange={(e) => setUseLegacyTTS(!e.target.checked)}
      className="w-4 h-4"
    />
    <span className="text-sm font-medium text-gray-700">
      {!useLegacyTTS ? '🚀 Enhanced TTS (Recommended)' : '📻 Legacy Browser TTS'}
    </span>
  </label>
  {tts.settings && (
    <span className="text-xs bg-white px-2 py-1 rounded">
      Provider: {tts.settings?.default_provider}
    </span>
  )}
</div>

// =====================================================================
// Step 4: Replace TextToSpeech component with EnhancedTextToSpeech
// =====================================================================

// OLD TTS component (hidden):
<div style={{ display: 'none' }}>
  <TextToSpeech
    ref={ttsRef}
    text={allTextContent}
    voiceGender={voiceGender}
    onSentenceChange={onSentenceChange}
  />
</div>

// NEW Enhanced TTS component (shown if useLegacyTTS is false):
{
    !useLegacyTTS && (
        <div className="mb-6 sticky top-0 z-40">
            <EnhancedTextToSpeech
                ref={enhancedTtsRef}
                text={allTextContent}
                blockId="lesson-content"
                lessonId={lessonId || 'unknown'}
                contentType="lecture"
                voiceGender={voiceGender}
                onSentenceChange={onSentenceChange}
                onPlayStateChange={setIsTTSPlaying}
                useCache={true}
            />
        </div>
    )
}

// =====================================================================
// Step 5: Update voice gender toggle to affect both TTS types
// =====================================================================

// Keep existing handleVoiceGenderChange but it now affects both:
const handleVoiceGenderChange = async () => {
    const newGender = voiceGender === 'female' ? 'male' : 'female';
    setVoiceGender(newGender);

    // Update tts settings too
    if (tts.settings) {
        await tts.updateSettings({ voice_gender: newGender });
    }
};

// =====================================================================
// Step 6: Add TTS control buttons to lesson header
// =====================================================================

// Update TTS mode toggle button to dispatch to appropriate ref:
const handleTTSToggle = () => {
    if (useLegacyTTS) {
        ttsRef.current?.togglePlayPause();
    } else {
        enhancedTtsRef.current?.togglePlayPause();
    }
};

// Add cache management UI (optional)
<button
    onClick={() => tts.clearCache()}
    disabled={tts.isLoading}
    className="text-sm px-2 py-1 bg-gray-300 rounded"
    title="Clear audio cache"
>
    {tts.isLoading ? 'Clearing...' : '🗑️ Clear Cache'}
</button>

// =====================================================================
// Step 7: Update playback controls to use correct ref
// =====================================================================

// Update play/pause button handler:
const handlePlayPause = () => {
    if (useLegacyTTS) {
        ttsRef.current?.togglePlayPause();
    } else {
        enhancedTtsRef.current?.togglePlayPause();
    }
    setIsTTSPlaying(!isTTSPlaying);
};

// Update stop button:
const handleStop = () => {
    if (useLegacyTTS) {
        ttsRef.current?.stop();
    } else {
        // EnhancedTextToSpeech has stop method
        enhancedTtsRef.current?.stop?.();
    }
    setIsTTSPlaying(false);
};

// =====================================================================
// Step 8: Add keyboard shortcuts for TTS (optional enhancement)
// =====================================================================

// Add to keyboard event handler:
useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
        // Ctrl+Shift+P: Play/Pause TTS
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
            e.preventDefault();
            handlePlayPause();
        }
        // Ctrl+Shift+S: Stop TTS
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
            e.preventDefault();
            handleStop();
        }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
}, [useLegacyTTS, isTTSPlaying]);

// =====================================================================
// Step 9: Add TTS statistics display (optional)
// =====================================================================

// Show TTS info in lesson sidebar:
<div className="text-xs text-gray-600 p-2 bg-blue-50 rounded mt-2">
  <div>📊 TTS Cache: {tts.cacheStats.totalEntries} entries</div>
  <div>⚡ Provider: {tts.settings?.default_provider}</div>
  <div>🎯 Content Type: lecture</div>
  {tts.error && <div className="text-red-600 mt-1">⚠️ {tts.error}</div>}
</div>

// =====================================================================
// Step 10: Example - Add preload for better UX
// =====================================================================

// Add preload button in lesson header:
<button
  onClick={async () => {
    const blockIds = tts.contentChunker.splitBySections(allTextContent)
      .map((_, i) => `section-${i}`);
    await audioStorageService.preloadLessonAudio(lessonId || '', blockIds);
  }}
  className="text-sm px-3 py-1 bg-green-500 text-white rounded"
>
  📥 Preload Audio
</button>

// =====================================================================
// Complete Example State Updates
// =====================================================================

// Ensure these state variables are still present:
const [isTTSPlaying, setIsTTSPlaying] = useState(false);
const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
const [useLegacyTTS, setUseLegacyTTS] = useState(false); // NEW

// =====================================================================
// Migration Path
// =====================================================================

/**
 * For gradual migration:
 *
 * Week 1: Keep both TTS systems, default to legacy
 * - Users can opt-in to "Enhanced TTS (Recommended)"
 * - Gather feedback and issues
 *
 * Week 2: Monitor usage
 * - Check cache hit rates
 * - Measure performance
 * - Fix any issues
 *
 * Week 3-4: Switch default
 * - Make Enhanced TTS the default
 * - Keep legacy as fallback option
 *
 * Week 5+: Deprecate legacy
 * - Remove legacy TTS component
 * - Full commitment to Enhanced TTS
 */

// =====================================================================
// Benefits of Enhanced TTS
// =====================================================================

/**
 * ✅ Better Quality
 *    - Coqui's natural speech for lectures
 *    - Piper's fast delivery for other content
 * 
 * ✅ Intelligent Caching
 *    - First-time wait: 2-5 seconds
 *    - Subsequent loads: <100ms
 * 
 * ✅ Content-Aware
 *    - Automatic section detection
 *    - Strategic pauses for comprehension
 *    - Key term extraction
 * 
 * ✅ Scalable
 *    - Piper for bulk content processing
 *    - Parallel synthesis possible
 *    - Low server footprint
 * 
 * ✅ Accessible
 *    - Resume from any point
 *    - Speed control (0.75x - 2x)
 *    - Multiple voice options
 * 
 * ✅ Analytics-Ready
 *    - Cache statistics
 *    - Provider selection tracking
 *    - Performance metrics
 */
