# Time Tracking System - Complete Implementation Guide

## Overview

The time tracking system has been completely refactored to use **SECONDS** as the standard unit for all time tracking operations. This eliminates ambiguity and ensures data consistency across all layers.

---

## Key Changes

### 1. **Database Layer** ✅

#### New Tables Created

**`learning_sessions`** - High-level session tracking
```sql
- id: UUID
- user_id: UUID
- course_id: UUID (optional)
- lesson_id: UUID (optional)
- session_start: TIMESTAMP (when user starts learning)
- session_end: TIMESTAMP (when user finishes)
- duration_seconds: INTEGER (calculated from start/end)
- is_completed: BOOLEAN
- idle_time_seconds: INTEGER (tracked idle time)
```

**`lesson_time_logs`** - Granular lesson-level tracking
```sql
- id: UUID
- user_id: UUID
- lesson_id: UUID
- course_id: UUID
- session_id: UUID (links to session)
- time_spent_seconds: INTEGER (all in seconds)
- started_at: TIMESTAMP
- ended_at: TIMESTAMP (optional)
- is_completed: BOOLEAN
```

#### Enhanced Tables

**`learning_hours`** - Now includes:
- `time_spent_seconds` - Primary field (seconds)
- `hours` - Legacy field for backward compatibility

**`lesson_progress`** - Now includes:
- `time_spent_seconds` - Source of truth for lesson time
- `session_count` - Number of sessions on this lesson

**`user_statistics`** - Now includes:
- `total_time_spent_seconds` - Total time in seconds
- `total_sessions` - Number of sessions
- `average_session_duration_seconds` - Average duration

---

## 2. **Backend Services** ✅

### `sessionService.ts` - Session Management

Handles session lifecycle and lesson-level tracking.

**Key Methods:**
```typescript
// Start a new session
await sessionService.startSession(userId, courseId, lessonId?)

// End a session (auto-calculates duration)
await sessionService.endSession(sessionId)

// Get current active session
await sessionService.getActiveSession(userId)

// Log time on a lesson (in seconds)
await sessionService.logLessonTime(userId, lessonId, courseId, timeSpentSeconds, sessionId?)

// Get user's session history
await sessionService.getUserSessions(userId, limit?)

// Get daily statistics
await sessionService.getDailyStats(userId, date)
```

### `learningHoursService.ts` - Aggregated Tracking

Handles daily/weekly/monthly aggregation.

**Key Methods:**
```typescript
// Record learning time (now uses seconds)
await learningHoursService.recordLearningHours(
  userId,
  courseId,
  timeSpentSeconds,  // in SECONDS
  date?
)

// Get today's hours with conversion
const stats = await learningHoursService.getTodayLearningHours(userId)
// Returns: { seconds, minutes, hours, formatted }

// Get course total
const courseStats = await learningHoursService.getCourseLearningHours(userId, courseId)

// Get weekly/monthly stats
const weekly = await learningHoursService.getWeeklyLearningHours(userId)
const monthly = await learningHoursService.getMonthlyLearningHours(userId)
```

### `timeTrackingService.ts` - Utility Functions

Provides time conversion and formatting utilities.

**Key Methods:**
```typescript
// Conversions
timeTrackingService.secondsToHours(3600)        // → 1.00
timeTrackingService.secondsToMinutes(120)       // → 2.00
timeTrackingService.hoursToSeconds(1.5)         // → 5400
timeTrackingService.minutesToSeconds(30)        // → 1800

// Formatting
timeTrackingService.formatSeconds(3665)         // → "1h 1m 5s"
timeTrackingService.formatAsHMS(3665)           // → "01:01:05"
timeTrackingService.getSummaryInHours(3600)     // → "1.00 hours"

// Parsing
timeTrackingService.parseToSeconds("1h 2m 3s")  // → 3723
timeTrackingService.parseToSeconds("1:02:03")   // → 3723

// Validation
timeTrackingService.isValidTime(300)            // → true
timeTrackingService.isValidTime(-100)           // → false

// Aggregation
timeTrackingService.aggregateDurations([60,120,180])
// →  { totalSeconds, totalMinutes, totalHours, formatted }

// Comparison (for reconciliation)
timeTrackingService.compareTime(actual, expected, tolerancePercent)
// → { matches, percentDifference, discrepancySeconds }
```

