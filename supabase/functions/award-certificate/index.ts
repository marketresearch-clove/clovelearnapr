import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { userId, courseId } = await req.json()

        if (!userId || !courseId) {
            return new Response(
                JSON.stringify({ error: 'Missing userId or courseId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // CRITICAL: Always check if certificate is enabled for this course
        const { data: course, error: courseError } = await supabaseClient
            .from('courses')
            .select('id, title, certificate_enabled, template_id')
            .eq('id', courseId)
            .single()

        if (courseError || !course) {
            console.error('Error fetching course for certificate validation:', courseError)
            return new Response(
                JSON.stringify({ error: 'Course not found or certificate disabled' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ABORT if certificate is disabled for this course
        if (!course.certificate_enabled) {
            console.warn(`Certificate issuance BLOCKED: Course "${course.title}" has certificate_enabled = false`)
            return new Response(
                JSON.stringify({ error: 'Certificate disabled for this course' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get active template if course doesn't have one
        let templateId = course.template_id
        if (!templateId) {
            const { data: activeTemplate } = await supabaseClient
                .from('certificate_templates')
                .select('id')
                .eq('is_active', true)
                .order('display_order', { ascending: true })
                .limit(1)
                .maybeSingle()

            if (activeTemplate) {
                templateId = activeTemplate.id
            }
        }

        // Check if certificate already exists
        const { data: existingCert } = await supabaseClient
            .from('certificates')
            .select('id')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .maybeSingle()

        if (existingCert) {
            return new Response(
                JSON.stringify({ error: 'Certificate already exists' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Award certificate
        const { data: certData, error: certError } = await supabaseClient
            .from('certificates')
            .insert([{
                user_id: userId,
                course_id: courseId,
                template_id: templateId,
                issued_at: new Date().toISOString()
            }])
            .select()

        if (certError || !certData?.[0]) {
            console.error('Error awarding certificate:', certError)
            return new Response(
                JSON.stringify({ error: 'Failed to create certificate' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const certificateId = certData[0].id

        // Manually populate signatures (don't rely on trigger which is unreliable)
        try {
            // Get enabled signatures
            const { data: enabledSignatures, error: sigError } = await supabaseClient
                .from('certificate_signature_settings')
                .select('*')
                .eq('is_enabled', true)
                .order('display_order', { ascending: true })

            if (sigError) {
                console.error('[SIGNATURE_FETCH_ERROR] Error fetching enabled signatures:', sigError)
                // For disabled course or error, just return success (certificate was created)
                return new Response(
                    JSON.stringify({
                        success: true,
                        certificateId: certificateId,
                        message: 'Certificate awarded successfully (no signatures available)'
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // If there are enabled signatures, create the link records and populate certificate data
            if (enabledSignatures && enabledSignatures.length > 0) {
                // Create certificate_signatures records
                const signatureLinkData = enabledSignatures.map(sig => ({
                    certificate_id: certificateId,
                    signature_id: sig.id,
                    display_order: sig.display_order,
                    signature_name: sig.name,
                    signature_designation: sig.designation,
                    signature_text: sig.signature_text || null,
                    signature_image_url: sig.signature_image_url || null
                }))

                const { data: linkedRows, error: linkError } = await supabaseClient
                    .from('certificate_signatures')
                    .insert(signatureLinkData)
                    .select('id')

                if (linkError) {
                    console.error('[SIGNATURE_LINK_ERROR] Error creating certificate_signatures:', linkError)
                    // Non-blocking - certificate was created, just missing signature links
                } else {
                    console.log(`[SIGNATURE_LINK_SUCCESS] Created ${linkedRows?.length || 0} signature links`)
                }

                // Update certificate with signature_ids and signatures_data arrays
                const signatureIds = enabledSignatures.map(sig => sig.id)
                const signaturesData = enabledSignatures.map(sig => ({
                    signature_id: sig.id,
                    signature_name: sig.name,
                    signature_designation: sig.designation,
                    signature_text: sig.signature_text,
                    signature_image_url: sig.signature_image_url,
                    display_order: sig.display_order
                }))

                const { error: updateError } = await supabaseClient
                    .from('certificates')
                    .update({
                        signature_ids: signatureIds,
                        signatures_data: signaturesData
                    })
                    .eq('id', certificateId)

                if (updateError) {
                    console.error('[SIGNATURE_UPDATE_ERROR] Error updating certificate with signature snapshot:', updateError)
                    // Non-blocking - certificate was created with signature links, just missing snapshot data
                } else {
                    console.log(`[CERTIFICATE_SUCCESS] Certificate ${certificateId} awarded with ${enabledSignatures.length} signatures`)
                }
            } else {
                console.log('[CERTIFICATE_SUCCESS] Certificate awarded (no enabled signatures configured)')
            }
        } catch (populateError) {
            console.error('[CERTIFICATE_POPULATE_ERROR] Error populating signatures:', populateError)
            // Non-blocking - certificate was created successfully
        }

        return new Response(
            JSON.stringify({
                success: true,
                certificateId: certificateId,
                message: 'Certificate awarded successfully'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error in award-certificate function:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})