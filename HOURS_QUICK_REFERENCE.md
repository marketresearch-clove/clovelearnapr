# Hours System - Quick Reference Guide

## 🎯 Quick Lookup

### Where is it stored?
| What | Where | Table | Field |
|-----|-------|-------|-------|
| Course duration (plan) | Database | `courses` | `duration_minutes` |
| Lesson duration (plan) | Database | `lessons` | `duration_minutes` |
| Session time (actual) | Database | `lesson_progress` | `time_spent_seconds` |
| Learning hours (logged) | Database | `learning_hours` | `hours` / `minutes` |
| User total hours | Database | `user_statistics` | `total_learning_hours` |

---

## 🔧 Key Services & Methods

### Learning Hours Service
**File**: `lib/learningHoursService.ts`

```typescript
// RECORD hours
learningHoursService.recordLearningHours(userId, courseId, hoursSpent, date)
→ Adds hours to learning_hours table (cumulative per day)

// RETRIEVE hours
learningHoursService.getTodayLearningHours(userId)          // Total today
learningHoursService.getWeeklyLearningHours(userId)         // Past 7 days
learningHoursService.getMonthlyLearningHours(userId)        // Specific month
learningHoursService.getCourseLearningHours(userId, courseId) // Per course
```

### Lesson Progress Service
**File**: `lib/lessonProgressService.ts`

```typescript
// TRACK session time
lessonProgressService.updateLessonProgress(userId, lessonId, courseId, progress, completed)
→ Updates lesson_progress table with time_spent_seconds

// RETRIEVE session stats
lessonProgressService.getLessonProgress(userId, lessonId)
lessonProgressService.getCourseLessonStats(userId, courseId)
→ Returns: { totalLessons, completedLessons, progressPercentage, completionRate }
```

### Duration Service
**File**: `lib/durationService.ts`

```typescript
// CONVERT
durationService.minutesToHours(minutes)           // 90 → 1.5
durationService.hoursToMinutes(hours)             // 1.5 → 90
durationService.formatDurationForDisplay(minutes) // 90 → "1h 30m"

// CALCULATE
durationService.calculateTotalDuration(lessons)   // Sum all lesson durations

// VALIDATE
durationService.validateDurationMinutes(duration) // Check if valid
durationService.detectAndCorrectDuration(duration) // Auto-fix errors
```

### User Statistics Service
**File**: `lib/userStatisticsService.ts`

```typescript
// UPDATE aggregate hours
userStatisticsService.updateLearningHours(userId, hoursSpent)
→ Updates user_statistics.total_learning_hours

// RETRIEVE stats
userStatisticsService.getUserStatistics(userId)
→ Returns: { totalLearningHours, coursesCompleted, currentStreak, ... }
```

---

## 📐 Duration Calculation Formulas

### Content-Based Duration
When no explicit duration is set, calculated from content blocks:

```
Text:      (word_count / 100) × 0.6 minutes
PDF:       pages × 2 minutes
Video:     5 minutes (default) or actual length
Quiz:      5 minutes per quiz
Flashcard: card_count × 1.5 minutes
```

### Example Lesson
```
Content blocks:
- Text (2000 words)      → (2000/100) × 0.6 = 12 minutes
- PDF (5 pages)          → 5 × 2 = 10 minutes
- Video                  → 5 minutes
- Quiz                   → 5 minutes
- Flashcards (20 cards)  → 20 × 1.5 = 30 minutes
───────────────────────────────────
Total Lesson Duration    → 62 minutes
```

---

## 🔄 Data Flow Example

User learns for a session:

```
1. User opens Lesson A (in Course X)
   ↓
2. 45 minutes pass, user completes lesson
   ↓
3. API: lessonProgressService.updateLessonProgress()
   └─→ lesson_progress table: time_spent_seconds = 2700 (45 min × 60)
   ↓
4. API: learningHoursService.recordLearningHours()
   └─→ learning_hours table: hours = 0.75 (45 min ÷ 60)
   ↓
5. API: userStatisticsService.updateLearningHours()
   └─→ user_statistics: total_learning_hours += 0.75
   ↓
6. Dashboard shows:
   - Session: 45 min on Lesson A
   - Course: 45 min on Course X today
   - Total: User now has X.75 hours logged
```

---

## 🔐 Database Units Explained

| Column | Type | Standard Unit | Conversion |
|--------|------|---------------|-----------|
| `duration_minutes` | INTEGER | Minutes | × 60 = seconds, ÷ 60 = hours |
| `duration` | INTERVAL | PostgreSQL format | Rarely used |
| `time_spent_seconds` | INTEGER | Seconds | ÷ 60 = minutes, ÷ 3600 = hours |
| `hours` (in learning_hours) | NUMERIC | Decimal hours | × 60 = minutes |
| `minutes` (in learning_hours) | INTEGER | Minutes | ÷ 60 = hours |

