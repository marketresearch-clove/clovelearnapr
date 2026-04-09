# Backend Architecture: Hours System Technical Deep Dive

## 🏗️ Architecture Overview

The hours tracking system in Skill-Spire LMS is built on a **three-tier calculation model**:

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: CONTENT PLANNING (Static Duration)                     │
│  ├─ Course duration_minutes (SUM of lessons)                    │
│  └─ Lesson duration_minutes (calculated from content blocks)    │
├─────────────────────────────────────────────────────────────────┤
│  TIER 2: SESSION TRACKING (Dynamic Time Spent)                  │
│  ├─ lesson_progress.time_spent_seconds (actual user time)       │
│  └─ lesson_progress.last_accessed (when accessed)               │
├─────────────────────────────────────────────────────────────────┤
│  TIER 3: AGGREGATE REPORTING (User Statistics)                  │
│  ├─ learning_hours (manually logged hours per course/date)      │
│  └─ user_statistics (total hours across all activities)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 TIER 1: CONTENT PLANNING

### Database Schema

```sql
-- Courses table: Parent container
CREATE TABLE courses (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  category_id UUID REFERENCES categories(id),
  
  -- Duration storage (BOTH formats available)
  duration INTERVAL,           -- PostgreSQL INTERVAL: '02:30:00'
  duration_minutes INTEGER,    -- PRIMARY: Integer minutes (90)
  
  is_published BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lessons table: Content modules within courses
CREATE TABLE lessons (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  
  -- Lesson content
  lesson_type TEXT NOT NULL,  -- 'text', 'video', 'quiz', 'flashcard', 'assessment'
  content JSONB,              -- Structured content blocks (see below)
  order_index INTEGER,
  
  -- Duration storage
  duration INTERVAL,          -- PostgreSQL INTERVAL (rarely used)
  duration_minutes INTEGER,   -- PRIMARY: Calculated from content
  
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_lessons_course_id ON lessons(course_id);
CREATE INDEX idx_lessons_order ON lessons(course_id, order_index);
CREATE INDEX idx_courses_duration ON courses(id, duration_minutes);
```

### Content Block Structure (JSONB)

```json
// lesson.content is a JSON array:
[
  {
    "type": "text",
    "content": "<p>Lesson content with HTML...</p>",
    "metadata": { "wordCount": 2000 }
  },
  {
    "type": "video",
    "source": "youtube",
    "videoId": "abc123",
    "duration": 300,  // seconds
    "metadata": { "length": "5:00" }
  },
  {
    "type": "pdf",
    "url": "https://example.com/document.pdf",
    "data": { "pages": 15 }
  },
  {
    "type": "quiz",
    "quizId": "uuid-here",
    "data": { "questions": 10 }
  },
  {
    "type": "flashcard",
    "setId": "uuid-here",
    "data": { "totalCards": 25 }
  }
]
```

### Duration Calculation Logic

**File**: `lib/lessonService.ts`

