/**
 * Cache Service - Manages localStorage caching with expiration times
 * Reduces API calls and improves initial load times for learners
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresIn: number; // milliseconds
}

interface CacheConfig {
    enabled: boolean;
    defaultExpirationMs: number;
    maxSize: number; // MB
}

class CacheService {
    private config: CacheConfig = {
        enabled: true,
        defaultExpirationMs: 5 * 60 * 1000, // 5 minutes default
        maxSize: 1, // 1MB per item max (much stricter)
    };

    private cacheStats = {
        hits: 0,
        misses: 0,
        writes: 0,
        clears: 0,
    };

    // Cache key prefixes for organization
    private keys = {
        USER_PROFILE: 'cache:user_profile:',
        USER_STATS: 'cache:user_stats:',
        ENROLLMENTS: 'cache:enrollments:',
        COURSES: 'cache:courses:',
        PUBLISHED_COURSES: 'cache:published_courses',
        CATEGORIES: 'cache:categories',
        LESSONS: 'cache:lessons:',
        QUIZZES: 'cache:quizzes:',
        SKILLS: 'cache:skills:',
        CERTIFICATES: 'cache:certificates:',
        SKILL_ACHIEVEMENTS: 'cache:skill_achievements:',
        LEARNING_HOURS: 'cache:learning_hours:',
        LESSON_PROGRESS: 'cache:lesson_progress:',
        COURSE_ASSIGNMENTS: 'cache:course_assignments:',
        LEARNING_JOURNEYS: 'cache:learning_journeys:',
        CAREER_PATHS: 'cache:career_paths:',
    };

    // Custom expiration times for different cache types
    private expirationTimes: Record<string, number> = {
        USER_PROFILE: 10 * 60 * 1000, // 10 minutes
        USER_STATS: 5 * 60 * 1000, // 5 minutes
        ENROLLMENTS: 2 * 60 * 1000, // 2 minutes (reduced - can be large)
        COURSES: 10 * 60 * 1000, // 10 minutes
        PUBLISHED_COURSES: 5 * 60 * 1000, // 5 minutes (reduced from 15 - gets too large)
        CATEGORIES: 30 * 60 * 1000, // 30 minutes
        LESSONS: 10 * 60 * 1000, // 10 minutes
        QUIZZES: 10 * 60 * 1000, // 10 minutes
        SKILLS: 15 * 60 * 1000, // 15 minutes
        CERTIFICATES: 5 * 60 * 1000, // 5 minutes
        SKILL_ACHIEVEMENTS: 5 * 60 * 1000, // 5 minutes
        LEARNING_HOURS: 5 * 60 * 1000, // 5 minutes
        LESSON_PROGRESS: 2 * 60 * 1000, // 2 minutes (frequently updated)
        COURSE_ASSIGNMENTS: 10 * 60 * 1000, // 10 minutes
        LEARNING_JOURNEYS: 15 * 60 * 1000, // 15 minutes
        CAREER_PATHS: 15 * 60 * 1000, // 15 minutes
    };

    /**
     * Initialize cache service (can be called on app startup)
     */
    initialize(customConfig?: Partial<CacheConfig>) {
        if (customConfig) {
            this.config = { ...this.config, ...customConfig };
        }
        console.log('[CACHE] Service initialized:', this.config);
    }

    /**
     * Check if browser supports localStorage
     */
    private isLocalStorageAvailable(): boolean {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch {
            console.warn('[CACHE] localStorage not available');
            return false;
        }
    }

    /**
     * Check if cache entry is expired
     */
    private isExpired<T>(entry: CacheEntry<T>): boolean {
        const age = Date.now() - entry.timestamp;
        return age > entry.expiresIn;
    }

    /**
     * Get item from cache
     */
    get<T>(key: string, defaultExpiration?: number): T | null {
        if (!this.config.enabled || !this.isLocalStorageAvailable()) {
            return null;
        }

        try {
            const stored = localStorage.getItem(key);
            if (!stored) {
                this.cacheStats.misses++;
                return null;
            }

            const entry: CacheEntry<T> = JSON.parse(stored);

            if (this.isExpired(entry)) {
                localStorage.removeItem(key);
                this.cacheStats.misses++;
                return null;
            }

            this.cacheStats.hits++;
            console.log(`[CACHE HIT] ${key}`);
            return entry.data;
        } catch (error) {
            console.error(`[CACHE ERROR] Failed to retrieve ${key}:`, error);
            return null;
        }
    }

    /**
     * Set item in cache with optional custom expiration
     */
    set<T>(key: string, data: T, customExpirationMs?: number): boolean {
        if (!this.config.enabled || !this.isLocalStorageAvailable()) {
            return false;
        }

        try {
            const expiresIn = customExpirationMs || this.config.defaultExpirationMs;
            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
                expiresIn,
            };

            const serialized = JSON.stringify(entry);

            // Check size before storing
            const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
            if (sizeInMB > this.config.maxSize) {
                console.warn(`[CACHE] Item too large (${sizeInMB.toFixed(2)}MB), clearing old cache...`);
                this.clearOldest();
                this.clearOldest(); // Clear twice for large items
            }

            localStorage.setItem(key, serialized);
            this.cacheStats.writes++;
            console.log(`[CACHE SET] ${key} (expires in ${expiresIn}ms)`);
            return true;
        } catch (error) {
            console.error(`[CACHE ERROR] Failed to set ${key}:`, error);
            // If quota exceeded, try clearing old entries
            if ((error as any)?.name === 'QuotaExceededError') {
                console.warn('[CACHE] Storage quota exceeded, clearing cache...');
                // Clear multiple times if quota is exceeded
                for (let attempt = 0; attempt < 3; attempt++) {
                    this.clearOldest();
                }

                try {
                    const expiresIn = customExpirationMs || this.config.defaultExpirationMs;
                    const entry: CacheEntry<T> = {
                        data,
                        timestamp: Date.now(),
                        expiresIn,
                    };
                    localStorage.setItem(key, JSON.stringify(entry));
                    console.log('[CACHE] Successfully stored after cleanup');
                    return true;
                } catch (retryError) {
                    console.error('[CACHE] Still unable to store after clearing cache:', retryError);
                    // Last resort: clear all cache and try once more
                    this.clearAll();
                    try {
                        const expiresIn = customExpirationMs || this.config.defaultExpirationMs;
                        const entry: CacheEntry<T> = {
                            data,
                            timestamp: Date.now(),
                            expiresIn,
                        };
                        localStorage.setItem(key, JSON.stringify(entry));
                        return true;
                    } catch {
                        console.error('[CACHE] Cannot store even after clearing all cache. Data may be too large.');
                        return false;
                    }
                }
            }
            return false;
        }
    }

    /**
     * Remove item from cache
     */
    remove(key: string): boolean {
        if (!this.isLocalStorageAvailable()) {
            return false;
        }
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`[CACHE ERROR] Failed to remove ${key}:`, error);
            return false;
        }
    }

    /**
     * Clear all cache entries for a specific prefix
     */
    clearByPrefix(prefix: string): number {
        if (!this.isLocalStorageAvailable()) {
            return 0;
        }

        let cleared = 0;
        try {
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(prefix)) {
                    keys.push(key);
                }
            }

            keys.forEach(key => {
                localStorage.removeItem(key);
                cleared++;
            });

            if (cleared > 0) {
                console.log(`[CACHE] Cleared ${cleared} entries for prefix: ${prefix}`);
            }
            return cleared;
        } catch (error) {
            console.error(`[CACHE ERROR] Failed to clear prefix ${prefix}:`, error);
            return 0;
        }
    }

    /**
     * Clear all cache entries
     */
    clearAll(): void {
        if (!this.isLocalStorageAvailable()) {
            return;
        }

        try {
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('cache:')) {
                    keys.push(key);
                }
            }

            keys.forEach(key => localStorage.removeItem(key));
            this.cacheStats.clears++;
            console.log(`[CACHE] Cleared all cache entries (${keys.length} items)`);
        } catch (error) {
            console.error('[CACHE ERROR] Failed to clear all cache:', error);
        }
    }

    /**
     * Clear expired cache entries
     */
    clearExpired(): number {
        if (!this.isLocalStorageAvailable()) {
            return 0;
        }

        let cleared = 0;
        try {
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('cache:')) {
                    keys.push(key);
                }
            }

            keys.forEach(key => {
                const stored = localStorage.getItem(key);
                if (stored) {
                    try {
                        const entry = JSON.parse(stored);
                        if (this.isExpired(entry)) {
                            localStorage.removeItem(key);
                            cleared++;
                        }
                    } catch {
                        // Invalid entry, remove it
                        localStorage.removeItem(key);
                        cleared++;
                    }
                }
            });

            if (cleared > 0) {
                console.log(`[CACHE] Cleared ${cleared} expired entries`);
            }
            return cleared;
        } catch (error) {
            console.error('[CACHE ERROR] Failed to clear expired:', error);
            return 0;
        }
    }

    /**
     * Clear oldest entries when storage is full
     */
    private clearOldest(): void {
        if (!this.isLocalStorageAvailable()) {
            return;
        }

        try {
            const entries: Array<{ key: string; timestamp: number; size: number }> = [];

            // Collect all cache entries with their metadata
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('cache:')) {
                    keys.push(key);
                }
            }

            // Now process the collected keys
            for (const key of keys) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    try {
                        const entry = JSON.parse(stored);
                        entries.push({
                            key,
                            timestamp: entry.timestamp,
                            size: stored.length,
                        });
                    } catch {
                        // Skip invalid entries, but still remove them
                        localStorage.removeItem(key);
                    }
                }
            }

            // Sort by timestamp (oldest first) and remove oldest 20% or at least 3 items
            entries.sort((a, b) => a.timestamp - b.timestamp);
            const toRemove = Math.max(3, Math.floor(entries.length * 0.2));

            let freedSpace = 0;
            for (let i = 0; i < toRemove && i < entries.length; i++) {
                localStorage.removeItem(entries[i].key);
                freedSpace += entries[i].size;
            }

            console.log(
                `[CACHE] Removed ${Math.min(toRemove, entries.length)} oldest entries (freed ${(freedSpace / 1024).toFixed(2)}KB)`
            );
        } catch (error) {
            console.error('[CACHE ERROR] Failed to clear oldest:', error);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate =
            this.cacheStats.hits + this.cacheStats.misses > 0
                ? (
                    (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) *
                    100
                ).toFixed(2)
                : '0.00';

        return {
            ...this.cacheStats,
            hitRate: `${hitRate}%`,
        };
    }

    /**
     * Get all cache keys
     */
    getAllKeys(): string[] {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('cache:')) {
                keys.push(key);
            }
        }
        return keys;
    }

    /**
     * Get cache storage size in bytes
     */
    getStorageSize(): number {
        if (!this.isLocalStorageAvailable()) {
            return 0;
        }

        let size = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('cache:')) {
                    const value = localStorage.getItem(key);
                    if (value) {
                        size += value.length + key.length;
                    }
                }
            }
        } catch (error) {
            console.error('[CACHE ERROR] Failed to calculate size:', error);
        }
        return size;
    }
};

// Export singleton instance
export const cacheService = new CacheService();
