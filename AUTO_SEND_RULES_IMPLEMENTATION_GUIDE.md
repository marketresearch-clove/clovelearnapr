# Auto-Send Notification Rules Backend Implementation Guide

## Overview

This document provides comprehensive instructions for implementing and deploying the auto-send notification rules system with backend processing, cron jobs, and event triggers.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Interface                           │
│            (AdvancedNotificationsPage.tsx)                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
          ┌───────▼────────┐
          │   Backend API  │
          │   Services     │
          └───────┬────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼──┐    ┌─────▼──┐    ┌────▼────┐
│ RPC  │    │ Webhook│    │ Edge    │
│Calls │    │Handler │    │Function │
└───┬──┘    └─────┬──┘    └────┬────┘
    │             │             │
    └─────────────┼─────────────┘
                  │
    ┌─────────────▼─────────────┐
    │     Supabase Database     │
    │  ┌──────────────────────┐ │
    │  │ Auto-Send Rules      │ │
    │  │ Execution Logs       │ │
    │  │ Processing Queue     │ │
    │  │ Event Triggers       │ │
    │  └──────────────────────┘ │
    └─────────────┬─────────────┘
                  │
    ┌─────────────▼──────────────┐
    │  Background Worker Service │
    │  (Cron Jobs & Webhooks)    │
    └────────────────────────────┘
```

## Components

### 1. Supabase Edge Function: `process-auto-notifications`

**Location:** `supabase/functions/process-auto-notifications/index.ts`

**Purpose:** 
- Central processing engine for auto-send rules
- Evaluates trigger conditions
- Creates and sends notifications
- Logs execution history

**How it works:**
1. Fetches all active auto-send rules
2. For each rule, identifies target users based on trigger type
3. Checks cooldowns and max sends per user
4. Creates notifications and logs executions

**Deployment:**
```bash
# Deploy the edge function
supabase functions deploy process-auto-notifications

# Or via Supabase CLI
supabase push
```

### 2. Background Worker Service: `notificationWorkerService.ts`

**Location:** `server/services/notificationWorkerService.ts`

**Purpose:**
- Manages scheduled cron jobs
- Calls the edge function periodically
- Handles webhook events
- Provides monitoring and health checks

**Cron Schedule:**
- `*/5 * * * *` - Process auto-send rules (every 5 minutes)
- `0 2 * * *` - Cleanup logs (daily at 2 AM)
- `0 * * * *` - Reset trigger evaluation (hourly)
- `*/10 * * * *` - Health check (every 10 minutes)

**Deployment:**
```bash
# As a service (Docker/Kubernetes)
docker build -t notification-worker -f Dockerfile.worker .
docker run notification-worker

# Environment variables:
# SUPABASE_URL=your_supabase_url
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Migrations

#### Migration 1: `20260414_auto_send_notification_rules_infrastructure.sql`

**Creates:**
- `notification_auto_send_rules` table
- `auto_send_rule_execution_log` table
- `notification_processing_queue` table
- `trigger_evaluation_history` table
- RLS policies
- Helper functions and utilities

**Apply:**
```bash
supabase db push
```

#### Migration 2: `20260414_add_realtime_event_triggers.sql`

**Creates:**
- Database triggers for enrollment events
- Database triggers for achievement events
- Database triggers for assignment completion
- Batch notification processor function
- Inactivity detection functions

**Apply:**
```bash
supabase db push
```

### 4. Enhanced Notification Service

**Location:** `server/services/enhancedNotificationService.ts`

**Purpose:**
- Evaluates trigger conditions for specific users
- Provides trigger-specific logic
- Manages notification eligibility checks
- Logs rule executions

**Key Methods:**
- `evaluateTrigger()` - Check if user matches trigger
- `canReceiveNotification()` - Check eligibility
- `createNotification()` - Create notification
- `logRuleExecution()` - Log execution
- `getRuleStats()` - Get rule statistics

## Implementation Steps

### Step 1: Apply Database Migrations

```bash
# Navigate to project root
cd /path/to/Skill-Spire-LMS

# Deploy migrations
supabase db push

# Verify tables exist
psql -h your_host -U postgres -d postgres -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'notification_%';"
```

### Step 2: Deploy Supabase Edge Function

```bash
# Deploy the edge function
supabase functions deploy process-auto-notifications

# Test the function
curl -X POST https://your-project.supabase.co/functions/v1/process-auto-notifications \
  -H "Authorization: Bearer your_anon_key" \
  -H "Content-Type: application/json"
```

### Step 3: Set Up Background Worker

```bash
# Install dependencies
npm install node-cron

# Create environment file
touch .env.worker
# Add:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Start worker
npx ts-node server/services/notificationWorkerService.ts
```

### Step 4: Update Frontend to Use Backend

**File:** `lib/notificationProcessor.ts`

Replace client-side processing with API calls:

```typescript
// OLD: Client-side processing
export async function runNotificationProcessing() {
  return await NotificationProcessor.processAutoSendRules();
}

// NEW: Call backend edge function
export async function runNotificationProcessing() {
  const { data, error } = await supabase.functions.invoke(
    'process-auto-notifications'
  );
  
  if (error) throw error;
  return data;
}
```

### Step 5: Set Up Cron Job Infrastructure

#### Option A: Using Supabase Database Functions

```sql
-- Call the edge function via pg_cron (if available)
SELECT cron.schedule('process-auto-notifications', '*/5 * * * *',
  'SELECT http_post(''https://your-project.supabase.co/functions/v1/process-auto-notifications'', ''
    {}''::(jsonb), 
    ''application/json''
  )'
);
```

#### Option B: Using External Service (Recommended)

**Option B1: AWS Lambda**
```javascript
// lambda_function.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const response = await fetch(
    'https://your-project.supabase.co/functions/v1/process-auto-notifications',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return { statusCode: response.status };
};
```

**Option B2: Google Cloud Scheduler + Cloud Function**
```yaml
# Create scheduled job
gcloud scheduler jobs create http process-auto-notifications \
  --schedule="*/5 * * * *" \
  --http-method=POST \
  --uri="https://your-project.supabase.co/functions/v1/process-auto-notifications" \
  --oidc-service-account-email=your-service-account@project.iam.gserviceaccount.com
```

**Option B3: Vercel Cron Jobs**
```typescript
// api/cron/process-notifications.ts
export default async function handler(req, res) {
  const response = await fetch(
    'https://your-project.supabase.co/functions/v1/process-auto-notifications',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  res.status(200).json({ success: true });
}
```

In `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/process-notifications",
    "schedule": "*/5 * * * *"
  }]
}
```

## Trigger Types

### 1. task_pending
- **Description:** User has pending tasks/assignments
- **Trigger Params:** `days_since` (default: 7)
- **Use Cases:** Remind about pending work

### 2. assignment_overdue
- **Description:** User has overdue assignments
- **Use Cases:** Urgent reminders

### 3. inactive_user
- **Description:** User hasn't logged in for X days
- **Trigger Params:** `days_inactive` (default: 7)
- **Use Cases:** Re-engagement campaigns

### 4. course_due
- **Description:** User's course is due soon
- **Trigger Params:** `days_before_due` (default: 3)
- **Use Cases:** Course deadline reminders

### 5. low_engagement
- **Description:** User has low course completion rate
- **Trigger Params:** `completion_threshold` (default: 25%)
- **Use Cases:** Motivation/support messages

### 6. course_not_started
- **Description:** User enrolled but hasn't started course
- **Trigger Params:** `days_after_assignment` (default: 0)
- **Use Cases:** Welcome messages, course kickoff

### 7. achievement_unlocked
- **Description:** User just unlocked an achievement
- **Use Cases:** Celebration messages, motivation

## Database Schema

### Tables