```typescript
calculateLessonDuration(lesson: any): number {
  // Step 1: Try explicit duration first
  if (lesson.duration && lesson.duration > 0) {
    return lesson.duration;  // in minutes
  }

  // Step 2: Parse content blocks
  let totalMinutes = 0;
  let contentBlocks: any[] = [];

  try {
    if (typeof lesson.content === 'string') {
      contentBlocks = JSON.parse(lesson.content);
    } else if (Array.isArray(lesson.content)) {
      contentBlocks = lesson.content;
    }
  } catch (e) {
    console.error('JSON parse error in lesson content:', e);
    return 0;
  }

  // Step 3: Process each content block
  contentBlocks.forEach((block: any) => {
    switch (block.type) {
      case 'text':
        // Extract text and count words
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = block.content || '';
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        const wordCount = plainText
          .trim()
          .split(/\s+/)
          .filter((w: string) => w.length > 0).length;
        
        // Reading speed: 100 words = 0.6 minutes (36 seconds)
        const textMinutes = (wordCount / 100) * 0.6;
        totalMinutes += textMinutes;
        break;

      case 'pdf':
        // 2 minutes per page
        const pages = block.data?.pages || 1;
        totalMinutes += pages * 2;
        break;

      case 'video':
        // Use metadata duration if available, else default 5 min
        if (block.duration) {
          totalMinutes += block.duration / 60;  // convert seconds to minutes
        } else {
          totalMinutes += 5;  // default
        }
        break;

      case 'quiz':
        // Standard 5 minutes per quiz
        totalMinutes += 5;
        break;

      case 'flashcard':
        // 1.5 minutes per card (for memorization)
        const cardCount = block.data?.totalCards || 10;
        const flashcardMinutes = Math.max(5, Math.ceil(cardCount * 1.5));
        totalMinutes += flashcardMinutes;
        break;

      default:
        console.warn(`Unknown content type: ${block.type}`);
    }
  });

  // Step 4: Round up and return
  return Math.ceil(totalMinutes || 0);
}
```

### Duration Service Utilities

**File**: `lib/durationService.ts`

```typescript
export const durationService = {
  
  // Validation function
  validateDurationMinutes(
    duration: number,
    context: string = 'Duration'
  ): DurationValidationResult {
    // Check 1: Must be a number
    if (typeof duration !== 'number') {
      return {
        isValid: false,
        error: `${context}: Duration must be a number, got ${typeof duration}`,
      };
    }

    // Check 2: Must be non-negative integer
    if (!Number.isInteger(duration) || duration < 0) {
      return {
        isValid: false,
        error: `${context}: Duration must be non-negative integer, got ${duration}`,
      };
    }

    // Check 3: Minimum boundary
    if (duration > 0 && duration < 1) {
      return {
        isValid: false,
        error: `${context}: Minimum is 1 minute, got ${duration}`,
      };
    }

    // Check 4: Maximum boundary (7 days)
    const MAX_DURATION_MINUTES = 10080;  // 7 * 24 * 60
    if (duration > MAX_DURATION_MINUTES) {
      return {
        isValid: false,
        error: `${context}: Cannot exceed ${MAX_DURATION_MINUTES} minutes (7 days)`,
      };
    }

    return { isValid: true };
  },

  // Auto-correction for common errors
  detectAndCorrectDuration(
    duration: number,
    context: string = 'Duration'
  ): DurationValidationResult {
    const validation = this.validateDurationMinutes(duration, context);
    if (validation.isValid) {
      return { isValid: true };
    }

    // Error Case 1: Duration looks like hours (1-24) instead of minutes
    if (duration > 0 && duration <= 24) {
      const corrected = duration * 60;  // × 60 to convert hours to minutes
      if (corrected <= 10080) {  // Within max boundaries
        return {
          isValid: true,
          correctedValue: corrected,
          error: `Detected unit error: ${duration}h → ${corrected}m`,
        };
      }
    }

    // Error Case 2: Duration is too large (maybe in seconds instead of minutes)
    if (duration > 10080 && duration <= 10080 * 60) {
      const corrected = Math.round(duration / 60);
      return {
        isValid: true,
        correctedValue: corrected,
        error: `Detected unit error: ${duration}m → ${corrected}h`,
      };
    }

    return validation;
  },

  // Conversion help
  minutesToHours(minutes: number): number {
    if (minutes <= 0) return 0;
    // Returns decimal hours, rounded to 1 place
    return Math.round((minutes / 60) * 10) / 10;
    // Examples: 90 → 1.5, 45 → 0.8, 120 → 2.0
  },

  hoursToMinutes(hours: number): number {
    if (hours <= 0) return 0;
    return Math.round(hours * 60);
    // Examples: 1.5 → 90, 0.75 → 45, 2 → 120
  },

  // Display formatting
  formatDurationForDisplay(minutes: number): string {
    if (minutes === 0 || !minutes) return 'N/A';
    if (typeof minutes !== 'number' || minutes < 0) return 'Invalid';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
    
    // Examples:
    // 45 → "45m"
    // 90 → "1h 30m"
    // 120 → "2h"
    // 0 → "N/A"
  },

  // Calculate total duration from array
  calculateTotalDuration(
    lessons: Array<{ duration_minutes?: number; duration?: number }>
  ): number {
    let total = 0;

    lessons.forEach((lesson) => {
      // Try duration_minutes first, fall back to duration
      const duration = lesson.duration_minutes ?? lesson.duration ?? 0;

      // Validate before adding
      const validation = this.validateDurationMinutes(duration);
      if (validation.isValid) {
        total += duration;
      } else {
        console.warn(`Invalid duration skipped: ${duration}`);
      }
    });

    return total;
  },

  // Range formatting for course previews
  formatDurationRange(minMinutes: number, maxMinutes: number): string {
    const minFormatted = this.formatDurationForDisplay(minMinutes);
    const maxFormatted = this.formatDurationForDisplay(maxMinutes);

    if (minFormatted === maxFormatted) return minFormatted;
    return `${minFormatted} - ${maxFormatted}`;
  },
};
```

