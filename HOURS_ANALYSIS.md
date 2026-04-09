# Hours Calculation & Storage Analysis
## Skill-Spire LMS Backend Architecture

---

## 📊 Overview

The LMS tracks learning time across three distinct dimensions:
1. **Learning Hours** - Actual time spent learning per course/session
2. **Session Hours** - Individual lesson session tracking with time spent
3. **Course Content Duration** - Predefined course/lesson content duration

---

## 1️⃣ LEARNING HOURS CALCULATION & STORAGE

### Database Table: `learning_hours`
```sql
CREATE TABLE learning_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  hours NUMERIC DEFAULT 0,
  minutes INTEGER DEFAULT 0,
  logged_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Key Columns:
- **hours** (NUMERIC) - Hours spent (decimal format, e.g., 1.5)
- **minutes** (INTEGER) - Minutes spent  
- **logged_date** (DATE) - Date the learning was logged
- **course_id** (UUID) - Associated course (nullable for general learning)

### Service: `learningHoursService.ts`

#### 1. **Record Learning Hours**
```typescript
async recordLearningHours(
  userId: string,
  courseId: string,
  hoursSpent: number,
  date?: string
)
```
- **Functionality**: Logs or updates learning hours for a user on a specific course
- **Logic Flow**:
  1. Check if a record exists for the same user, course, and date
  2. If EXISTS: Update by ADDING to existing hours (cumulative)
  3. If NOT EXISTS: Create new record
- **Example**: User logs 2 hours on Day 1, then 1 hour on same day → DB shows 3 hours total

#### 2. **Retrieve Learning Hours**

| Method | Purpose | Output |
|--------|---------|--------|
| `getTodayLearningHours(userId)` | Sum all hours for current day across all courses | Total hours (number) |
| `getCourseLearningHours(userId, courseId)` | Total hours for specific course | Sum of all session hours |
| `getUserLearningHours(userId, startDate?, endDate?)` | Date range query | Array of learning_hours records |
| `getWeeklyLearningHours(userId)` | Last 7 days total learning | Array of records (past 7 days) |
| `getMonthlyLearningHours(userId, year?, month?)` | Specific month learning | Array of records (specific month) |

#### 3. **Aggregation Example**
```typescript
// Get total learning hours for a course
const records = await learningHoursService.getCourseLearningHours(userId, courseId);
const totalHours = records.reduce((sum, record) => sum + (record.hoursspent || 0), 0);
// Result: 15.5 hours total on this course
```

---

## 2️⃣ SESSION HOURS CALCULATION & STORAGE

### Database Table: `lesson_progress`
```sql
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);
```

### Key Columns:
- **time_spent_seconds** (INTEGER) - Raw session time in seconds
- **last_accessed** (TIMESTAMP) - When user last viewed lesson
- **is_completed** (BOOLEAN) - Whether lesson was finished
- **completed_at** (TIMESTAMP) - When completion occurred

### Service: `lessonProgressService.ts`

#### 1. **Session Time Tracking**
```typescript
async updateLessonProgress(
  userId: string,
  lessonId: string,
  courseId: string,
  progress: number,      // 0-100
  completed = false
)
```
- **Purpose**: Track individual lesson session time
- **Called via**: REST API endpoint `http://localhost:3001/api/lesson-progress/update`
- **Tracks**: 
  - Time spent on specific lesson
  - Progress percentage (0-100%)
  - Completion status
  - Last access timestamp

#### 2. **Retrieving Session Data**

| Method | Purpose | Returns |
|--------|---------|---------|
| `getLessonProgress(userId, lessonId)` | Single lesson session record | LessonProgress object or null |
| `getUserLessonProgress(userId, courseId)` | All lessons in a course | Array of lesson_progress records |
| `getCourseLessonStats(userId, courseId)` | Aggregated course stats | statsObject with totals |
| `getCompletedLessons(userId, courseId)` | Only completed lessons | Array of completed records |

