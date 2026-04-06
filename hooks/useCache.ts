/**
 * useCache Hook - Initializes localStorage caching on app startup
 * Provides easy access to cache operations and statistics
 */

import { useEffect, useState } from 'react';
import { cacheService } from '../lib/cacheService';

interface CacheStats {
    hits: number;
    misses: number;
    writes: number;
    clears: number;
    hitRate: string;
}

export const useCache = () => {
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [storageSize, setStorageSize] = useState<number>(0);

    // Initialize cache on app startup
    useEffect(() => {
        const initializeCache = () => {
            console.log('[CACHE HOOK] Initializing cache service...');

            // Initialize with custom config if needed
            cacheService.initialize({
                enabled: true, // Disable by setting to false
                defaultExpirationMs: 5 * 60 * 1000, // 5 minutes
                maxSize: 5, // 5MB max
            });

            // Log initial stats
            const initialStats = cacheService.getStats();
            setStats(initialStats as any);

            // Log storage size
            const size = cacheService.getStorageSize();
            setStorageSize(size);

            console.log('[CACHE HOOK] Cache initialized. Stats:', initialStats);
        };

        initializeCache();
    }, []);

    // Update stats periodically
    useEffect(() => {
        const interval = setInterval(() => {
            const currentStats = cacheService.getStats();
            setStats(currentStats as any);
            const size = cacheService.getStorageSize();
            setStorageSize(size);
        }, 30000); // Update every 30 seconds

        return () => clearInterval(interval);
    }, []);

    return {
        // Cache statistics
        stats,
        storageSize,

        // Cache operations
        get: <T>(key: string) => cacheService.get<T>(key),
        set: <T>(key: string, data: T, expirationMs?: number) => cacheService.set(key, data, expirationMs),
        remove: (key: string) => cacheService.remove(key),
        clearByPrefix: (prefix: string) => cacheService.clearByPrefix(prefix),
        clearAll: () => cacheService.clearAll(),
        clearExpired: () => cacheService.clearExpired(),
        getAllKeys: () => cacheService.getAllKeys(),

        // Utility methods
        logStats: () => console.log('[CACHE STATS]', cacheService.getStats()),
        logStorageSize: () => {
            const size = cacheService.getStorageSize();
            const sizeInMB = (size / 1024 / 1024).toFixed(2);
            console.log(`[CACHE SIZE] ${sizeInMB}MB (${size} bytes)`);
        },
    };
};