---

## ⚡ Common Queries

### Get total hours for a user this month
```typescript
const records = await learningHoursService.getMonthlyLearningHours(userId);
const totalHours = records.reduce((sum, r) => sum + (r.hoursspent || 0), 0);
// Result: 12.5 hours
```

### Get course progress stats
```typescript
const stats = await lessonProgressService.getCourseLessonStats(userId, courseId);
// Result: { totalLessons: 15, completedLessons: 10, completionRate: 66.7% }
```

### Get user's weekly learning pattern
```typescript
const weeklyData = await learningHoursService.getWeeklyLearningHours(userId);
// Returns array of last 7 days with daily hours breakdown
```

### Convert course content to hours
```typescript
const lessons = await lessonService.getLessonsByCourseId(courseId);
const totalMinutes = durationService.calculateTotalDuration(lessons);
const totalHours = durationService.minutesToHours(totalMinutes); // Decimal hours
```

---

## 🎨 Display Formats

The system provides multiple display formats:

```typescript
// Human-readable (for UI display)
durationService.formatDurationForDisplay(minutes)
// Examples:
// 45 → "45m"
// 90 → "1h 30m"
// 120 → "2h"

// Decimal hours (for calculations/reports)
durationService.minutesToHours(minutes)
// 90 → 1.5

// Range format
durationService.formatDurationRange(minMinutes, maxMinutes)
// (45, 90) → "45m - 1h 30m"
```

---

## 🚨 Validation Rules

Duration must be:
- ✅ Positive integer (0 or higher)
- ✅ Minimum: 1 minute (or 0 for unset)
- ✅ Maximum: 10,080 minutes (7 days)
- ⚠️ Auto-corrected if appears to be in wrong unit

Examples:
```
15 minutes  ✅ Valid
60 minutes  ✅ Valid
720 minutes ✅ Valid (12 hours)
10080 minutes ✅ Valid (7 days max)
10081 minutes ❌ Exceeds maximum
-30 minutes ❌ Cannot be negative
```

---

## 📊 Caching

Services use caching to improve performance:

| Cache Key | Expiration | Service |
|-----------|-----------|---------|
| `cache:user_stats:{userId}` | 5 minutes | userStatisticsService |
| `cache:all_courses` | 10 minutes | courseService |
| `cache:course_feedback_summary` | 15 minutes | courseService |
| `cache:all_lessons_summary` | 10 minutes | courseService |

⚠️ Cache is automatically cleared when data is updated.

---

## 🔧 Development Tips

1. **Testing Learning Hours**
   ```typescript
   // Mock a day's learning
   await learningHoursService.recordLearningHours(
     userId,
     courseId,
     2.5, // 2.5 hours
     '2024-04-09'
   );
   ```

2. **Check Duration Validity**
   ```typescript
   const validation = durationService.validateDurationMinutes(duration);
   if (!validation.isValid) {
     console.error(validation.error);
   }
   ```

3. **Bulk import course durations**
   ```typescript
   for (const course of courses) {
     const lessons = await lessonService.getLessonsByCourseId(course.id);
     const totalMinutes = durationService.calculateTotalDuration(lessons);
     // Update course.duration_minutes = totalMinutes
   }
   ```

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Hours not updating | Cache not invalidated | Call cacheService.remove() |
| Duplicate time entries | Same date logged twice | Check logged_date uniqueness |
| Duration showing as NaN | Invalid content JSON | Validate lesson.content before parsing |
| Session time not tracked | API not called | Ensure updateLessonProgress is triggered |
| Total hours don't match | Different table sources | Reconcile learning_hours vs user_statistics |

---

## 📍 File Locations

```
lib/
├── learningHoursService.ts  ← Records and retrieves logged hours
├── lessonProgressService.ts  ← Tracks session time per lesson
├── durationService.ts        ← Duration conversion utilities
├── courseService.ts          ← Course-level operations
├── lessonService.ts          ← Lesson-level operations
└── userStatisticsService.ts  ← Aggregates user learning totals

sql/
└── DATABASE_SCHEMA_COMPLETE.sql  ← Table definitions

supabase/migrations/
├── 20260407_create_module_learning_stats_view.sql
└── 20260405_fix_admin_dashboard_loading.sql
```

---

## 📞 Related Documentation

- Full analysis: `HOURS_ANALYSIS.md`
- Database schema: `sql/DATABASE_SCHEMA_COMPLETE.sql`
- Migration details: `supabase/migrations/`

---

**Last Updated**: April 2026  
**Quick Reference Version**: 1.0