#### 3. **Course Lesson Statistics Aggregation**
```typescript
async getCourseLessonStats(userId: string, courseId: string) {
  // Calculates from all lesson_progress records:
  return {
    totalLessons: 15,              // Total lessons in course
    completedLessons: 9,           // Lessons marked complete
    progressPercentage: 60,        // Average progress across all lessons
    completionRate: 60.0           // (completed/total) * 100
  };
}
```

#### 4. **Time Spent Calculation**
```typescript
// Session time in seconds → convert to hours
const sessionTimeSeconds = 3600; // 1 hour
const sessionTimeHours = sessionTimeSeconds / 3600; // 1.0 hour

// For multiple sessions:
const totalSessionSeconds = 14400; // 4 hours across multiple sessions
const totalSessionHours = totalSessionSeconds / 3600; // 4.0 hours
```

---

## 3️⃣ COURSE CONTENT DURATION CALCULATION

### Database Tables

#### A. **Courses Table**
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  duration INTERVAL,           -- PostgreSQL INTERVAL type
  duration_minutes INTEGER,    -- Calculated/stored duration in minutes
  -- ... other fields
);
```

#### B. **Lessons Table**
```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lesson_type TEXT NOT NULL,   -- text, video, quiz, flashcard, assessment
  content JSONB,               -- Structured content blocks
  duration INTERVAL,
  duration_minutes INTEGER,    -- Calculated/stored duration in minutes
  -- ... other fields
);
```

### Service: `lessonService.ts`

#### 1. **Lesson Duration Calculation Algorithm**

The system uses a hybrid approach:
```typescript
calculateLessonDuration(lesson: any): number {
  // Priority 1: Use explicit duration if set
  if (lesson.duration && lesson.duration > 0) {
    return lesson.duration;  // Return as-is (in minutes)
  }

  // Priority 2: Calculate from content blocks
  let totalMinutes = 0;
  const contentBlocks = JSON.parse(lesson.content || '[]');

  contentBlocks.forEach((block: any) => {
    if (block.type === 'text') {
      // 100 words = 0.6 minutes (36 seconds) reading time
      const wordCount = getWordCount(block.content);
      totalMinutes += (wordCount / 100) * 0.6;
      
    } else if (block.type === 'pdf') {
      // 2 minutes per page
      const pages = block.data?.pages || 1;
      totalMinutes += pages * 2;
      
    } else if (block.type === 'video') {
      // Default 5 minutes (or use metadata if available)
      totalMinutes += 5;
      
    } else if (block.type === 'quiz') {
      // 5 minutes per quiz
      totalMinutes += 5;
      
    } else if (block.type === 'flashcard') {
      // ~1.5 minutes per flashcard
      const cardCount = block.data?.totalCards || 10;
      totalMinutes += Math.ceil(cardCount * 1.5);
    }
  });

  return Math.ceil(totalMinutes || 0);
}
```

#### 2. **Duration Calculation Formulas**

| Content Type | Duration Formula | Example |
|--------------|-----------------|---------|
| **Text** | (word_count / 100) × 0.6 min | 1000 words → 6 minutes |
| **PDF** | pages × 2 min | 5 pages → 10 minutes |
| **Video** | Default 5 min (or metadata) | Depends on video length |
| **Quiz** | 5 min per quiz | Single quiz → 5 minutes |
| **Flashcard** | card_count × 1.5 min | 20 cards → 30 minutes |

### Service: `durationService.ts`

#### 1. **Duration Conversion Utilities**
```typescript
// Convert minutes to decimal hours
minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
  // Example: 90 minutes → 1.5 hours
}

// Convert hours to minutes
hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
  // Example: 1.5 hours → 90 minutes
}

// Format for display
formatDurationForDisplay(minutes: number): string {
  // Returns: "2h 30m", "45m", "1h", etc.
}

// Calculate total course duration
calculateTotalDuration(lessons: Lesson[]): number {
  return lessons.reduce((total, lesson) => 
    total + (lesson.duration_minutes ?? lesson.duration ?? 0), 0
  );
  // Returns total minutes for entire course
}
```

#### 2. **Duration Validation**
```typescript
validateDurationMinutes(duration: number): {
  isValid: boolean;
  error?: string;
  correctedValue?: number;
}

