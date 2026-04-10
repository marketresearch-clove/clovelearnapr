/**
 * Diagnostic Script: Certificate Signature Issue Investigation
 *
 * Purpose: Investigate why certificates are issued without signatures after course retake
 *
 * Certificate ID: 75b15cfa-97e0-4aff-b2ad-fdf6b14fa034
 */

import { supabase } from './lib/supabaseClient';

async function diagnoseCertificate() {
  const certificateId = '75b15cfa-97e0-4aff-b2ad-fdf6b14fa034';

  console.log('\n========== CERTIFICATE DIAGNOSTIC ==========');
  console.log(`Certificate ID: ${certificateId}\n`);

  // 1. Check certificate details
  console.log('1. CERTIFICATE DETAILS:');
  const { data: cert, error: certError } = await supabase
    .from('certificates')
    .select(`
      id,
      user_id,
      course_id,
      issued_at,
      template_id,
      courses:course_id (
        id,
        title,
        certificate_enabled
      ),
      profiles:user_id (
        fullname,
        email
      )
    `)
    .eq('id', certificateId)
    .single();

  if (certError) {
    console.error('  ❌ Error fetching certificate:', certError.message);
    return;
  }

  if (!cert) {
    console.error('  ❌ Certificate not found');
    return;
  }

  console.log(`  ✓ User: ${cert.profiles?.fullname} (${cert.user_id})`);
  console.log(`  ✓ Course: ${cert.courses?.title} (${cert.course_id})`);
  console.log(`  ✓ Certificate Enabled: ${cert.courses?.certificate_enabled}`);
  console.log(`  ✓ Issued At: ${cert.issued_at}`);
  console.log(`  ✓ Template ID: ${cert.template_id || 'None'}`);

  // 2. Check certificate signatures
  console.log('\n2. CERTIFICATE SIGNATURES:');
  const { data: signatures, error: sigError } = await supabase
    .from('certificate_signatures')
    .select('*')
    .eq('certificate_id', certificateId);

  if (sigError) {
    console.error('  ❌ Error fetching signatures:', sigError.message);
  } else {
    if (!signatures || signatures.length === 0) {
      console.log('  ⚠️  NO SIGNATURES FOUND');
    } else {
      console.log(`  ✓ Found ${signatures.length} signature(s):`);
      signatures.forEach((sig, idx) => {
        console.log(`    ${idx + 1}. ${sig.signature_name} (${sig.signature_designation})`);
        console.log(`       Image: ${sig.signature_image_url ? 'Yes' : 'No'}`);
        console.log(`       Text: ${sig.signature_text ? 'Yes' : 'No'}`);
      });
    }
  }

  // 3. Check enrollment status
  console.log('\n3. ENROLLMENT STATUS:');
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select('*')
    .eq('userid', cert.user_id)
    .eq('courseid', cert.course_id)
    .single();

  if (enrollError) {
    console.error('  ❌ Error fetching enrollment:', enrollError.message);
  } else if (enrollment) {
    console.log(`  ✓ Completed: ${enrollment.completed}`);
    console.log(`  ✓ Retake Count: ${enrollment.retake_count}`);
    console.log(`  ✓ Completed At: ${enrollment.completedat || 'N/A'}`);
    console.log(`  ✓ Progress: ${enrollment.progress}%`);
  }

  // 4. Check available signatures (enabled)
  console.log('\n4. AVAILABLE SIGNATURES IN SYSTEM:');
  const { data: availableSigs, error: availError } = await supabase
    .from('certificate_signature_settings')
    .select('*')
    .eq('is_enabled', true)
    .order('display_order', { ascending: true });

  if (availError) {
    console.error('  ❌ Error fetching available signatures:', availError.message);
  } else {
    if (!availableSigs || availableSigs.length === 0) {
      console.log('  ⚠️  NO ENABLED SIGNATURES IN SYSTEM');
    } else {
      console.log(`  ✓ Found ${availableSigs.length} enabled signature(s):`);
      availableSigs.forEach((sig, idx) => {
        console.log(`    ${idx + 1}. ${sig.name} (${sig.designation})`);
        console.log(`       Enabled: Yes`);
      });
    }
  }

  // 5. Check if there are any other certificates for this user/course combination
  console.log('\n5. OTHER CERTIFICATES FOR THIS USER/COURSE:');
  const { data: allCerts, error: allCertsError } = await supabase
    .from('certificates')
    .select('id, issued_at')
    .eq('user_id', cert.user_id)
    .eq('course_id', cert.course_id)
    .order('issued_at', { ascending: false });

  if (allCertsError) {
    console.error('  ❌ Error fetching all certificates:', allCertsError.message);
  } else {
    if (!allCerts || allCerts.length === 0) {
      console.log('  ⚠️  No other certificates found');
    } else {
      console.log(`  ✓ Found ${allCerts.length} certificate(s):`);
      allCerts.forEach((c, idx) => {
        const isTarget = c.id === certificateId ? ' ← TARGET' : '';
        console.log(`    ${idx + 1}. ${c.id} (${c.issued_at})${isTarget}`);
      });
    }
  }

  // 6. Root cause analysis
  console.log('\n6. ROOT CAUSE ANALYSIS:');

  if (!signatures || signatures.length === 0) {
    if (!availableSigs || availableSigs.length === 0) {
      console.log('  🔴 ISSUE: No enabled signatures in system');
      console.log('     → When certificate was issued, there were no enabled signatures to link');
      console.log('     → Backfill also found no signatures to add');
      console.log('\n  SOLUTION: Create and enable signature settings first');
    } else {
      console.log('  🔴 ISSUE: Signatures not linked to certificate during issuance');
      console.log('     → Edge function "award-certificate" may not be linking signatures');
      console.log('     → OR backfill logic failed silently');
      console.log('\n  SOLUTION: Check edge function OR run backfill manually');
    }

    // Try to backfill
    console.log('\n7. ATTEMPTING BACKFILL:');
    try {
      const { certificateBackfillService } = await import('./lib/certificateBackfillService');
      const backfillResult = await certificateBackfillService.backfillCertificateSignatures(certificateId);
      if (backfillResult.success) {
        console.log(`  ✓ Backfill successful: Added ${backfillResult.signaturesAdded} signatures`);
      } else {
        console.log(`  ❌ Backfill failed: ${backfillResult.error}`);
      }
    } catch (e) {
      console.error('  ❌ Error during backfill:', e);
    }
  } else {
    console.log('  ✓ Signatures ARE linked properly');
  }

  // 8. Check retake flow logic
  if (enrollment) {
    console.log('\n8. RETAKE FLOW CHECK:');
    console.log(`  Retake Count: ${enrollment.retake_count}`);
    if (enrollment.retake_count > 0) {
      console.log('  ⚠️  User has retaken this course');
      console.log('     → issueCertificateIfEnabled() will BLOCK certificate issuance');
      console.log('     → This is the intended behavior to prevent duplicate certificates');
    } else {
      console.log('  ✓ First attempt (no retake)');
    }
  }
}

diagnoseCertificate().catch(console.error);
