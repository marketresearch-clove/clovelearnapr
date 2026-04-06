import { supabase } from './supabaseClient';

export interface ExternalAssessment {
  id: string;
  title: string;
  provider: string;
  external_url: string;
  duration: number;
  attempt_limit: number;
  passing_criteria?: string;
  certificate_required: boolean;
  instructions?: string;
  thumbnail_url?: string;
  created_at: string;
  score_mapping?: {
    level: string;
    min: number;
    max: number;
  }[];
}

export interface UserExternalAssessment {
  id: string;
  user_id: string;
  assessment_id: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'evaluated';
  assigned_at: string;
  valid_until?: string;
  attempt_count: number;
  start_time?: string;
  expected_end_time?: string;
  assessment?: ExternalAssessment;
  results?: ExternalAssessmentResult[];
}

export interface ExternalAssessmentResult {
  id: string;
  assignment_id: string;
  user_id: string;
  assessment_id: string;
  score?: number;
  cefr_level?: string;
  certificate_url?: string;
  result_url?: string;
  submitted_at: string;
  verified_at?: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  admin_remarks?: string;
}

export const externalAssessmentService = {
  async getAssessments() {
    const { data, error } = await supabase
      .from('external_assessments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as ExternalAssessment[];
  },

  async getUserAssignments(userId: string) {
    const { data, error } = await supabase
      .from('user_external_assessments')
      .select('*, assessment:external_assessments(*), results:external_assessment_results(*)')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false });
    
    if (error) throw error;
    
    // Sort results locally as Supabase subquery ordering can be tricky
    const sortedData = (data as any[]).map(item => ({
      ...item,
      results: item.results?.sort((a: any, b: any) => 
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )
    }));

    return sortedData as UserExternalAssessment[];
  },

  async startAssessment(assignmentId: string, durationMinutes: number) {
    const startTime = new Date().toISOString();
    const expectedEndTime = new Date(Date.now() + durationMinutes * 60000).toISOString();
    
    const { data, error } = await supabase
      .from('user_external_assessments')
      .update({
        status: 'in_progress',
        start_time: startTime,
        expected_end_time: expectedEndTime,
        attempt_count: supabase.rpc('increment_attempt_count', { row_id: assignmentId }) // Need to create this RPC or just handle manually
      })
      .eq('id', assignmentId)
      .select()
      .single();
    
    // Fallback if RPC not available
    if (error) {
       const { data: current } = await supabase.from('user_external_assessments').select('attempt_count').eq('id', assignmentId).single();
       const { data: updated, error: updateError } = await supabase
        .from('user_external_assessments')
        .update({
            status: 'in_progress',
            start_time: startTime,
            expected_end_time: expectedEndTime,
            attempt_count: (current?.attempt_count || 0) + 1
        })
        .eq('id', assignmentId)
        .select()
        .single();
       if (updateError) throw updateError;
       return updated;
    }

    return data;
  },

  async submitResult(result: Omit<ExternalAssessmentResult, 'id' | 'submitted_at' | 'verification_status'>) {
    const { data, error } = await supabase
      .from('external_assessment_results')
      .insert([{
        ...result,
        verification_status: 'pending'
      }])
      .select()
      .single();
    if (error) throw error;

    // Update assignment status
    await supabase
      .from('user_external_assessments')
      .update({ status: 'submitted' })
      .eq('id', result.assignment_id);

    return data;
  },

  async getAssignmentResults(assignmentId: string) {
    const { data, error } = await supabase
      .from('external_assessment_results')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data as ExternalAssessmentResult[];
  },

  // Admin methods
  async createAssessment(assessment: Omit<ExternalAssessment, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('external_assessments')
      .insert([assessment])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAssessment(id: string, assessment: Partial<ExternalAssessment>) {
    const { data, error } = await supabase
      .from('external_assessments')
      .update(assessment)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAssessment(id: string) {
    const { error } = await supabase
      .from('external_assessments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async assignToUsers(assessmentId: string, userIds: string[], validUntil?: string) {
    const assignments = userIds.map(userId => ({
      user_id: userId,
      assessment_id: assessmentId,
      valid_until: validUntil,
      status: 'assigned'
    }));

    const { data, error } = await supabase
      .from('user_external_assessments')
      .insert(assignments)
      .select();
    if (error) throw error;
    return data;
  },

  async getAllResults() {
    const { data, error } = await supabase
      .from('external_assessment_results')
      .select(`
        *,
        user:profiles(fullname, email),
        assessment:external_assessments(title, provider)
      `)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getAllAssignments() {
    const { data, error } = await supabase
      .from('user_external_assessments')
      .select(`
        *,
        user:profiles(fullname, email),
        assessment:external_assessments(title, provider),
        results:external_assessment_results(*)
      `)
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async deleteAssignment(assignmentId: string) {
    const { error } = await supabase
      .from('user_external_assessments')
      .delete()
      .eq('id', assignmentId);
    if (error) throw error;
  },

  async verifyResult(resultId: string, status: 'approved' | 'rejected', remarks?: string) {
    const { data, error } = await supabase
      .from('external_assessment_results')
      .update({
        verification_status: status,
        admin_remarks: remarks,
        verified_at: new Date().toISOString()
      })
      .eq('id', resultId)
      .select()
      .single();
    if (error) throw error;

    if (status === 'approved') {
        await supabase
          .from('user_external_assessments')
          .update({ status: 'evaluated' })
          .eq('id', data.assignment_id);
    }

    return data;
  }
};