// Rules:
// - Minimum: 1 minute (or 0 for unset)
// - Maximum: 10,080 minutes (7 days)
// - Must be integer
// - Must be positive

// Auto-correction:
// - If 1-24 (looks like hours) → multiply by 60
// - If > 10,080 (exceeds max) → divide by 60
```

---

## 4️⃣ STORAGE & RELATIONSHIPS

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      SKILL-SPIRE LMS                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ COURSE SETUP (Content Duration)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Courses Table                   Lessons Table                   │
│  ├─ id                           ├─ id                           │
│  ├─ title                        ├─ course_id (FK)               │
│  ├─ duration_minutes ◄──┐        ├─ lesson_type                  │
│  └─ (SUM of lessons)    └────────┤─ duration_minutes             │
│                                  ├─ content (JSONB)              │
│                                  └─ (calculated from blocks)     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ USER LEARNING TRACKING (Session & Learning Hours)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  lesson_progress Table              learning_hours Table         │
│  ├─ user_id (FK)                   ├─ user_id (FK)             │
│  ├─ lesson_id (FK)                 ├─ course_id (FK)           │
│  ├─ time_spent_seconds ◄───┐       ├─ hours (decimal)          │
│  ├─ is_completed            │       ├─ minutes (integer)        │
│  └─ last_accessed           └──────┤─ logged_date              │
│                                      └─ created_at              │
│                                                                   │
│  user_statistics Table                                           │
│  ├─ user_id (FK)                                                │
│  ├─ total_learning_hours ◄──┐                                   │
│  ├─ courses_completed        └─ Updated when recording hours    │
│  └─ current_streak                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5️⃣ KEY INTEGRATION POINTS

### Service: `userStatisticsService.ts`
```typescript
async updateLearningHours(userId: string, hoursSpent: number) {
  // 1. Get current user_statistics record
  const stats = await this.getUserStatistics(userId);
  
  // 2. Add new hours to total
  const newTotalHours = (stats.totallearninghours || 0) + hoursSpent;
  
  // 3. Update user_statistics table
  await supabase
    .from('user_statistics')
    .update({
      totallearninghours: newTotalHours,
      lastactivityat: new Date().toISOString(),
    })
    .eq('userid', userId);
    
  // 4. Invalidate cache for fresh data
  cacheService.remove(`cache:user_stats:${userId}`);
}
```

### Typical User Flow

```
1. User starts lesson
   ↓
2. API receives time_spent tracking
   ↓
3. lessonProgressService.updateLessonProgress() called
   └─ Stores time in lesson_progress.time_spent_seconds
   ↓
4. learningHoursService.recordLearningHours() called
   └─ Converts seconds to hours
   └─ Stores in learning_hours table
   ↓
5. userStatisticsService.updateLearningHours() called
   └─ Updates user_statistics.total_learning_hours
   ↓
6. User dashboard displays cumulative hours
```

---

## 6️⃣ DATABASE SCHEMA - HOUR-RELATED FIELDS

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `courses` | `duration` | INTERVAL | PostgreSQL interval type |
| `courses` | `duration_minutes` | INTEGER | Calculated from lessons |
| `lessons` | `duration` | INTERVAL | PostgreSQL interval type |
| `lessons` | `duration_minutes` | INTEGER | Calculated from content |
| `lesson_progress` | `time_spent_seconds` | INTEGER | Actual session time |
| `learning_hours` | `hours` | NUMERIC | Decimal hours (e.g., 1.5) |
| `learning_hours` | `minutes` | INTEGER | Remaining minutes |
| `learning_hours` | `logged_date` | DATE | When logged |
| `user_statistics` | `total_learning_hours` | NUMERIC | Running total |

---

## 7️⃣ RLS POLICIES FOR LEARNING HOURS

```sql
-- Users can only read their own learning hours
ALTER TABLE learning_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own learning hours"
ON learning_hours FOR SELECT
USING (auth.uid() = userid);

-- Admins can read all learning hours
CREATE POLICY "Admins can read all learning hours"
ON learning_hours FOR SELECT
USING (
  SELECT role = 'admin' FROM profiles 
  WHERE id = auth.uid()
);