---

## 📶 TIER 2: SESSION TRACKING

### Database Schema

```sql
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  
  -- Actual session tracking
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER DEFAULT 0,  -- KEY FIELD: actual session time
  last_accessed TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, lesson_id)  -- One record per (user, lesson) pair
);

-- Performance indexes
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);
```

### Session Tracking Service

**File**: `lib/lessonProgressService.ts`

```typescript
export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  completed: boolean;
  progress: number;
  last_accessed_at: string;
  completed_at?: string;
  time_spent_seconds?: number;
}

export const lessonProgressService = {
  
  // Main update function (called when user completes lesson)
  async updateLessonProgress(
    userId: string,
    lessonId: string,
    courseId: string,
    progress: number,      // 0-100%
    completed = false
  ) {
    // This is called via API: POST /api/lesson-progress/update
    const response = await fetch('http://localhost:3001/api/lesson-progress/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        lessonId,
        courseId,
        progress,
        completed,
        // typically session time is calculated server-side
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update lesson progress');
    }
    return await response.json();
  },

  // Retrieve single lesson session
  async getLessonProgress(userId: string, lessonId: string) {
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('userid', userId)
      .eq('lessonid', lessonId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  // Get all lessons in a course for a user
  async getUserLessonProgress(userId: string, courseId: string) {
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('userid', userId)
      .eq('courseid', courseId)
      .order('createdat', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Aggregate course statistics
  async getCourseLessonStats(userId: string, courseId: string) {
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('completed, progress')
      .eq('userid', userId)
      .eq('courseid', courseId);

    if (error) throw error;

    const progress = data || [];
    const totalLessons = progress.length;
    const completedLessons = progress.filter(l => l.completed).length;
    const avgProgress = totalLessons > 0
      ? progress.reduce((sum, l) => sum + l.progress, 0) / totalLessons
      : 0;

    return {
      totalLessons,
      completedLessons,
      progressPercentage: Math.round(avgProgress),
      completionRate: totalLessons > 0 
        ? (completedLessons / totalLessons) * 100 
        : 0,
    };
  },

  // Mark lesson complete (100% progress)
  async markLessonComplete(userId: string, lessonId: string, courseId: string) {
    return this.updateLessonProgress(userId, lessonId, courseId, 100, true);
  },

  // Reset lesson (clear progress)
  async resetLessonProgress(userId: string, lessonId: string) {
    const { error } = await supabase
      .from('lesson_progress')
      .update({
        progress: 0,
        completed: false,
        completedat: null,
        lastaccessedat: new Date().toISOString(),
      })
      .eq('userid', userId)
      .eq('lessonid', lessonId);

    if (error) throw error;
  },

  // Get only completed lessons
  async getCompletedLessons(userId: string, courseId: string) {
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('userid', userId)
      .eq('courseid', courseId)
      .eq('completed', true)
      .order('completedat', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Record milestone (e.g., reached 50% completion)
  async recordProgressMilestone(
    userId: string,
    courseId: string,
    milestonePercentage: number
  ) {
    const { data: existingMilestone, error: queryError } = await supabase
      .from('progress_milestones')
      .select('*')
      .eq('userid', userId)
      .eq('courseid', courseId)
      .eq('milestone', milestonePercentage)
      .single();

    if (queryError && queryError.code === 'PGRST116') {  // No record found
      const { data, error } = await supabase
        .from('progress_milestones')
        .insert([{
          userid: userId,
          courseid: courseId,
          milestone: milestonePercentage,
          recordedat: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  },
};
```

