# Certificate Signature Issue - Flow Diagrams

## ❌ BEFORE FIX - The Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL COURSE COMPLETION                      │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    markCourseAsCompleted()
                                ↓
                 issueCertificateIfEnabled()
                                ↓
                  Check: retake_count > 0?
                          (0 > 0? NO)
                                ↓
                      awardCertificate()
                                ↓
                   ✓ Certificate Created
                   ✓ Signatures Linked
                                ↓
                        enrollment.retake_count = 0
                     [USER GETS CERTIFICATE + SIGNATURES] ✓


┌─────────────────────────────────────────────────────────────────┐
│                         USER CLICKS RETAKE                        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                       enrollmentService.retakeCourse()
                                ↓
                   ✓ Delete old certificate
                   ✓ Delete signatures
                                ↓
                    enrollment.retake_count = 1
                   [OLD CERTIFICATE DELETED] ✓


┌─────────────────────────────────────────────────────────────────┐
│                   RETAKE COURSE COMPLETION                        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    markCourseAsCompleted()
                                ↓
                 issueCertificateIfEnabled()
                                ↓
                  Check: retake_count > 0?
                          (1 > 0? YES!)
                                ↓
              ❌ CERTIFICATE BLOCKED - RETURN NULL
                                ↓
                  [NO CERTIFICATE ISSUED] ✗
                 [NO SIGNATURES ASSIGNED] ✗


┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  PROBLEM: User can't get certificate on retake                   │
│  REASON: retake_count > 0 blocks ALL retakes                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ AFTER FIX - The Solution

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL COURSE COMPLETION                      │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    markCourseAsCompleted()
                                ↓
                 issueCertificateIfEnabled()
                                ↓
                  Check: retake_count > 1?
                          (0 > 1? NO)
                                ↓
                      awardCertificate()
                                ↓
                   ✓ Certificate Created
                   ✓ Backfill Enabled Signatures
                                ↓
                        enrollment.retake_count = 0
                     [USER GETS CERTIFICATE + SIGNATURES] ✓


┌─────────────────────────────────────────────────────────────────┐
│                         USER CLICKS RETAKE                        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                       enrollmentService.retakeCourse()
                                ↓
                   ✓ Delete old certificate
                   ✓ Delete signatures
                                ↓
                    enrollment.retake_count = 1
                   [OLD CERTIFICATE DELETED] ✓


┌─────────────────────────────────────────────────────────────────┐
│                   RETAKE COURSE COMPLETION                        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    markCourseAsCompleted()
                                ↓
                 issueCertificateIfEnabled()
                                ↓
                  Check: retake_count > 1?
                          (1 > 1? NO!)
                                ↓
                      awardCertificate()
                                ↓
                   ✓ New Certificate Created
                   ✓ Backfill Enabled Signatures
                                ↓
              [NEW CERTIFICATE ISSUED] ✓
             [SIGNATURES ASSIGNED] ✓


┌─────────────────────────────────────────────────────────────────┐
│                  2ND+ RETAKE COMPLETION                           │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                    markCourseAsCompleted()
                                ↓
                 issueCertificateIfEnabled()
                                ↓
                  Check: retake_count > 1?
                          (2 > 1? YES!)
                                ↓
              ✓ CERTIFICATE BLOCKED - RETURN NULL
                                ↓
                  [NO CERTIFICATE ISSUED] ✓
           [PREVENT INFINITE CERTIFICATE GENERATION] ✓


┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  SOLUTION: 3-tier policy                                         │
│    • First attempt (retake_count=0): Certificate ✓              │
│    • First retake (retake_count=1): Certificate ✓               │
│    • 2nd+ retakes (retake_count≥2): No Certificate ✓            │
│                                                                   │
│  RESULT: Users get one retake certificate, system protected     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Certificate Lifecycle - Detailed Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CERTIFICATE CREATION                          │
└──────────────────────────────────────────────────────────────────────┘

User Completes Course
    ↓
