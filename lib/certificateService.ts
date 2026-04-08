import { supabase } from './supabaseClient';
import { getEnabledSignatures } from './certificateSignatureService';

export const awardCertificate = async (userId: string, courseId: string) => {
  try {
    // CRITICAL: Always check if certificate is enabled for this course
    // This is a defensive measure to prevent accidental certificate issuance
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, certificate_enabled, template_id')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      console.error('Error fetching course for certificate validation:', courseError);
      return null;
    }

    // ABORT if certificate is disabled for this course
    if (!course.certificate_enabled) {
      console.warn(`Certificate issuance BLOCKED: Course "${course.title}" has certificate_enabled = false`);
      return null;
    }

    // Get active template if course doesn't have one
    let templateId = course.template_id;
    if (!templateId) {
      const { data: activeTemplate } = await supabase
        .from('certificate_templates')
        .select('id')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (activeTemplate) {
        templateId = activeTemplate.id;
      }
    }

    // Award certificate
    const { data: certData, error: certError } = await supabase
      .from('certificates')
      .insert([{
        user_id: userId,
        course_id: courseId,
        template_id: templateId,
        issued_at: new Date().toISOString()
      }])
      .select();

    if (certError || !certData?.[0]) {
      console.error('Error awarding certificate:', certError);
      return null;
    }

    const certificateId = certData[0].id;

    // Link enabled signatures at time of certificate issuance with snapshot data
    try {
      const enabledSignatures = await getEnabledSignatures();
      if (enabledSignatures.length > 0) {
        // Store snapshot of signature data at time of issuance for historical accuracy
        const signatureLinkData = enabledSignatures.map(sig => ({
          certificate_id: certificateId,
          signature_id: sig.id,
          display_order: sig.display_order,
          // Snapshot data - preserves exact values at time of issuance
          signature_name: sig.name,
          signature_designation: sig.designation,
          signature_text: sig.signature_text,
          signature_image_url: sig.signature_image_url
        }));

        const { error: linkError } = await supabase
          .from('certificate_signatures')
          .insert(signatureLinkData);

        if (linkError) {
          console.warn('Could not link signatures to certificate:', linkError);
        } else {
          console.log(`Certificate successfully awarded for user ${userId} on course "${course.title}" with ${enabledSignatures.length} signatures (snapshot stored)`);
        }
      }
    } catch (sigError) {
      console.warn('Could not fetch signatures for certificate:', sigError);
    }

    return certData[0];
  } catch (error) {
    console.error('Error in awardCertificate:', error);
    return null;
  }
};

export const getCertificate = async (certificateId: string) => {
  const { data, error } = await supabase
    .from('certificates')
    .select(`
        id,
        user_id,
        issued_at,
        template_id,
        courses:course_id ( id, title ),
        certificate_signatures (
          signature_id,
          display_order,
          signature_name,
          signature_designation,
          signature_text,
          signature_image_url
        )
      `)
    .eq('id', certificateId)
    .single();

  if (error) {
    console.error('Error fetching certificate:', error);
    return null;
  }

  // Fetch template data
  let template = null;
  if (data.template_id) {
    const { data: templateData } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('id', data.template_id)
      .single();
    template = templateData;
  } else {
    // Fallback to active template if not found on certificate
    const { data: activeTemplate } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    template = activeTemplate;
  }

  // Transform the data structure to match expected format
  // Use snapshot data from certificate_signatures (not live signature_settings)
  // This preserves the original signature values at time of issuance
  // Filter out signatures with missing required fields to prevent rendering nulls
  const signatures = (data?.certificate_signatures || [])
    .map((cs: any) => ({
      id: cs.signature_id,
      name: cs.signature_name,
      designation: cs.signature_designation,
      signature_text: cs.signature_text,
      signature_image_url: cs.signature_image_url,
      display_order: cs.display_order
    }))
    .filter((sig: any) => {
      // Only include signatures with required fields
      if (!sig.name || !sig.designation) {
        console.warn('Filtering out signature with missing name or designation:', sig);
        return false;
      }
      return true;
    });

  // Prepare the return data
  const certificateData = {
    ...data,
    signatures_data: signatures
  };

  let userFullName = 'Certificate Recipient';
  let userEmail = '';
  let userDepartment = '';

  if (certificateData?.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('fullname, email, department')
      .eq('id', certificateData.user_id)
      .single();

    if (profile) {
      userFullName = profile.fullname || 'Certificate Recipient';
      userEmail = profile.email || '';
      userDepartment = profile.department || '';
    }
  }

  return {
    ...certificateData,
    profiles: { full_name: userFullName, email: userEmail, department: userDepartment },
    template
  };
};

export const getUserCertificates = async (userId: string) => {
  const { data, error } = await supabase
    .from('certificates')
    .select(`
      id,
      user_id,
      issued_at,
      courses:course_id (id, title),
      certificate_signatures (
        signature_id,
        display_order,
        signature_name,
        signature_designation,
        signature_text,
        signature_image_url
      )
    `)
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });

  if (error) {
    console.error('Error fetching user certificates:', error);
    return [];
  }

  const certificatesWithProfiles = await Promise.all((data || []).map(async (cert: any) => {
    let fullName = 'Certificate Recipient';
    if (cert.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('fullname')
        .eq('id', cert.user_id)
        .single();

      if (profile?.fullname) {
        fullName = profile.fullname;
      }
    }

    // Transform signatures data using stored snapshots
    // This preserves the original signature values at time of issuance
    // Filter out signatures with missing required fields to prevent rendering nulls
    const signatures = (cert.certificate_signatures || [])
      .map((cs: any) => ({
        id: cs.signature_id,
        name: cs.signature_name,
        designation: cs.signature_designation,
        signature_text: cs.signature_text,
        signature_image_url: cs.signature_image_url,
        display_order: cs.display_order
      }))
      .filter((sig: any) => {
        // Only include signatures with required fields
        if (!sig.name || !sig.designation) {
          console.warn('Filtering out signature with missing name or designation:', sig);
          return false;
        }
        return true;
      });

    return {
      ...cert,
      signatures_data: signatures,
      profiles: { full_name: fullName }
    };
  }));

  return certificatesWithProfiles || [];
};

export const getCertificateByUserAndCourse = async (userId: string, courseId: string) => {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error fetching certificate:', error);
    return null;
  }
};

export const checkAndAwardCertificate = async (userId: string, courseId: string) => {
  try {
    // First, check if certificate is enabled for this course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, certificate_enabled')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      console.error('Error fetching course for certificate validation:', courseError);
      return null;
    }

    // ABORT if certificate is disabled for this course
    if (!course.certificate_enabled) {
      console.warn(`Certificate issuance BLOCKED: Course "${course.title}" has certificate_enabled = false`);
      return null;
    }

    // Check if certificate already exists
    const { data: existingCert, error: checkError } = await supabase
      .from('certificates')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (!existingCert) {
      return await awardCertificate(userId, courseId);
    }

    return existingCert;
  } catch (error) {
    console.error('Error in checkAndAwardCertificate:', error);
    return null;
  }
};