---

## 💾 TIER 3: AGGREGATE REPORTING

### Database Schema

```sql
-- Table 1: Learning hours (daily logging)
CREATE TABLE learning_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  hours NUMERIC DEFAULT 0,           -- Decimal hours (e.g., 1.5, 2.75)
  minutes INTEGER DEFAULT 0,          -- Remaining minutes component
  logged_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 2: User statistics (aggregate view)
CREATE TABLE user_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  courses_enrolled INTEGER DEFAULT 0,
  courses_completed INTEGER DEFAULT 0,
  total_learning_hours NUMERIC DEFAULT 0,  -- KEY FIELD: aggregate hours
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_learning_hours_userid ON learning_hours(userid);
CREATE INDEX idx_learning_hours_userid_date ON learning_hours(userid, logged_date);
CREATE INDEX idx_user_statistics_userid ON user_statistics(userid);
```

### Learning Hours Service

**File**: `lib/learningHoursService.ts`

```typescript
export interface LearningHours {
  id: string;
  userId: string;
  courseId: string;
  hoursSpent: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export const learningHoursService = {

  // Main recording function (called when session ends)
  async recordLearningHours(
    userId: string,
    courseId: string,
    hoursSpent: number,
    date?: string
  ) {
    try {
      // Use provided date or today
      const recordDate = date || new Date().toISOString().split('T')[0];
      
      // Step 1: Check if record exists for this user/course/date
      const { data: existing, error: queryError } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .eq('date', recordDate)
        .single();

      if (queryError && queryError.code !== 'PGRST116') throw queryError;

      if (existing) {
        // Step 2a: CUMULATIVE UPDATE - Add to existing
        const { data, error } = await supabase
          .from('learning_hours')
          .update({
            hoursspent: (existing.hoursspent || 0) + hoursSpent,
            updatedat: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Step 2b: CREATE NEW RECORD
        const { data, error } = await supabase
          .from('learning_hours')
          .insert([
            {
              userid: userId,
              courseid: courseId,
              hoursspent: hoursSpent,
              date: recordDate,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error recording learning hours:', error);
      throw error;
    }
  },

  // Retrieve today's hours
  async getTodayLearningHours(userId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('userid', userId)
        .eq('date', today);

      if (error) throw error;
      
      // Sum across all courses for this user today
      const totalHours = (data || []).reduce(
        (sum, record) => sum + (record.hoursspent || 0),
        0
      );
      return totalHours;
    } catch (error) {
      console.error('Error fetching today learning hours:', error);
      return 0;
    }
  },

  // Retrieve course-specific hours
  async getCourseLearningHours(userId: string, courseId: string) {
    try {
      // All entries for this user/course across all dates
      const { data, error } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (error) throw error;
      
      // Sum across all dates
      const totalHours = (data || []).reduce(
        (sum, record) => sum + (record.hoursspent || 0),
        0
      );
      return totalHours;
    } catch (error) {
      console.error('Error fetching course learning hours:', error);
      return 0;
    }
  },

  // Retrieve with date range
  async getUserLearningHours(
    userId: string,
    startDate?: string,
    endDate?: string
  ) {
    try {
      let query = supabase
        .from('learning_hours')
        .select('*')
        .eq('userid', userId);

      if (startDate) {
        query = query.gte('date', startDate);
      }
      
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query.order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user learning hours:', error);
      return [];
    }
  },

  // Weekly summary (last 7 days)
  async getWeeklyLearningHours(userId: string) {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const startDate = sevenDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      return await this.getUserLearningHours(userId, startDate, endDate);
    } catch (error) {
      console.error('Error fetching weekly learning hours:', error);
      return [];
    }
  },

  // Monthly summary (specific month or current)
  async getMonthlyLearningHours(
    userId: string,
    year?: number,
    month?: number
  ) {
    try {
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month !== undefined ? month : now.getMonth();

      // Create date range for the month
      const startDate = new Date(targetYear, targetMonth, 1)
        .toISOString()
        .split('T')[0];
      const endDate = new Date(targetYear, targetMonth + 1, 0)
        .toISOString()
        .split('T')[0];

      return await this.getUserLearningHours(userId, startDate, endDate);
    } catch (error) {
      console.error('Error fetching monthly learning hours:', error);
      return [];
    }
  },

  // Get course hours for specific date
  async getCourseLearningHoursByDate(courseId: string, date: string) {
    try {
      const { data, error } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('courseid', courseId)
        .eq('date', date);

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching course learning hours by date:', error);
      return [];
    }
  },

  // Delete a learning hours record
  async deleteLearningHours(id: string) {
    try {
      const { error } = await supabase
        .from('learning_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting learning hours:', error);
      throw error;
    }
  },
};
```