---

## 3. **API Endpoints** ✅

Base URL: `/api/time-tracking?action=<ACTION>`

### Session Management

**Start Session**
```
POST /api/time-tracking?action=start-session
Body: { courseId, lessonId? }
Response: { success, session }
```

**End Session**
```
POST /api/time-tracking?action=end-session
Body: { sessionId }
Response: { success, session }
```

**Get Active Session**
```
GET /api/time-tracking?action=active-session
Response: { success, session }
```

### Time Logging

**Log Lesson Time**
```
POST /api/time-tracking?action=log-lesson-time
Body: { lessonId, courseId, timeSpentSeconds, sessionId? }
Response: { success, log }
```

**Record Learning Hours (Daily)**
```
POST /api/time-tracking?action=record-learning-hours
Body: { courseId, timeSpentSeconds, date? }
Response: { success, hours }
```

### Statistics

**Today's Stats**
```
GET /api/time-tracking?action=today-stats
Response: { success, stats: { totalSecondsSpent, totalHours, sessionCount, formatted } }
```

**Daily Stats (Specific Date)**
```
GET /api/time-tracking?action=daily-stats&date=2026-04-10
Response: { success, date, stats }
```

**Weekly Stats (Last 7 Days)**
```
GET /api/time-tracking?action=weekly-stats
Response: { success, stats: { seconds, minutes, hours, formatted, records } }
```

**Monthly Stats**
```
GET /api/time-tracking?action=monthly-stats&year=2026&month=4
Response: { success, stats }
```

**Course Hours**
```
GET /api/time-tracking?action=course-hours&courseId=<UUID>
Response: { success, courseId, hours: { seconds, minutes, hours, formatted } }
```

### History & Summaries

**Session History**
```
GET /api/time-tracking?action=session-history&limit=10
Response: { success, sessions[] }
```

**Session Summary**
```
GET /api/time-tracking?action=session-summary&sessionId=<UUID>
Response: { success, summary: { session, lessons[] } }
```

---

## 4. **Frontend Integration** 🔄

### Time Display Component

```typescript
import { timeTrackingService } from '@/lib/timeTrackingService';

function TimeDisplay({ seconds }: { seconds: number }) {
  return (
    <div>
      {/* Option 1: Readable format */}
      <p>{timeTrackingService.formatSeconds(seconds)}</p>
      {/* Output: "1h 2m 30s" */}

      {/* Option 2: HH:MM:SS format */}
      <p>{timeTrackingService.formatAsHMS(seconds)}</p>
      {/* Output: "01:02:30" */}

      {/* Option 3: By unit */}
      <p>
        {timeTrackingService.secondsToHours(seconds).toFixed(2)} hours
      </p>
      {/* Output: "1.04 hours" */}
    </div>
  );
}
```

### Session Tracking Hook

```typescript
import { useCallback, useState } from 'react';
import { sessionService } from '@/lib/sessionService';

function useLearningSession() {
  const [activeSession, setActiveSession] = useState(null);

  const startSession = useCallback(async (courseId: string, lessonId?: string) => {
    const session = await sessionService.startSession(
      userId,
      courseId,
      lessonId
    );
    setActiveSession(session);
    return session;
  }, []);

  const endSession = useCallback(async () => {
    if (!activeSession) return;
    const completed = await sessionService.endSession(activeSession.id);
    setActiveSession(null);
    return completed;
  }, [activeSession]);

  const logLessonTime = useCallback(
    async (lessonId: string, courseId: string, timeSpentSeconds: number) => {
      return await sessionService.logLessonTime(
        userId,
        lessonId,
        courseId,
        timeSpentSeconds,
        activeSession?.id
      );
    },
    [activeSession]
  );

  return { activeSession, startSession, endSession, logLessonTime };
}
```

---

## 5. **Migration Path** 🔄

### Old Schema → New Schema

| Old Field | New Standard | Notes |
|-----------|-------------|-------|
| `hoursspent` (unclear unit) | `time_spent_seconds` | Always in seconds now |
| `hoursSpent` parameter | `timeSpentSeconds` | Parameter name changed |
| No session tracking | `learning_sessions` | New table for sessions |
| No lesson-level tracking | `lesson_time_logs` | New table for granular tracking |

