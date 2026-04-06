# LocalStorage Caching System - Implementation Guide

## Overview

A comprehensive caching system has been implemented to reduce API calls and improve page load times for learners. The system automatically caches frequently accessed data like courses, enrollments, and user statistics with intelligent cache expiration and invalidation.

## Architecture

### Core Components

#### 1. **cacheService.ts** (`lib/cacheService.ts`)
Main caching service that manages all localStorage operations with:
- Automatic expiration handling
- Cache size management
- Hit/miss statistics tracking
- Prefix-based cache clearing
- Storage overflow handling

#### 2. **useCache.ts** (React Hook)
React hook for component-level cache initialization and statistics.

### Integrated Services

The following services now use caching:

#### **enrollmentService.ts**
- `getUserEnrollments(userId)` - Cached for 3 minutes
- `getEnrollment(userId, courseId)` - Cached for 3 minutes
- Cache invalidated on: `enrollCourse()`, `completeCourse()`

#### **courseService.ts**
- `getPublishedCourses()` - Cached for 15 minutes
- `getCourseById(id)` - Cached for 10 minutes
- Cache invalidated on: `updateCourse()`

#### **userStatisticsService.ts**
- `getUserStatistics(userId)` - Cached for 5 minutes
- Cache invalidated on all stat updates:
  - `updateLearningHours()`
  - `incrementCoursesCompleted()`
  - `decrementCoursesCompleted()`
  - `updateCoursesEnrolled()`
  - `updatePoints()`
  - `updateCurrentStreak()`

## Cache Expiration Times

| Data Type | Expiration | Reason |
|-----------|-----------|---------|
| User Profile | 10 min | User info rarely changes |
| User Statistics | 5 min | Updated frequently |
| Enrollments | 3 min | Very active, changes often |
| Courses | 15 min | Static content, rarely updated |
| Published Courses | 15 min | Admin controlled |
| Categories | 30 min | Rarely change |
| Lessons | 10 min | Course content updates |
| Quizzes | 10 min | Course content updates |
| Skills | 15 min | Course content updates |
| Certificates | 5 min | Issued upon completion |
| Skill Achievements | 5 min | Frequently awarded |
| Learning Hours | 5 min | Real-time tracking |
| Lesson Progress | 2 min | Frequently updated |

## Setup & Usage

### Initialize on App Startup

```typescript
// In your App.tsx or main.tsx
import { useCache } from './hooks/useCache';

function App() {
  const cache = useCache(); // Initializes cache automatically

  return (
    // Your app routes...
  );
}
```

### Access Cache in Components

```typescript
import { useCache } from '../hooks/useCache';

export function MyComponent() {
  const cache = useCache();

  // View cache statistics
  useEffect(() => {
    if (cache.stats) {
      console.log('Cache hit rate:', cache.stats.hitRate);
      console.log('Storage used:', cache.storageSize, 'bytes');
    }
  }, [cache.stats]);

  // Manually clear cache for specific prefix
  const handleClearEnrollmentCache = () => {
    cache.clearByPrefix('cache:enrollments:');
  };

  return (
    <div>
      <p>Cache Hit Rate: {cache.stats?.hitRate}</p>
      <button onClick={handleClearEnrollmentCache}>
        Clear Enrollments Cache
      </button>
    </div>
  );
}
```

### Direct Service Usage

Services automatically use cache. No changes needed to existing code:

```typescript
// This automatically uses cache if available
const courses = await courseService.getPublishedCourses();

// Cache is automatically invalidated when updating
await courseService.updateCourse(courseId, { certificate_enabled: false });
```

## Cache Key Naming

All cache keys follow a consistent naming pattern:

```
cache:<data_type>:<optional_identifier>

Examples:
- cache:user_profile:user123
- cache:enrollments:user123
- cache:courses (all courses list)
- cache:course:courseId
- cache:published_courses
- cache:user_stats:user123
```

## Developer Features

### Monitor Cache Performance