### User Statistics Service

**File**: `lib/userStatisticsService.ts`

```typescript
export interface UserStatistics {
  id: string;
  userId: string;
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  totalLearningHours: number;
  currentStreak: number;
  totalPoints: number;
  leaderboardRank?: number;
  lastActivityAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const userStatisticsService = {

  // Get or initialize user stats
  async getUserStatistics(userId: string) {
    try {
      const cacheKey = `cache:user_stats:${userId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('[STATS CACHE] Using cached:', userId);
        return cached;
      }

      const { data, error } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('userid', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        return await this.initializeUserStatistics(userId);
      }

      // Cache for 5 minutes
      cacheService.set(cacheKey, data, 5 * 60 * 1000);

      return data;
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      return null;
    }
  },

  // Initialize stats for new user
  async initializeUserStatistics(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_statistics')
        .insert([
          {
            userid: userId,
            totalcoursesenrolled: 0,
            coursescompleted: 0,
            totallearninghours: 0,
            currentstreak: 0,
            totalpoints: 0,
            leaderboardrank: null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error initializing user statistics:', error);
      return null;
    }
  },

  // Update total learning hours (called after recording hours)
  async updateLearningHours(userId: string, hoursSpent: number) {
    try {
      const stats = await this.getUserStatistics(userId);
      if (!stats) return null;

      // Add to existing total
      const newTotalHours = (stats.totallearninghours || 0) + hoursSpent;

      const { data, error } = await supabase
        .from('user_statistics')
        .update({
          totallearninghours: newTotalHours,
          lastactivityat: new Date().toISOString(),
        })
        .eq('userid', userId)
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      cacheService.remove(`cache:user_stats:${userId}`);

      return data;
    } catch (error) {
      console.error('Error updating learning hours:', error);
      throw error;
    }
  },
};
```

---

## 🔐 Row Level Security Policies

**File**: `supabase/migrations/20260405_fix_admin_dashboard_loading.sql`

```sql
-- Enable RLS on learning_hours table
ALTER TABLE IF EXISTS learning_hours ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read their own learning hours
DROP POLICY IF EXISTS "Users can read own learning hours" ON learning_hours;
CREATE POLICY "Users can read own learning hours"
ON learning_hours FOR SELECT
USING (auth.uid() = userid);

-- Policy 2: Admins can read all learning hours
DROP POLICY IF EXISTS "Admins can read all learning hours" ON learning_hours;
CREATE POLICY "Admins can read all learning hours"
ON learning_hours FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy 3: Service role (backend) has full access
DROP POLICY IF EXISTS "Service role can manage learning hours" ON learning_hours;
CREATE POLICY "Service role can manage learning hours"
ON learning_hours FOR ALL
USING (auth.role() = 'service_role');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_learning_hours_userid ON learning_hours(userid);
```

---

## 🎯 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER SESSION STARTS                         │
│                     (Opens lesson in browser)                       │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              FRONTEND: Timer starts tracking session                 │
│        (e.g., sessionStartTime = Date.now())                        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                    (User reads, watches, studies...)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│         USER FINISHES LESSON or Session expires                     │
│              (Clicks "Complete" or logout)                          │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    FRONTEND: Calculate session time                                 │
│    timeSpentSeconds = (Date.now() - sessionStartTime) / 1000       │
│    timeSpentHours = timeSpentSeconds / 3600                        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    API CALL 1: POST /api/lesson-progress/update                    │
│    ├─ userId                                                        │
│    ├─ lessonId                                                      │
│    ├─ courseId                                                      │
│    ├─ progress (0-100%)                                             │
│    ├─ completed (boolean)                                           │
│    └─ timeSpentSeconds (optional)                                   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    DATABASE: lesson_progress table UPDATE                           │
│    ├─ time_spent_seconds += calculated_time                        │
│    ├─ last_accessed = NOW()                                         │
│    ├─ is_completed = true (if finished)                             │
│    └─ completed_at = NOW() (if completed)                           │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    API CALL 2: recordLearningHours()                                │
│    ├─ Convert timeSpentSeconds to hours                             │
│    ├─ Check if record exists for (user, course, date)              │
│    ├─ If exists: ADD to existing hours (cumulative)                 │
│    └─ If not: CREATE new record                                     │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    DATABASE: learning_hours table INSERT/UPDATE                     │
│    ├─ user_id = userId                                              │
│    ├─ course_id = courseId                                          │
│    ├─ hours = calculated_hours                                      │
│    ├─ minutes = calculated_minutes                                  │
│    └─ logged_date = today's date                                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    API CALL 3: updateLearningHours()                                │
│    Get current user_statistics.total_learning_hours                 │
│    Add hours just recorded                                          │
│    Update user_statistics with new total                            │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│    DATABASE: user_statistics table UPDATE                           │
│    └─ total_learning_hours = previous + new_hours                  │
│       last_activity_date = today                                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CACHE: Invalidate user stats cache                     │
│              (Forces fresh load on next request)                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│          FRONTEND: Dashboard updates with new totals                │
│    ├─ Session time: X minutes on Lesson A                          │
│    ├─ Course time: Updated total for Course X                      │
│    └─ Total hours: Updated daily/weekly/monthly stats               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Configuration & Constants

```typescript
// Duration constraints (durationService.ts)
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 10080; // 7 * 24 * 60
const MINUTES_PER_HOUR = 60;

// Content-based duration factors (lessonService.ts)
const TEXT_READING_SPEED = 0.6;      // 0.6 min per 100 words
const PDF_MINUTES_PER_PAGE = 2;
const VIDEO_DEFAULT_MINUTES = 5;
const QUIZ_DEFAULT_MINUTES = 5;
const FLASHCARD_MINUTES_PER_CARD = 1.5;

// Cache expiration times
const USER_STATS_CACHE_TTL = 5 * 60 * 1000;        // 5 minutes
const COURSE_CACHE_TTL = 10 * 60 * 1000;           // 10 minutes
const FEEDBACK_CACHE_TTL = 15 * 60 * 1000;         // 15 minutes
const LESSONS_CACHE_TTL = 10 * 60 * 1000;          // 10 minutes
```

---

**Last Updated**: April 2026  
**Technical Detail Level**: Complete Implementation Reference
