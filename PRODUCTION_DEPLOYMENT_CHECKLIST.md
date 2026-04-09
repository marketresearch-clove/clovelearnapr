# Production Deployment Checklist
**Date**: April 10, 2026
**Version**: 2.0 (Production Ready)
**Status**: ✅ Ready for Deployment

---

## 📋 Pre-Deployment Checks (Do These First!)

### Database Preparation

- [ ] **Backup production database**
  ```bash
  pg_dump -h prod.db.supabase.co -U postgres -d lms_db > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
  *Estimated time: 5-15 minutes depending on size*

- [ ] **Test all migrations on staging environment first**
  ```bash
  supabase migration run --project-id=staging_project_id migrations/20260410_*.sql
  ```
  *Estimated time: 2 minutes*

- [ ] **Verify staging environment passes health checks**
  - [ ] Can query all new views (v_user_learning_summary, v_course_learning_summary, etc.)
  - [ ] New RPC function exists and is callable
  - [ ] New tables have correct indexes
  - [ ] RLS policies are in place

- [ ] **Review SQL code in all migration files**
  - [ ] Check for typos in table/column names
  - [ ] Verify schema matches your database
  - [ ] Confirm column names use your naming convention (user_id, course_id, lesson_id)
  - [ ] Review RLS policies match your security model

- [ ] **Check Supabase CLI version**
  ```bash
  supabase --version  # Should be >= 1.88.0
  ```

### Team Preparation

- [ ] **Notify team of 30-minute maintenance window**
  - [ ] Schedule for low-traffic time (e.g., 2 AM)
  - [ ] Send calendar invite to stakeholders
  - [ ] Prepare communication for users if needed

- [ ] **Review frontend changes with development team**
  - [ ] Confirm all API calls can be updated
  - [ ] Verify UUID generation library available (uuid v4)
  - [ ] Plan for gradual rollout (canary deployment)

- [ ] **Prepare rollback procedure**
  - [ ] Document rollback SQL commands
  - [ ] Have old service code ready to redeploy
  - [ ] Test rollback on staging environment

- [ ] **Brief ops team on monitoring**
  - [ ] Show how to check v_transaction_health
  - [ ] Explain how to resolve reconciliation alerts
  - [ ] Set up webhooks for critical alerts

### Code Review

- [ ] **Review all migration SQL**
  - [ ] migration/20260410_08_add_idempotency_tracking.sql
  - [ ] migration/20260410_09_enhanced_record_learning_session_rpc.sql
  - [ ] migration/20260410_10_fix_view_overcounting.sql

- [ ] **Review service code**
  - [ ] lib/services_final_hardened.ts (retry logic, analytics, monitoring)
  - [ ] Confirm all function signatures match frontend expectations

- [ ] **Check for breaking changes**
  - [ ] Old RPC is replaced (frontend MUST update to new signature)
  - [ ] Views are read-only (no impact on existing queries)
  - [ ] New tables have RLS (safe for multi-tenant)

---

## 🚀 Deployment (Execution Phase)

### Phase 1: Apply Database Migrations (No Downtime)

**Time**: 5-10 minutes | **Risk**: Low (additive only, no data deletion)

```bash
# Step 1: Apply migration 08 (idempotency tracking)
supabase migration run --path migrations/20260410_08_add_idempotency_tracking.sql
# Expected: ✓ Table learning_transaction_log created
# Expected: ✓ Table reconciliation_alerts created
# Expected: ✓ Views v_transaction_health created
# Expected: ✓ Indexes created successfully