markCourseAsCompleted(userId, courseId)
    ├─ Update enrollment: completed = true
    ├─ Record skill achievements
    └─ issueCertificateIfEnabled(userId, courseId)
            ↓
            Fetch course: certificate_enabled?
            ├─ YES: Continue
            └─ NO: ❌ Return early (blocked by design)
            ↓
            Fetch enrollment: retake_count?
            ├─ IF retake_count > 1: ❌ BLOCKED (multiple retakes)
            ├─ IF retake_count = 0 or 1: ✓ CONTINUE
            ↓
            Check: Certificate already exists?
            ├─ YES: ❌ Return (already issued)
            ├─ NO: Continue
            ↓
            awardCertificate(userId, courseId)
                ├─ Call Edge Function: award-certificate
                │   └─ Creates certificate record
                │
                ├─ Fetch created certificate
                │
                ├─ Check: Has signatures?
                │   ├─ YES: ✓ Return with signatures
                │   ├─ NO: Attempt backfill
                │       └─ Get enabled signatures
                │           ├─ IF none enabled: ⚠️  Certificate with 0 sigs
                │           └─ IF some enabled: Link them
                │
                └─ Return certificate with signatures


┌──────────────────────────────────────────────────────────────────────┐
│                        RETAKE PROCESS                                 │
└──────────────────────────────────────────────────────────────────────┘

User Clicks "Retake Course"
    ↓
enrollmentService.retakeCourse(userId, courseId)
    ├─ Delete lesson progress
    ├─ Delete quiz results
    ├─ Delete assessment results
    ├─ DELETE CERTIFICATE + SIGNATURES ⭐
    ├─ Delete learning hours
    ├─ Delete skill achievements
    ├─ Reset enrollment:
    │   ├─ progress = 0
    │   ├─ completed = false
    │   └─ retake_count = retake_count + 1 ⭐
    └─ Update statistics


┌──────────────────────────────────────────────────────────────────────┐
│                     RETAKE COMPLETION                                 │
└──────────────────────────────────────────────────────────────────────┘

User Completes Retake
    ↓
markCourseAsCompleted(userId, courseId)
    ↓
issueCertificateIfEnabled(userId, courseId)
    ├─ Fetch enrollment: retake_count = 1
    ├─ Check: retake_count > 1?
    │   └─ NO (1 > 1? NO) ✓ CONTINUE TO AWARD
    │
    └─ awardCertificate(userId, courseId)
        ├─ Create NEW certificate
        ├─ Backfill signatures
        └─ Return with signatures ✓
```

---

## 🎯 Key Decision Points

### Retake Check (Line 83)

```javascript
if (enrollment && enrollment.retake_count > 1) {
  // BLOCK - Multiple retakes not allowed
  return { issued: false };
}
// ALLOW - First attempt or first retake
return awardCertificate(...);
```

| Scenario | retake_count | Check (> 1) | Result |
|----------|-------------|-----------|--------|
| First completion | 0 | 0 > 1? NO | ✓ Award cert |
| First retake | 1 | 1 > 1? NO | ✓ Award cert |
| Second+ retake | 2+ | 2+ > 1? YES | ❌ Block |

---

## 📈 Certificate Count per User/Course

| Stage | Action | cert_count | Has Sigs |
|-------|--------|-----------|----------|
| Initial | Complete → Award | 1 | ✓ Yes |
| Retake | Retake → Delete | 0 | - |
| Retake Complete | Complete → Award | 1 | ✓ Yes |
| 2nd Retake | Retake → Delete | 0 | - |
| 2nd Complete | Complete → Block | 0 | - |

---

## 🔍 Signature Backfill Logic

```
Certificate Created (by edge function)
    ↓
Fetch certificate with signatures
    ├─ signatures.length > 0? ✓ Return as-is
    └─ signatures.length = 0? Continue
        ↓
        Get enabled signatures
        ├─ count > 0?
        │  ├─ YES: Insert into certificate_signatures
        │  │       └─ Backfill complete ✓
        │  └─ NO: ⚠️  No enabled signatures in system
        │         └─ Certificate issued with 0 sigs
        ↓
        Re-fetch certificate
        └─ Return with whatever signatures exist
```

---

## 🛠️ Diagnostic Tools Available

### Option 1: API Endpoint
```bash
GET /api/admin/diagnose-certificate?certificateId=<ID>&autoBackfill=true
└─ Returns: Status, issues, recommendations, attempts repair
```

### Option 2: Utility Functions
```typescript
await certificateDiagnosticUtil.diagnosticCertificate(id)
await certificateDiagnosticUtil.autoRepairAllCertificates()
await certificateDiagnosticUtil.getHealthStatistics()
```

### Option 3: Manual Backfill
```typescript
await certificateBackfillService.backfillAllMissingSignatures()
```

---

**Ready to deploy! 🚀**