```typescript
// Log cache statistics
cacheService.getStats();
// Output: { hits: 45, misses: 12, writes: 57, clears: 2, hitRate: '78.95%' }

// Log storage size
const sizeInBytes = cacheService.getStorageSize();
console.log(`Cache size: ${(sizeInBytes / 1024).toFixed(2)}KB`);

// List all cached keys
const allKeys = cacheService.getAllKeys();
console.log(allKeys.length, 'items cached');
```

### Clear Specific Data

```typescript
// Clear cache for specific user
cacheService.clearByPrefix('cache:enrollments:user123');
cacheService.clearByPrefix('cache:user_stats:user123');

// Clear all published courses
cacheService.remove('cache:published_courses');

// Clear expired entries
cacheService.clearExpired();

// Clear everything (nuclear option)
cacheService.clearAll();
```

### Disable Cache (if needed)

```typescript
// In App initialization:
cacheService.initialize({
  enabled: false, // Disable caching
  defaultExpirationMs: 5 * 60 * 1000,
  maxSize: 5,
});
```

## Performance Impact

### Expected Improvements

**Before Caching:**
- Catalog load: ~2-3 seconds (loading courses, categories, enrollments)
- User dashboard: ~2 seconds (loading stats, enrollments)
- Course detail: ~500-700ms (loading course data)

**With Caching:**
- Catalog load (first visit): ~2-3 seconds → (2nd+ visits): ~300-400ms
- User dashboard (first visit): ~2 seconds → (2nd+ visits): ~100-150ms
- Course detail (direct request): ~50-100ms (cache hit)

### Cache Hit Rate

Expected hit rates after warm-up period:
- Enrollment data: 85-95%
- Course data: 90-95%
- User statistics: 80-90%
- Overall: 85-90%

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## Storage Limits

- localStorage limit: 5-10MB per domain (browser dependent)
- Current max cache size: 5MB
- Automatic cleanup: Removes oldest entries when quota exceeded

## Troubleshooting

### Cache Not Working?

1. Check browser's localStorage is enabled:
```typescript
// In cache service, automatically logged
console.log(cacheService.getStats()); // Should show non-zero writes
```

2. Verify cache initialization:
```typescript
// In App.tsx, this should log successful initialization
useCache();
```

3. Check browser DevTools:
```javascript
// In browser console
localStorage.getItem('cache:published_courses'); // Should return data
```

### Cache Inconsistency?

If you think cache is stale, manually clear it:

```typescript
// Clear all cache
cacheService.clearAll();

// Then reload page
window.location.reload();
```

### Performance Issues?

Check cache size:
```typescript
const stats = cacheService.getStats();
console.log('Hit Rate:', stats.hitRate);

const size = cacheService.getStorageSize();
console.log('Size:', (size / 1024 / 1024).toFixed(2), 'MB');

// If too large, clear oldest entries
cacheService.clearExpired();
```

## Future Enhancements

- [ ] IndexedDB support for larger cache (>5MB)
- [ ] Sync cache across browser tabs
- [ ] Smart cache prefetching
- [ ] Cache synchronization with service workers
- [ ] Offline mode with cache as fallback
- [ ] Analytics on cache efficiency per endpoint

## API Reference

### cacheService

```typescript
// Get item from cache
get<T>(key: string, defaultExpiration?: number): T | null

// Set item in cache
set<T>(key: string, data: T, customExpirationMs?: number): boolean

// Remove item from cache
remove(key: string): boolean

// Clear all cache with specific prefix
clearByPrefix(prefix: string): number

// Clear all cache
clearAll(): void

// Clear only expired entries
clearExpired(): number

// Get cache statistics
getStats(): {
  hits: number;
  misses: number;
  writes: number;
  clears: number;
  hitRate: string;
}

// Get all cached keys
getAllKeys(): string[]

// Get total cache storage size in bytes
getStorageSize(): number
```

## Notes

- Cache is automatically managed with expiration times
- No manual cache clearing needed in most cases
- Services automatically invalidate cache when data changes
- Cache survives page refreshes but clears on browser restart (depends on localStorage)
- All cache operations are non-blocking and synchronous