# Verify
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name IN ('learning_transaction_log', 'reconciliation_alerts');
# Should return: 2
```

- [ ] **Verify migration 08 succeeded**
  ```sql
  SELECT COUNT(*) FROM learning_transaction_log;  -- Should be 0 (empty)
  SELECT COUNT(*) FROM reconciliation_alerts;     -- Should be 0 (empty)
  \d learning_hours  -- Check for idx_learning_hours_unique index
  ```

- [ ] **Apply migration 09 (enhanced RPC)**
  ```bash
  supabase migration run --path migrations/20260410_09_enhanced_record_learning_session_rpc.sql
  # Expected: ✓ Function record_learning_session(v2) created
  # Expected: ✓ Signature now includes p_idempotency_key parameter
  ```

- [ ] **Verify RPC exists and has correct signature**
  ```sql
  SELECT p.proname, pg_get_function_arguments(p.oid)
  FROM pg_proc p
  WHERE p.proname = 'record_learning_session';
  -- Should show: p_user_id, p_lesson_id, p_course_id, ..., p_idempotency_key, p_client_ip, p_user_agent
  ```

- [ ] **Apply migration 10 (fix views)**
  ```bash
  supabase migration run --path migrations/20260410_10_fix_view_overcounting.sql
  # Expected: ✓ 5 views created/updated with safe aggregation
  ```

- [ ] **Verify views are queryable**
  ```sql
  SELECT COUNT(*) FROM v_user_learning_summary;      -- Should work
  SELECT COUNT(*) FROM v_user_course_progress;       -- Should work
  SELECT COUNT(*) FROM v_course_learning_summary;    -- Should work
  SELECT COUNT(*) FROM v_lesson_learning_stats;      -- Should work
  SELECT COUNT(*) FROM v_daily_learning_summary;     -- Should work
  
  -- All should return 0 if no data, or >0 with actual data
  ```

### Phase 2: Deploy Service Layer (Coordinated with Frontend)

**Time**: 5 minutes | **Risk**: Medium (requires frontend update)**

- [ ] **Create feature branch for services**
  ```bash
  git checkout -b feature/hardened-learning-hours
  cp lib/services_final_hardened.ts lib/learningHoursService.ts
  cp lib/services_final_hardened.ts lib/learningSessionService.ts
  ```

- [ ] **Update frontend API calls**
  ```typescript
  // In all places where recordLearningSession is called:
  import { v4 as uuidv4 } from 'uuid';
  
  const result = await learningHoursService.recordLearningSession(
    userId,
    lessonId,
    courseId,
    durationSeconds,
    progressPercent,
    completed,
    uuidv4()  // ← NEW: idempotency key
  );
  
  if (result.success) {
    console.log(`Recorded session (retry_count: ${result.retry_count})`);
  } else {
    console.error(`Failed: ${result.error}`);
  }
  ```

- [ ] **Push to feature branch and create PR**
  ```bash
  git add .
  git commit -m "feat: hardened learning hours with idempotency and monitoring
  
  Implements all 10 critical fixes:
  - #1: Idempotency tracking
  - #2: Race condition safety
  - #3: Session integration
  - #4: Input validation
  - #5: Explicit indexes
  - #6: Safe view aggregation
  - #7: Retry strategy
  - #8: Analytics hooks
  - #9: Idle time persistence
  - #10: Monitoring/alerting
  
  Coordinated deployment:
  1. Database migrations (production)
  2. Service layer (staging)
  3. Frontend update (staging)
  4. Smoke tests
  5. Gradual rollout to production
  "
  
  git push origin feature/hardened-learning-hours
  ```

- [ ] **Code review approval**
  - [ ] At least 2 reviewers approved
  - [ ] CI/CD tests passing
  - [ ] No breaking changes in contract

- [ ] **Merge to main**
  ```bash
  git checkout main
  git pull
  git merge feature/hardened-learning-hours
  ```

- [ ] **Deploy to staging environment first**
  - [ ] Merge to staging branch
  - [ ] Deploy via CI/CD pipeline
  - [ ] Wait for all services to be healthy

### Phase 3: Smoke Tests (Production Ready?)

**Time**: 10 minutes | **Risk**: None (read-only tests on production)**

```bash
# Run smoke tests
npm run test:smoke -- --environment=staging
```

- [ ] **Test 1: RPC with valid inputs**
  ```typescript
  const result = await recordLearningSession(
    userId,
    lessonId,
    courseId,
    3600,  // 1 hour
    75,    // 75% progress
    false,
    uuidv4()
  );
  
  ASSERT.equal(result.success, true);
  ASSERT.notNull(result.lesson_progress_id);
  ASSERT.notNull(result.learning_hours_id);
  ASSERT.notNull(result.learning_session_id);
  ```

- [ ] **Test 2: Idempotency (same key twice)**
  ```typescript
  const key = uuidv4();
  const result1 = await recordLearningSession(..., key);
  const result2 = await recordLearningSession(..., key);
  
  ASSERT.equal(result1.success, true);
  ASSERT.equal(result2.success, true);
  ASSERT.equal(result2.message, 'Duplicate request (cached result)');
  // Verify no double-count in database
  ASSERT.equal(result1.lesson_progress_id, result2.lesson_progress_id);
  ```

- [ ] **Test 3: Validation (invalid progress)**
  ```typescript
  const result = await recordLearningSession(..., 150, ...);  // >100
  
  ASSERT.equal(result.success, false);
  ASSERT.includes(result.error, 'Progress');
  ```

- [ ] **Test 4: View query (no errors)**
  ```typescript
  const summary = await learningHoursService.getUserLearningSummary(userId);
  ASSERT.notNull(summary);
  ASSERT.isNumber(summary.total_hours);
  ASSERT.isNumber(summary.completion_percentage);
  ```

- [ ] **Test 5: Monitoring alert creation**
  ```typescript
  const alerts = await monitoringService.getOpenAlerts(userId);
  ASSERT.isArray(alerts);
  // May be empty if no issues
  ```

- [ ] **Test 6: Analytics event tracking**
  ```sql
  SELECT COUNT(*) FROM analytics_events 
  WHERE event_name = 'lesson_session_recorded'
  AND created_at > NOW() - INTERVAL '10 minutes';
  -- Should be >0
  ```

### Phase 4: Production Deployment

**Time**: 5 minutes | **Risk**: Medium (coordinated release)**

- [ ] **Announce deployment to team**
  - [ ] Slack notification
  - [ ] Status page update
  - [ ] Ops team on standby

- [ ] **Deploy to production (if using CI/CD)**
  ```bash
  git tag v2.0-hardened-learning-hours
  git push origin v2.0-hardened-learning-hours
  # CI/CD pipeline deploys to production
  ```

  OR **Manual deployment**:
  ```bash
  # Deploy new services to all servers
  rsync -av lib/services_final_hardened.ts /app/lib/
  
  # Restart application server
  systemctl restart app
  
  # Verify health
  curl http://localhost:3000/health
  # Expected: 200 OK
  ```

- [ ] **Verify production deployment**
  ```bash
  # Check that new service code is running
  curl http://production-api/api/status | jq .services_version
  # Expected: 2.0 or similar
  ```

---

## 📊 Post-Deployment Monitoring (24-48 Hours)

### Hour 0-1: Immediate Checks

- [ ] **Check API health**
  ```sql
  SELECT 
    hour,
    total_transactions,
    success_rate_pct,
    duplicates,
    errors
  FROM v_transaction_health
  ORDER BY hour DESC LIMIT 1;
  
  -- Expected:
  -- - success_rate_pct > 99%
  -- - errors < 1% of total
  -- - duplicates < 1% of total (shows retry handling working)
  ```

- [ ] **Check for any errors in logs**
  ```bash
  # Application logs
  tail -f /var/log/app.log | grep -i error
  
  # Database logs
  tail -f /var/log/postgres.log | grep ERROR
  
  # Expected: No new ERROR patterns
  ```

- [ ] **Verify idempotency working**
  ```sql
  SELECT status, COUNT(*) FROM learning_transaction_log
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY status;
  
  -- Expected:
  -- SUCCESS | 150
  -- DUPLICATE | 5  (shows retry happened)
  -- ERROR | <1
  ```

- [ ] **Check monitoring alerts**
  ```sql
  SELECT severity, COUNT(*) FROM reconciliation_alerts
  WHERE status = 'OPEN'
  AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY severity;
  
  -- Expected: Very few or none (0 is ideal)
  ```

### Hour 1-8: Continued Monitoring

- [ ] **Check views don't have stale data**
  ```sql
  -- Pick a user and verify view data matches source
  SELECT 
    SUM(time_spent_seconds) / 3600 as computed_hours,
    (SELECT total_hours FROM v_user_learning_summary WHERE user_id = $1) as view_hours
  FROM lesson_progress
  WHERE user_id = $1;
  
  -- Should be approximately equal (within rounding error)
  ```

- [ ] **Verify no data corruption**
  ```sql
  -- Check for any NULL or anomalous values
  SELECT lesson_id FROM lesson_progress
  WHERE time_spent_seconds IS NULL
  OR time_spent_seconds < 0
  OR time_spent_seconds > 86400;
  
  -- Expected: Empty result set
  ```

- [ ] **Monitor database performance**
  ```sql
  -- Check slow queries
  SELECT query, calls, mean_time, max_time
  FROM pg_stat_statements
  WHERE mean_time > 100  -- >100ms average
  ORDER BY mean_time DESC
  LIMIT 10;
  
  -- Expected: No new slow queries
  ```

### Hour 8-24: Full Health Check

- [ ] **Run reconciliation job**
  ```sql
  SELECT * FROM reconcile_learning_hours(24);
  
  -- Should find 0 discrepancies (or very few)
  ```

- [ ] **Check performance baselines**
  ```sql
  -- View performance should improve
  EXPLAIN ANALYZE SELECT * FROM v_user_course_progress WHERE user_id = $1;
  -- Expected: <100ms (was ~200ms before)
  
  -- RPC should still be acceptable
  EXPLAIN ANALYZE SELECT * FROM record_learning_session(...);
  -- Expected: <200ms total
  ```

- [ ] **Database table sizes**
  ```sql
  SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
  
  -- learning_transaction_log should grow at ~1-2 MB/day
  ```

- [ ] **Index usage**
  ```sql
  SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  AND idx_scan > 0
  ORDER BY idx_scan DESC;
  
  -- idx_learning_hours_unique should have high idx_scan count
  ```

### Day 1-2: Comprehensive Assessment

- [ ] **Check for regressions**
  - [ ] No increase in support tickets
  - [ ] No performance degradation
  - [ ] No data corruption reports

- [ ] **Review analytics dashboard**
  - [ ] Success rate sustained >99%
  - [ ] Retry rate <2% (shows mostly healthy)
  - [ ] No alert spam

- [ ] **Gather team feedback**
  - [ ] Frontend team: API working as expected?
  - [ ] Ops team: Any monitoring issues?
  - [ ] Users: Any reports of missing hours?

---

## 🔄 Rollback Procedure (If Needed)

**Time**: 5-10 minutes | **Risk**: Low (reverting to known good state)**

### Decision Point

- [ ] **Determine if rollback is needed**
  - [ ] Success rate dropped below 95%?
  - [ ] Data corruption detected?
  - [ ] Critical bug in RPC?
  - [ ] Example: YES → Proceed with rollback

### Rollback Steps

```bash
# Step 1: Revert service code
git revert HEAD  # Assuming last commit was service layer
# OR manually restore old version:
git checkout HEAD~1 -- lib/learningHoursService.ts
git checkout HEAD~1 -- lib/learningSessionService.ts
systemctl restart app

