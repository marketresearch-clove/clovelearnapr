/**
 * Pre-generate TTS Audio for All Lessons
 * 
 * This script synthesizes TTS audio for entire courses upfront,
 * storing results in Supabase cache for instant playback.
 * 
 * Benefits:
 * - Zero TTS latency on first lesson load
 * - Guaranteed audio availability
 * - Batch processing during off-peak hours
 * - Free (uses self-hosted Piper)
 * 
 * Usage:
 *   npm run tts:pregen -- --course-id <id> [--dry-run]
 *   npm run tts:pregen -- --all-courses
 */

import { supabase } from './lib/supabaseClient';
import { ttsService } from './lib/ttsService';
import { contentChunker } from './lib/contentChunker';

interface PregenOptions {
    courseId?: string;
    allCourses?: boolean;
    dryRun?: boolean;
    force?: boolean;
    speedFactor?: number;
}

interface LessonToPregen {
    id: string;
    courseId: string;
    title: string;
    type: string;
    content: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): PregenOptions {
    const options: PregenOptions = {
        speedFactor: 1, // Process normally
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--course-id') {
            options.courseId = args[++i];
        } else if (arg === '--all-courses') {
            options.allCourses = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--force') {
            options.force = true;
        } else if (arg === '--speed-factor') {
            options.speedFactor = parseFloat(args[++i]) || 1;
        }
    }

    return options;
}

/**
 * Get lessons to pre-generate
 */
async function getLessonsToPregen(
    courseId?: string
): Promise<LessonToPregen[]> {
    console.log('📚 Fetching lessons...');

    let query = supabase
        .from('lessons')
        .select('id, course_id, title, type, content')
        .eq('is_locked', false)
        .neq('content', null);

    if (courseId) {
        query = query.eq('course_id', courseId);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch lessons: ${error.message}`);
    }

    // Filter to text-based lessons only
    const lessons = data.filter((l: any) => {
        return ['text', 'pdf', 'quiz', 'flashcard'].includes(l.type);
    });

    console.log(`✅ Found ${lessons.length} text-based lessons`);
    return lessons;
}

/**
 * Check existing cache entries
 */
async function checkCacheStatus(lessonId: string): Promise<number> {
    const { count, error } = await supabase
        .from('lesson_audio_cache')
        .select('*', { count: 'exact' })
        .eq('lesson_id', lessonId);

    if (error) {
        console.error(`Cache check error: ${error.message}`);
        return 0;
    }

    return count || 0;
}

/**
 * Pre-generate audio for a single lesson
 */
async function pregenLesson(
    lesson: LessonToPregen,
    options: PregenOptions
): Promise<{
    lessonId: string;
    chunksCreated: number;
    duration: number;
    cached: number;
    skipped: number;
    error?: string;
}> {
    try {
        console.log(
            `\n📖 Processing lesson: "${lesson.title}" (${lesson.type})`
        );

        // Parse content into chunks
        const chunks = contentChunker.chunkContent(lesson.content || '', {
            maxDuration: 30, // 30 seconds per chunk
            contentType: 'lecture',
        });

        console.log(`   Found ${chunks.length} text chunks`);

        // Check existing cache
        const cached = await checkCacheStatus(lesson.id);
        if (cached > 0 && !options.force) {
            console.log(`   ⚡ ${cached} chunks already cached, skipping`);
            return {
                lessonId: lesson.id,
                chunksCreated: 0,
                duration: 0,
                cached,
                skipped: chunks.length,
            };
        }

        // Synthesize each chunk
        let totalDuration = 0;
        let createdCount = 0;
        const errors: string[] = [];

        for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];

            try {
                if (options.dryRun) {
                    console.log(
                        `   [DRY RUN] Chunk ${idx + 1}: ${chunk.text.substring(0, 60)}...`
                    );
                    totalDuration += chunk.estimatedDuration || 10;
                } else {
                    // Synthesize with TTS service
                    const result = await ttsService.synthesize(chunk.text, {
                        contentType: 'lecture',
                        lessonId: lesson.id,
                        blockId: `chunk-${idx}`,
                        chunkIndex: idx,
                        useCache: true, // Auto-cache
                    });

                    totalDuration += result.duration;
                    createdCount++;

                    const provider =
                        result.provider === 'piper' ? '🎤' : '🎙️';
                    const duration = Math.round(result.duration / 1000);
                    console.log(
                        `   ${provider} Chunk ${idx + 1}/${chunks.length}: ${duration}s`
                    );
                }

                // Add delay for rate limiting
                if (options.speedFactor > 0) {
                    await sleep(100 / options.speedFactor);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                errors.push(`Chunk ${idx}: ${msg}`);
                console.error(`   ❌ Chunk ${idx} failed: ${msg}`);
            }
        }

        const result = {
            lessonId: lesson.id,
            chunksCreated: createdCount,
            duration: Math.round(totalDuration / 1000), // seconds
            cached: cached + createdCount,
            skipped: Math.max(0, chunks.length - createdCount - cached),
        };

        if (errors.length > 0) {
            result.error = errors.join('; ');
        }

        return result;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Lesson failed: ${msg}`);

        return {
            lessonId: lesson.id,
            chunksCreated: 0,
            duration: 0,
            cached: 0,
            skipped: 0,
            error: msg,
        };
    }
}

