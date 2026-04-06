import { supabase } from './supabaseClient';

export const awardCertificate = async (userId: string, courseId: string) => {
  try {
    // CRITICAL: Always check if certificate is enabled for this course
    // This is a defensive measure to prevent accidental certificate issuance
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

    const { data, error } = await supabase
      .from('certificates')
      .insert([{ user_id: userId, course_id: courseId, issued_at: new Date().toISOString() }])
      .select();

    if (error) {
      console.error('Error awarding certificate:', error);
      return null;
    }

    console.log(`Certificate successfully awarded for user ${userId} on course "${course.title}"`);
    return data[0];
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
        courses:course_id ( id, title )
      `)
    .eq('id', certificateId)
    .single();

  if (error) {
    console.error('Error fetching certificate:', error);
    return null;
  }

  let userFullName = 'Certificate Recipient';
  let userEmail = '';
  let userDepartment = '';

  if (data?.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('fullname, email, department')
      .eq('id', data.user_id)
      .single();

    if (profile) {
      userFullName = profile.fullname || 'Certificate Recipient';
      userEmail = profile.email || '';
      userDepartment = profile.department || '';
    }
  }

  let html_template = '';
  try {
    const response = await fetch('/certificate.html');
    if (!response.ok) {
      throw new Error(`Failed to fetch certificate template: ${response.statusText}`);
    }
    html_template = await response.text();
  } catch (err) {
    console.error('Error fetching certificate template:', err);
    html_template = '';
  }

  return {
    ...data,
    profiles: { full_name: userFullName, email: userEmail, department: userDepartment },
    html_template
  };
};

export const getUserCertificates = async (userId: string) => {
  const { data, error } = await supabase
    .from('certificates')
    .select(`
      id,
      user_id,
      issued_at,
      courses:course_id (id, title)
    `)
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });

  if (error) {
    console.error('Error fetching user certificates:', error);
    return [];
  }

  const certificatesWithProfiles = await Promise.all((data || []).map(async (cert) => {
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

    return {
      ...cert,
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
