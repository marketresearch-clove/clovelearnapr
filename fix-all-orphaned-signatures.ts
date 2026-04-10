/**
 * Bulk Certificate Signature Fixer
 *
 * Finds ALL certificates without signatures and links them to enabled signatures.
 *
 * Usage: npx ts-node fix-all-orphaned-signatures.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixAllOrphanedSignatures() {
  console.log(`\n🔍 Finding all certificates without signatures...\n`);

  try {
    // Get all certificates with their signatures count
    const { data: allCerts, error: findError } = await supabase
      .from('certificates')
      .select('id, user_id, course_id, issued_at, certificate_signatures(id)', { count: 'exact' });

    if (findError) {
      console.error(`❌ Error finding certificates: ${findError.message}`);
      process.exit(1);
    }

    // Filter certificates without signatures
    const certsWithoutSigs = (allCerts || []).filter(
      (cert: any) => !cert.certificate_signatures || cert.certificate_signatures.length === 0
    );

    const orphanedCount = certsWithoutSigs?.length || 0;
    console.log(`Found: ${orphanedCount} certificates without signatures\n`);

    if (orphanedCount === 0) {
      console.log('✅ All certificates have signatures! Nothing to fix.\n');
      return;
    }

    // Get enabled signatures
    console.log('🔧 Fetching enabled signatures...');
    const { data: enabledSignatures, error: sigError } = await supabase
      .from('certificate_signature_settings')
      .select('*')
      .eq('is_enabled', true)
      .order('display_order', { ascending: true });

    if (sigError || !enabledSignatures || enabledSignatures.length === 0) {
      console.error(`\n❌ No enabled signatures found in the system`);
      console.error('Go to Admin → Settings → Signatures and enable at least one signature\n');
      process.exit(1);
    }

    const sigCount = enabledSignatures.length;
    console.log(`Found: ${sigCount} enabled signatures`);
    enabledSignatures.forEach((sig: any) => {
      console.log(`   ✓ ${sig.name} (${sig.designation})`);
    });

    // Fix each certificate
    console.log(`\n🔧 Fixing ${orphanedCount} certificates...\n`);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < (certsWithoutSigs?.length || 0); i++) {
      const cert = certsWithoutSigs![i];

      // Get course title for logging
      const { data: course } = await supabase
        .from('courses')
        .select('title')
        .eq('id', cert.course_id)
        .single();

      const courseTitle = course?.title || 'Unknown Course';

      // Get user name for logging
      const { data: profile } = await supabase
        .from('profiles')
        .select('fullname')
        .eq('id', cert.user_id)
        .single();

      const userName = profile?.fullname || 'Unknown User';

      // Create signature links
      const signatureLinkData = enabledSignatures.map((sig: any) => ({
        certificate_id: cert.id,
        signature_id: sig.id,
        display_order: sig.display_order,
        signature_name: sig.name,
        signature_designation: sig.designation,
        signature_text: sig.signature_text || null,
        signature_image_url: sig.signature_image_url || null,
      }));

      const { error: linkError } = await supabase
        .from('certificate_signatures')
        .insert(signatureLinkData);

      if (linkError) {
        console.log(`   ❌ [${i + 1}/${orphanedCount}] ${userName} - ${courseTitle}`);
        console.log(`      Error: ${linkError.message}`);
        failureCount++;
      } else {
        console.log(`   ✅ [${i + 1}/${orphanedCount}] ${userName} - ${courseTitle}`);
        successCount++;
      }
    }

    // Summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Successfully fixed: ${successCount}/${orphanedCount}`);
    if (failureCount > 0) {
      console.log(`   ❌ Failed to fix: ${failureCount}/${orphanedCount}`);
    }
    console.log(`\n✨ Bulk fix completed!\n`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

fixAllOrphanedSignatures();