# Step 2: Restore old RPC from backup
psql -h prod.db.supabase.co -U postgres -d lms_db < old_rpc_backup.sql

# Step 3: Restore old views (if they were broken)
psql -h prod.db.supabase.co -U postgres -d lms_db < old_views_backup.sql

# Step 4: Verify rollback
SELECT COUNT(*) FROM learning_transaction_log;  -- Still there, harmless
SELECT COUNT(*) FROM reconciliation_alerts;     -- Still there, harmless

# Step 5: Communicate status
# Slack: ⚠️ Rolling back learning hours to v1.9.2 due to [REASON]
# Status page: Investigating issue, may have degraded service
```

### Post-Rollback

- [ ] **Verify production is stable**
  ```sql
  SELECT success_rate_pct FROM v_transaction_health ORDER BY hour DESC LIMIT 1;
  -- Should return to >99.5%
  ```

- [ ] **Notify stakeholders**
  - [ ] Explain what went wrong
  - [ ] Timeline to re-deployment
  - [ ] No data was lost

- [ ] **Root cause analysis**
  - [ ] Which specific fix caused the issue?
  - [ ] Can we fix it safely?
  - [ ] Test on staging again

- [ ] **Re-deploy when ready**
  - [ ] Fix the issue in code
  - [ ] Deploy to staging first
  - [ ] Full testing cycle
  - [ ] Then production

---

## ✅ Sign-Off Checklist

**Complete ONLY after all above steps are done and verified!**

- [ ] **Database migrations applied successfully**
  - [ ] 20260410_08_add_idempotency_tracking.sql ✓
  - [ ] 20260410_09_enhanced_record_learning_session_rpc.sql ✓
  - [ ] 20260410_10_fix_view_overcounting.sql ✓

- [ ] **Service layer deployed**
  - [ ] lib/services_final_hardened.ts in production ✓
  - [ ] All functions callable and working ✓
  - [ ] Retry strategy confirmed working ✓

- [ ] **Frontend updated**
  - [ ] All recordLearningSession calls include uuidv4() ✓
  - [ ] Error handling in place ✓
  - [ ] Deployed to production ✓

- [ ] **Monitoring active**
  - [ ] v_transaction_health queryable ✓
  - [ ] Reconciliation job scheduled ✓
  - [ ] Alerts configured and tested ✓

- [ ] **24-hour monitoring passed**
  - [ ] Success rate >99% ✓
  - [ ] No data corruption detected ✓
  - [ ] No alert spam ✓
  - [ ] Performance baseline met ✓

- [ ] **Team trained**
  - [ ] Ops knows how to check health ✓
  - [ ] Ops knows how to resolve alerts ✓
  - [ ] Devs know the new API contract ✓
  - [ ] Support knows about new features (idle tracking, analytics) ✓

---

## 📞 Rollback Contacts

In case of emergency, contact:
- [ ] **Database Engineer**: [Name + Phone]
- [ ] **DevOps Lead**: [Name + Phone]
- [ ] **Frontend Lead**: [Name + Phone]
- [ ] **On-Call Engineer**: [PagerDuty Link]

---

## 📝 Deployment Notes

**Start Time**: _______________
**End Time**: _______________
**Issues**: _______________
**Resolution**: _______________
**Approved By**: _______________
**Date**: _______________

---

**🎉 Deployment Complete!**

Your learning hours system is now enterprise-grade with professional reliability.

For questions or issues, refer to:
- `FINAL_HARDENED_IMPLEMENTATION_GUIDE.md` (comprehensive setup)
- `FIX_QUICK_REFERENCE.md` (10 fixes explained)
- `migrations/` (exact SQL to run)
- `lib/services_final_hardened.ts` (service code)