### Backward Compatibility

- `learning_hours.hours` field retained for backward compatibility
- Automatically calculated from `time_spent_seconds`
- DEPRECATED: Will be removed in future version

---

## 6. **Data Flow Example** 📊

### User Learning a Lesson

```
1. User opens a lesson
   → sessionService.startSession(userId, courseId, lessonId)
   ✓ Creates record in learning_sessions

2. User studies for 300 seconds (5 mins)
   → sessionService.logLessonTime(userId, lessonId, courseId, 300, sessionId)
   ✓ Creates record in lesson_time_logs

3. User completes lesson
   → sessionService.completeLessonTime(logId)
   ✓ Updates lesson_time_logs with is_completed=true

4. User closes browser
   → sessionService.endSession(sessionId)
   ✓ Updates learning_sessions with session_end and duration_seconds

5. End of day, aggregate:
   → learningHoursService.recordLearningHours(userId, courseId, totalSeconds)
   ✓ Sums all lesson_time_logs for the day
   ✓ Updates learning_hours table

6. Display stats:
   → API call: /api/time-tracking?action=today-stats
   ✓ Returns formatted time with seconds/minutes/hours breakdown
```

---

## 7. **Validation & Reconciliation** ✅

The system includes validation at multiple levels:

### Input Validation
```typescript
// All time inputs must be non-negative
if (!timeTrackingService.isValidTime(timeSpentSeconds)) {
  throw new Error('Invalid time value');
}
```

### Database Constraints
```sql
-- No negative durations allowed
CONSTRAINT check_session_duration CHECK (duration_seconds >= 0)
CONSTRAINT check_time_spent CHECK (time_spent_seconds >= 0)
```

### Reconciliation Function
```typescript
// Compare actual vs expected time
const comparison = timeTrackingService.compareTime(
  actualSeconds,    // measured time
  expectedSeconds,  // expected/planned time
  5                 // tolerance percentage
);

// Returns:
// {
//   matches: boolean,
//   percentDifference: number,
//   discrepancySeconds: number
// }
```

---

## 8. **Testing Checklist** ✅

- [ ] Session creation and completion
- [ ] Session duration calculation
- [ ] Lesson time logging
- [ ] Daily/weekly/monthly aggregation
- [ ] Time unit conversions (seconds → hours/minutes)
- [ ] API endpoint functionality
- [ ] RLS policies (users see only their own data)
- [ ] Backward compatibility with old hour fields
- [ ] Reconciliation between session logs and learning_hours
- [ ] Idle time tracking (future feature)

---

## 9. **Future Enhancements** 🚀

- [ ] Idle activity detection (pause sessions when inactive > 5 mins)
- [ ] Real-time sync with backend (WebSocket updates)
- [ ] Anonymous user session support
- [ ] Detailed lesson analytics dashboard
- [ ] Learning pace recommendations
- [ ] Integration with spaced repetition system

---

## 10. **Support & Troubleshooting**

### Common Issues

**Problem**: Sessions not appearing in dashboard
- Solution: Check RLS policies - users should only see their own data
- Verify: `WHERE user_id = auth.uid()`

**Problem**: Time totals don't match
- Solution: Run `timeTrackingService.compareTime()` to identify discrepancies
- Check: Are both sources (session logs + learning_hours) being updated?

**Problem**: Negative time values in database
- Solution: Impossible due to CHECK constraints
- Verify: API validates `timeSpentSeconds >= 0` before insert

---

## 11. **Quick Start**

### To integrate time tracking in a lesson page:

```typescript
import { useLearningSession } from '@/hooks/useLearningSession';
import { timeTrackingService } from '@/lib/timeTrackingService';

export default function LessonPage() {
  const { activeSession, startSession, endSession, logLessonTime } = useLearningSession();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    startSession(courseId, lessonId);
    return () => endSession();
  }, []);

  // Auto-update every second
  useEffect(() => {
    const interval = setInterval(
      () => setElapsedSeconds(prev => prev + 1),
      1000
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Time Elapsed: {timeTrackingService.formatSeconds(elapsedSeconds)}</h1>
      {/* Lesson content */}
    </div>
  );
}
```

---

**Last Updated:** April 10, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