#### notification_auto_send_rules
```sql
CREATE TABLE notification_auto_send_rules (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES auth.users,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50),
  trigger_params JSONB,
  title VARCHAR(255),
  message TEXT,
  type VARCHAR(50),
  priority INTEGER,
  send_after_days INTEGER,
  max_sends_per_user INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### auto_send_rule_execution_log
```sql
CREATE TABLE auto_send_rule_execution_log (
  id UUID PRIMARY KEY,
  rule_id UUID REFERENCES notification_auto_send_rules,
  user_id UUID REFERENCES auth.users,
  notification_id UUID REFERENCES notifications,
  execution_status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP
);
```

#### notification_processing_queue
```sql
CREATE TABLE notification_processing_queue (
  id UUID PRIMARY KEY,
  rule_id UUID REFERENCES notification_auto_send_rules,
  user_id UUID REFERENCES auth.users,
  priority INTEGER,
  status VARCHAR(50),
  attempts INTEGER,
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Testing Guide

### Manual Testing

#### Test 1: Verify Edge Function Works

```bash
# Test endpoint
curl -X POST https://your-project.supabase.co/functions/v1/process-auto-notifications \
  -H "Authorization: Bearer your_service_role_key" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response:
{
  "success": true,
  "processed": 0,
  "failed": 0,
  "skipped": 0,
  "duration": 123,
  "timestamp": "2026-04-14T12:00:00Z"
}
```

#### Test 2: Create and Test Rule

```typescript
// Frontend code
const rule = {
  name: "Test Rule",
  description: "Test auto-send rule",
  trigger_type: "task_pending",
  trigger_params: { days_since: 7 },
  title: "You have pending tasks",
  message: "Complete your pending tasks",
  type: "reminder",
  priority: 2,
  send_after_days: 0,
  max_sends_per_user: 1,
  is_active: true
};

await advancedNotificationService.createAutoSendRule(rule);
```

#### Test 3: Verify Execution Log

```sql
-- Check execution logs
SELECT * FROM auto_send_rule_execution_log 
ORDER BY created_at DESC 
LIMIT 10;

-- Check rule statistics
SELECT 
  rule_id,
  COUNT(*) as total_executions,
  SUM(CASE WHEN execution_status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN execution_status = 'failed' THEN 1 ELSE 0 END) as failed
FROM auto_send_rule_execution_log
GROUP BY rule_id;
```

### Automated Testing

```typescript
// tests/autoSendRules.test.ts
import { describe, it, expect } from 'vitest';
import { enhancedNotificationService } from '../../server/services/enhancedNotificationService';

describe('Auto-Send Rules', () => {
  it('should evaluate task_pending trigger correctly', async () => {
    const result = await enhancedNotificationService.evaluateTrigger(
      'test-user-id',
      'task_pending',
      { days_since: 7 }
    );
    
    expect(result).toHaveProperty('matches');
    expect(result).toHaveProperty('reason');
  });

  it('should check notification eligibility', async () => {
    const result = await enhancedNotificationService.canReceiveNotification(
      'rule-id',
      'user-id',
      1
    );
    
    expect(result).toHaveProperty('canReceive');
    expect(result).toHaveProperty('reason');
  });

  it('should get rule statistics', async () => {
    const stats = await enhancedNotificationService.getRuleStats('rule-id');
    
    expect(stats).toHaveProperty('rule_id');
    expect(stats).toHaveProperty('total_executions');
    expect(stats).toHaveProperty('sent');
  });
});
```

## Monitoring & Logging

### View Processing Logs

```sql
-- Last 10 processing executions
SELECT * FROM auto_send_rule_execution_log 
ORDER BY created_at DESC 
LIMIT 10;

-- Failed executions
SELECT * FROM auto_send_rule_execution_log 
WHERE execution_status = 'failed'
ORDER BY created_at DESC;

-- Execution statistics by rule
SELECT 
  nar.name,
  COUNT(*) as total,
  SUM(CASE WHEN execution_status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN execution_status = 'failed' THEN 1 ELSE 0 END) as failed,
  MAX(created_at) as last_execution
FROM auto_send_rule_execution_log aerl
JOIN notification_auto_send_rules nar ON nar.id = aerl.rule_id
GROUP BY nar.id, nar.name
ORDER BY MAX(created_at) DESC;
```

### Real-Time Monitoring

```typescript
// Dashboard or monitoring page
import { supabase } from '@/lib/supabaseClient';

export async function getNotificationStats() {
  const { data: rules } = await supabase
    .from('notification_auto_send_rules')
    .select('id, name, is_active, (auto_send_rule_execution_log.count() as total_executions)')
    .eq('is_active', true);

  return rules;
}
```

## Troubleshooting

### Issue: Rules Not Triggering

**Solution:**
1. Verify edge function is deployed: `supabase functions list`
2. Check cron job is running
3. Verify rules are active in database
4. Check execution logs for errors: `SELECT * FROM auto_send_rule_execution_log WHERE execution_status = 'failed'`

### Issue: Notifications Not Being Created

**Solution:**
1. Verify `notifications` table exists
2. Check RLS policies on `notifications` table
3. Verify sender_id has permissions
4. Check PostgrSEQL error logs

### Issue: High Latency

**Solution:**
1. Check database query performance
2. Verify all indexes are created
3. Consider batch processing optimization
4. Monitor database connections

### Issue: Duplicate Notifications

**Solution:**
1. Verify cooldown is working: `SELECT * FROM auto_send_rule_execution_log WHERE user_id = 'test-user' ORDER BY created_at DESC`
2. Check `max_sends_per_user` is set correctly
3. Verify 24-hour cooldown logic

## Performance Optimization

### Database Query Optimization

```sql
-- Add indexes for better performance
CREATE INDEX ON auto_send_rule_execution_log (rule_id, user_id, created_at);
CREATE INDEX ON notification_auto_send_rules (is_active, trigger_type);
CREATE INDEX ON enrollments (user_id, deadline) WHERE progress < 100;
```

### Batch Processing

```typescript
// Process rules in batches
const BATCH_SIZE = 500;
const users = await getUsersForTrigger(triggerType);

for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(userId =>
    createNotification(userId, rule)
  ));
}
```

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Edge function deployed
- [ ] Background worker running
- [ ] Cron job configured
- [ ] RLS policies verified
- [ ] Test rules created and verified
- [ ] Monitoring enabled
- [ ] Logs being collected
- [ ] Notification templates created
- [ ] Alert rules configured

## Support & Next Steps

- Review logs in Supabase dashboard
- Test each trigger type individually
- Monitor notification delivery rates
- Gather user feedback
- Iterate on trigger logic and messaging