-- Service role has full access
CREATE POLICY "Service role can manage learning hours"
ON learning_hours FOR ALL
USING (auth.role() = 'service_role');
```

---

## 8️⃣ INDEXING FOR PERFORMANCE

```sql
-- Critical indexes for common queries
CREATE INDEX idx_learning_hours_userid ON learning_hours(userid);
CREATE INDEX idx_learning_hours_userid_date ON learning_hours(userid, logged_date);

CREATE INDEX idx_lesson_progress_user_lesson ON lesson_progress(userid, lessonid);
CREATE INDEX idx_lesson_progress_course ON lesson_progress(userid, courseid);

CREATE INDEX idx_courses_duration ON courses(id, duration_minutes);
CREATE INDEX idx_lessons_duration ON lessons(course_id, duration_minutes);

-- For dashboard views
CREATE INDEX idx_user_statistics_userid ON user_statistics(userid);
```

---

## 9️⃣ CALCULATED VIEWS (SQL)

```sql
-- Module Learning Statistics View
CREATE VIEW v_module_learning_stats AS
SELECT 
  e.userid,
  c.id as course_id,
  c.title,
  COUNT(DISTINCT lp.lessonid) as total_lessons,
  COUNT(DISTINCT CASE WHEN lp.completed THEN lp.lessonid END) as completed_lessons,
  COALESCE(SUM(lh.hoursspent), 0) as total_hours_spent,
  ROUND(
    COUNT(DISTINCT CASE WHEN lp.completed THEN lp.lessonid END)::numeric / 
    NULLIF(COUNT(DISTINCT lp.lessonid), 0) * 100, 2
  ) as completion_percentage
FROM enrollments e
LEFT JOIN lessons l ON e.courseid = l.courseid
LEFT JOIN lesson_progress lp ON e.userid = lp.userid 
                            AND l.id = lp.lessonid
LEFT JOIN learning_hours lh ON e.userid = lh.userid 
                           AND c.id = lh.courseid
GROUP BY e.userid, c.id, c.title;
```

---

## 🔟 SUMMARY TABLE

| Aspect | Table | Unit | Real-time? | Granularity |
|--------|-------|------|------------|-------------|
| **Content Duration** | courses/lessons | Minutes | Calculated | Per lesson |
| **Session Time** | lesson_progress | Seconds | Tracked | Per lesson per user |
| **Learning Hours** | learning_hours | Hours/Minutes | Logged | Per course per day |
| **User Totals** | user_statistics | Hours | Aggregate | Per user |

---

## 📝 NOTES & CAVEATS

1. **Duration Calculation**
   - Durations are stored in `duration_minutes` (INTEGER) as the primary field
   - PostgreSQL `INTERVAL` type is also available but less commonly used
   - Content-based calculations are ESTIMATES not actual timings

2. **Learning Hours Recording**
   - Data is CUMULATIVE within same user/course/date
   - Logging multiple times on same day ADDS to existing record
   - No automatic tracking; must be explicitly recorded via API

3. **Session Time Tracking**
   - `time_spent_seconds` in lesson_progress tracks ACTUAL session time
   - Independent from learning_hours logging
   - Both can coexist for different purposes

4. **Performance Considerations**
   - Cache expiration: 5 minutes for user stats, 10-15 minutes for general data
   - Indexes on user_id + date for fast range queries
   - Pagination recommended for large result sets (> 100K records)

5. **Data Consistency**
   - Manual synchronization may be needed between:
     - lesson_progress (session time)
     - learning_hours (logged time)
     - user_statistics (aggregate)
   - Consider scheduled jobs to reconcile data daily

---

## Environment Setup

The system uses Supabase with MCP for:
- Database queries via REST API
- Real-time subscriptions (optional)
- Edge functions for serverless operations
- RLS policies for data security

See `mcp.json` for configuration:
```json
{
  "servers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=veaawiernjkdsfiziqen&features=account,docs,database,functions,debugging,development,branching,storage"
    }
  }
}
```

---

**Document Generated**: April 2026  
**LMS Version**: Skill-Spire  
**Last Updated**: Comprehensive Analysis Complete
