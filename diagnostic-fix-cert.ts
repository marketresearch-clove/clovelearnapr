/**
 * Certificate Diagnostic & Fix Script
 *
 * Usage: npx ts-node diagnostic-fix-cert.ts <certificateId>
 * Example: npx ts-node diagnostic-fix-cert.ts f119f151-b5aa-44bd-8910-8e660bf7d95c
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);


async function diagnoseAndFix(certificateId: string) {
  console.log(`\n🔍 Diagnosing certificate: ${certificateId}\n`);

  try {
    // 1. Get certificate details
    console.log('📋 Fetching certificate details...');
    const { data: cert, error: certError } = await supabase
      .from('certificates')
      .select('id, user_id, course_id, issued_at, template_id')
      .eq('id', certificateId)
      .single();

    if (certError || !cert) {
      console.error(`\n❌ Certificate not found: ${certError?.message}`);
      process.exit(1);
    }

    // Get course details
    const { data: course } = await supabase
      .from('courses')
      .select('id, title, certificate_enabled')
      .eq('id', cert.course_id)
      .single();

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('fullname, email')
      .eq('id', cert.user_id)
      .single();

    console.log(`✅ Found certificate for user: ${profile?.fullname} (${profile?.email})`);
    console.log(`   Course: ${course?.title} (certificate_enabled: ${course?.certificate_enabled})`);
    console.log(`   Issued: ${cert.issued_at}\n`);

    // 2. Get linked signatures
    console.log('📝 Checking linked signatures...');
    const { data: linkedSignatures, error: linkedError } = await supabase
      .from('certificate_signatures')
      .select('*')
      .eq('certificate_id', certificateId);

    if (linkedError) {
      console.error(`Error fetching linked signatures: ${linkedError.message}`);
      process.exit(1);
    }

    const linkedCount = linkedSignatures?.length || 0;
    console.log(`   Found: ${linkedCount} signatures linked\n`);

    if (linkedCount > 0) {
      console.log('   Linked signatures:');
      linkedSignatures!.forEach((sig: any) => {
        console.log(`   - ${sig.signature_name} (${sig.signature_designation})`);
      });
      console.log('\n✅ Certificate already has signatures! Nothing to fix.\n');
      return;
    }

    // 3. Get enabled signatures
    console.log('🔧 Checking available signatures...');
    const { data: enabledSignatures, error: enabledError } = await supabase
      .from('certificate_signature_settings')
      .select('*')
      .eq('is_enabled', true)
      .order('display_order', { ascending: true });

    if (enabledError) {
      console.error(`Error fetching enabled signatures: ${enabledError.message}`);
      process.exit(1);
    }

    const enabledCount = enabledSignatures?.length || 0;
    console.log(`   Found: ${enabledCount} enabled signatures\n`);

    if (enabledCount === 0) {
      console.error('❌ ISSUE: No enabled signatures exist in the system');
      console.error('\n🔧 FIX REQUIRED:');
      console.error('   1. Go to Admin Panel → Settings → Signatures');
      console.error('   2. Create at least one signature');
      console.error('   3. Make sure to set is_enabled = true');
      console.error('   4. Run this script again after adding signatures\n');
      process.exit(1);
    }

    // 4. Check disabled signatures
    const { data: disabledSignatures } = await supabase
      .from('certificate_signature_settings')
      .select('*')
      .eq('is_enabled', false);

    console.log(`   Enabled: ${enabledCount} signatures`);
    enabledSignatures!.forEach((sig: any) => {
      console.log(`      ✓ ${sig.name} (${sig.designation})`);
    });

    if (disabledSignatures && disabledSignatures.length > 0) {
      console.log(`\n   Disabled: ${disabledSignatures.length} signatures (not used)`);
      disabledSignatures.forEach((sig: any) => {
        console.log(`      ✗ ${sig.name} (${sig.designation})`);
      });
    }

    // 5. Implement fix - Link signatures to certificate
    console.log(`\n🔧 Implementing fix: Linking ${enabledCount} signatures to certificate...\n`);

    const signatureLinkData = enabledSignatures!.map((sig: any) => ({
      certificate_id: certificateId,
      signature_id: sig.id,
      display_order: sig.display_order,
      signature_name: sig.name,
      signature_designation: sig.designation,
      signature_text: sig.signature_text || null,
      signature_image_url: sig.signature_image_url || null,
    }));

    const { data: linkedRows, error: linkError } = await supabase
      .from('certificate_signatures')
      .insert(signatureLinkData)
      .select('id');

    if (linkError) {
      console.error(`❌ Error linking signatures: ${linkError.message}`);
      console.error(`Details: ${linkError.details}`);
      process.exit(1);
    }

    console.log(`✅ Successfully linked ${linkedRows?.length || 0} signatures!\n`);

    // 6. Verify the fix
    console.log('✅ Verifying fix...');
    const { data: verifySignatures } = await supabase
      .from('certificate_signatures')
      .select('*')
      .eq('certificate_id', certificateId);

    console.log(`   Certificate now has ${verifySignatures?.length || 0} signatures\n`);

    console.log('📊 SUMMARY:');
    console.log(`   ✅ Certificate ID: ${certificateId}`);
    console.log(`   ✅ User: ${profile?.fullname}`);
    console.log(`   ✅ Course: ${course?.title}`);
    console.log(`   ✅ Signatures Fixed: ${linkedRows?.length || 0}`);
    console.log('\n✨ Fix completed successfully!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the diagnostic and fix
const certificateId = process.argv[2];
if (!certificateId) {
  console.error('❌ Usage: npx ts-node diagnostic-fix-cert.ts <certificateId>');
  console.error('Example: npx ts-node diagnostic-fix-cert.ts f119f151-b5aa-44bd-8910-8e660bf7d95c');
  process.exit(1);
}

diagnoseAndFix(certificateId);