/**
 * Helper: sleep
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main pre-generation process
 */
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🎙️ TTS Audio Pre-generation System');
    console.log('='.repeat(60) + '\n');

    const args = process.argv.slice(2);
    const options = parseArgs(args);

    console.log('⚙️ Configuration:');
    console.log(`   Dry Run: ${options.dryRun ? 'YES' : 'no'}`);
    console.log(`   Course ID: ${options.courseId || 'ALL'}`);
    console.log(`   Force Regenerate: ${options.force ? 'yes' : 'no'}`);
    console.log('');

    const startTime = Date.now();

    try {
        // Get lessons to process
        const lessons = await getLessonsToPregen(options.courseId);

        if (lessons.length === 0) {
            console.log('⚠️ No lessons found to pre-generate');
            return;
        }

        // Process each lesson
        const results = [];
        for (let i = 0; i < lessons.length; i++) {
            const lesson = lessons[i];
            console.log(`\n[${i + 1}/${lessons.length}]`);

            const result = await pregenLesson(lesson, options);
            results.push(result);
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Summary');
        console.log('='.repeat(60));

        const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        const totalCached = results.reduce((sum, r) => sum + r.cached, 0);
        const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
        const totalErrors = results.filter((r) => r.error).length;

        console.log(`Lessons processed: ${results.length}`);
        console.log(`Audio chunks created: ${totalChunks}`);
        console.log(`Cache entries: ${totalCached}`);
        console.log(`Chunks skipped: ${totalSkipped}`);
        console.log(`Errors: ${totalErrors}`);
        console.log(`Total audio duration: ${totalDuration}s (${(totalDuration / 60).toFixed(1)} min)`);

        // Time taken
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`Time taken: ${elapsed.toFixed(1)}s`);

        if (!options.dryRun) {
            const rate = totalChunks > 0 ? (elapsed / totalChunks).toFixed(2) : 'N/A';
            console.log(`Rate: ${rate}s per chunk`);
        }

        // Show errors
        if (totalErrors > 0) {
            console.log('\n⚠️ Lessons with errors:');
            results
                .filter((r) => r.error)
                .forEach((r) => {
                    console.log(`   - ${r.lessonId}: ${r.error}`);
                });
        }

        console.log('\n' + '='.repeat(60));
        console.log(options.dryRun ? '✅ Dry run complete' : '✅ Pre-generation complete');
        console.log('='.repeat(60) + '\n');
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run
main().catch(console.error);
