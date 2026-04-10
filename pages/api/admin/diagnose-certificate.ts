import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { certificateBackfillService } from '../../../lib/certificateBackfillService';

/**
 * Diagnostic endpoint for certificate signature issues
 *
 * GET /api/admin/diagnose-certificate?certificateId=<id>
 * GET /api/admin/diagnose-certificate?certificateId=<id>&autoBackfill=true
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { certificateId, autoBackfill } = req.query;

  if (!certificateId || typeof certificateId !== 'string') {
    return res.status(400).json({ error: 'Missing certificateId parameter' });
  }

  try {
    // 1. Get certificate details
    const { data: cert, error: certError } = await supabase
      .from('certificates')
      .select(`
        id,
        user_id,
        course_id,
        issued_at,
        template_id,
        courses:course_id (id, title, certificate_enabled),
        profiles:user_id (fullname, email)
      `)
      .eq('id', certificateId)
      .single();

    if (certError || !cert) {
      return res.status(404).json({
        error: 'Certificate not found',
        details: certError?.message || 'No certificate with this ID'
      });
    }

    // 2. Get linked signatures
    const { data: linkedSignatures, error: sigError } = await supabase
      .from('certificate_signatures')
      .select('*')
      .eq('certificate_id', certificateId);

    // 3. Get all enabled signatures available
    const { data: enabledSignatures, error: enabledError } = await supabase
      .from('certificate_signature_settings')
      .select('*')
      .eq('is_enabled', true)
      .order('display_order', { ascending: true });

    // 4. Get all disabled signatures
    const { data: disabledSignatures, error: disabledError } = await supabase
      .from('certificate_signature_settings')
      .select('*')
      .eq('is_enabled', false)
      .order('display_order', { ascending: true });

    // 5. Get enrollment details
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select('retake_count, completed, progress')
      .eq('userid', cert.user_id)
      .eq('courseid', cert.course_id)
      .single();

    // 6. Build diagnosis
    const diagnosis = {
      certificate: {
        id: cert.id,
        user: {
          id: cert.user_id,
          name: cert.profiles?.fullname || 'Unknown',
          email: cert.profiles?.email
        },
        course: {
          id: cert.course_id,
          title: cert.courses?.title || 'Unknown',
          certificateEnabled: cert.courses?.certificate_enabled
        },
        template: {
          id: cert.template_id,
          specified: !!cert.template_id
        },
        issuedAt: cert.issued_at
      },
      signatures: {
        linked: {
          count: linkedSignatures?.length || 0,
          items: (linkedSignatures || []).map(s => ({
            id: s.id,
            name: s.signature_name,
            designation: s.signature_designation,
            hasImage: !!s.signature_image_url,
            hasText: !!s.signature_text,
            displayOrder: s.display_order
          }))
        },
        available: {
          enabled: {
            count: enabledSignatures?.length || 0,
            items: (enabledSignatures || []).map(s => ({
              id: s.id,
              name: s.name,
              designation: s.designation,
              isEnabled: s.is_enabled,
              displayOrder: s.display_order
            }))
          },
          disabled: {
            count: disabledSignatures?.length || 0,
            items: (disabledSignatures || []).map(s => ({
              id: s.id,
              name: s.name,
              designation: s.designation,
              isEnabled: s.is_enabled,
              displayOrder: s.display_order
            }))
          }
        }
      },
      enrollment: {
        retakeCount: enrollment?.retake_count || 0,
        completed: enrollment?.completed,
        progress: enrollment?.progress,
        status: enrollment?.completed ? 'Completed' : `In Progress (${enrollment?.progress || 0}%)`
      },
      analysis: {
        issues: [] as string[],
        warnings: [] as string[],
        recommendations: [] as string[]
      }
    };

    // 7. Identify issues
    const linkedCount = linkedSignatures?.length || 0;
    const enabledCount = enabledSignatures?.length || 0;
    const disabledCount = disabledSignatures?.length || 0;

    if (linkedCount === 0) {
      diagnosis.analysis.issues.push('❌ NO SIGNATURES LINKED TO CERTIFICATE');

      if (enabledCount === 0) {
        diagnosis.analysis.issues.push('❌ NO ENABLED SIGNATURES IN SYSTEM');
        diagnosis.analysis.recommendations.push('✓ Create certificate signatures in Admin Settings → Signatures');
        diagnosis.analysis.recommendations.push('✓ Set at least one signature as ENABLED (is_enabled = true)');
      } else {
        diagnosis.analysis.issues.push(`⚠️  ${enabledCount} enabled signatures exist but NOT LINKED to this certificate`);
        diagnosis.analysis.recommendations.push('✓ Run backfill to link enabled signatures');
      }

      if (disabledCount > 0) {
        diagnosis.analysis.warnings.push(`ℹ️  ${disabledCount} disabled signatures exist (not used for backfill)`);
      }
    } else {
      diagnosis.analysis.recommendations.push(`✓ Certificate properly has ${linkedCount} signature(s) linked`);
    }

    // Check retake logic
    if (enrollment?.retakeCount > 0) {
      if (enrollment.retakeCount === 1) {
        diagnosis.analysis.recommendations.push(`ℹ️  Course has been retaken ${enrollment.retakeCount} time (certificates allowed for first retake)`);
      } else {
        diagnosis.analysis.warnings.push(`⚠️  Course retaken ${enrollment.retakeCount} times (no further certificates allowed)`);
      }
    }

    // Check if course has certificates enabled
    if (!cert.courses?.certificate_enabled) {
      diagnosis.analysis.warnings.push('⚠️  Certificate_enabled is FALSE for this course');
    }

    // 8. Auto-backfill if requested
    let backfillResult = null;
    if (autoBackfill === 'true' && linkedCount === 0 && enabledCount > 0) {
      console.log(`[DIAGNOSTIC] Running auto-backfill for certificate ${certificateId}`);
      try {
        backfillResult = await certificateBackfillService.backfillCertificateSignatures(certificateId);

        if (backfillResult.success && backfillResult.signaturesAdded > 0) {
          diagnosis.analysis.recommendations.push(`✓ AUTO-BACKFILL: Successfully added ${backfillResult.signaturesAdded} signatures`);
          // Update linked count
          const { data: updatedSigs } = await supabase
            .from('certificate_signatures')
            .select('*')
            .eq('certificate_id', certificateId);
          diagnosis.signatures.linked.count = updatedSigs?.length || 0;
          diagnosis.signatures.linked.items = (updatedSigs || []).map(s => ({
            id: s.id,
            name: s.signature_name,
            designation: s.signature_designation,
            hasImage: !!s.signature_image_url,
            hasText: !!s.signature_text,
            displayOrder: s.display_order
          }));
        } else {
          diagnosis.analysis.warnings.push(`⚠️  AUTO-BACKFILL: Failed or added 0 signatures`);
        }
      } catch (error) {
        diagnosis.analysis.warnings.push(`⚠️  AUTO-BACKFILL: Exception - ${String(error)}`);
      }
    }

    return res.status(200).json({
      success: true,
      diagnosis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DIAGNOSTIC] Error:', error);
    return res.status(500).json({
      error: 'Diagnostic failed',
      details: String(error)
    });
  }
}
