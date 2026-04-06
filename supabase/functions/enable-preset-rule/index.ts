import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface PresetRuleData {
    presetId: string;
}

interface PresetRule {
    [key: string]: any;
    name: string;
    description?: string;
    trigger_type: string;
    title: string;
    message: string;
    type: string;
    priority: number;
    send_after_days: number;
    send_before_days?: number;
    max_sends_per_user: number;
    is_active: boolean;
}

const PRESET_RULES: Record<string, PresetRule> = {
    'assessment-3day': {
        name: 'Assessment Due (3 Days)',
        description: 'Remind before assessment due date',
        trigger_type: 'course_due',
        days_before_due: 3,
        title: '⏰ {assessment_name} Due in 3 Days',
        message: 'Your {assessment_type} "{assessment_name}" is due on {due_date}. You have 3 days to complete it. Here\'s a tip: review your notes and take it in a distraction-free environment. You\'re well-prepared! 💪',
        type: 'assignment',
        priority: 3,
        send_after_days: 3,
        send_before_days: 0,
        max_sends_per_user: 2,
        is_active: true,
    },
    'course-1week': {
        name: 'Course Due (1 Week)',
        description: 'Early reminder before course completion',
        trigger_type: 'course_due',
        days_before_due: 7,
        title: '📚 {course_name} Due in 1 Week!',
        message: 'One week left for {course_name}! You\'re at {progress}% completion. Pick up the pace and finish strong. You only need to complete {remaining_lessons} more lessons. Let\'s go! 🚀',
        type: 'course',
        priority: 2,
        send_after_days: 7,
        send_before_days: 0,
        max_sends_per_user: 1,
        is_active: true,
    },
    'course-assigned': {
        name: 'New Course Assigned',
        description: 'Notify when course is assigned',
        trigger_type: 'task_pending',
        days_after_assignment: 0,
        title: '🆕 New Course Assigned: {course_name}',
        message: 'You\'ve been assigned a new course! 📖 {course_name} is now in your learning queue. This course will take approximately {duration} hours and is due by {due_date}. Start today to stay on schedule!',
        type: 'course',
        priority: 2,
        send_after_days: 0,
        send_before_days: 0,
        max_sends_per_user: 1,
        is_active: true,
    },
    'careerpath-weekly': {
        name: 'Career Path Weekly Check',
        description: 'Weekly progress reminder (Monday 9 AM)',
        trigger_type: 'low_engagement',
        frequency: 'weekly',
        recommended_day: 'Monday',
        title: '🎯 Career Path Weekly Check-in',
        message: 'How\'s your career path journey going? 📈 This week, try to complete {suggested_courses} more courses. You\'re {progress}% through your path to becoming a {target_role}. Stay consistent!',
        type: 'course',
        priority: 1,
        send_after_days: 7,
        send_before_days: 0,
        max_sends_per_user: 1,
        is_active: true,
    },
    'reengagement-14day': {
        name: 'Re-engagement (14 Days Inactive)',
        description: 'Bring back inactive learners',
        trigger_type: 'inactive_user',
        days_inactive: 14,
        title: '😴 We Miss You! Let\'s Get Back on Track',
        message: 'It\'s been 2 weeks since your last login! 👋 We miss having you here. You\'re close to your learning milestones - don\'t fall behind now. Come back and complete your next course today!',
        type: 'announcement',
        priority: 2,
        send_after_days: 14,
        send_before_days: 0,
        max_sends_per_user: 1,
        is_active: true,
    },
    'motivation-midcourse': {
        name: 'Mid-Course Motivation',
        description: 'Encourage at 50% completion',
        trigger_type: 'low_engagement',
        completion_threshold: 50,
        title: '✨ You\'re Halfway There!',
        message: 'Fantastic progress! 🎉 You\'ve completed 50% of {course_name}. The hardest part is behind you - keep the momentum going and finish this course strong. Just a bit more to go! 💪',
        type: 'announcement',
        priority: 2,
        send_after_days: 3,
        send_before_days: 0,
        max_sends_per_user: 1,
        is_active: true,
    },
};

export default async (req: Request) => {
    // CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
        'Content-Type': 'application/json',
    };

    try {
        // Handle CORS preflight request
        if (req.method === 'OPTIONS') {
            return new Response('ok', {
                status: 200,
                headers: corsHeaders,
            });
        }

        // Verify authorization
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Not authenticated' }), {
                status: 401,
                headers: corsHeaders,
            });
        }

        // Parse request body
        let body: PresetRuleData;
        try {
            const text = await req.text();
            if (!text) {
                return new Response(JSON.stringify({ error: 'Empty request body' }), {
                    status: 400,
                    headers: corsHeaders,
                });
            }
            body = JSON.parse(text);
        } catch (e) {
            return new Response(
                JSON.stringify({ error: 'Invalid JSON in request body' }),
                { status: 400, headers: corsHeaders }
            );
        }

        const { presetId } = body;

        if (!presetId) {
            return new Response(JSON.stringify({ error: 'Missing presetId' }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        const preset = PRESET_RULES[presetId];
        if (!preset) {
            return new Response(JSON.stringify({ error: `Unknown preset ID: ${presetId}` }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        // Extract admin_id from JWT token
        const token = authHeader.split('Bearer ')[1];
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            }
        );

        // Get current user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Failed to verify user' }), {
                status: 401,
                headers: corsHeaders,
            });
        }

        // Check if rule already exists
        const { data: existingRules, error: checkError } = await supabaseClient
            .from('notification_auto_send_rules')
            .select('id')
            .eq('admin_id', user.id)
            .eq('name', preset.name);

        if (checkError) {
            console.error('Error checking existing rules:', checkError);
            return new Response(JSON.stringify({ error: 'Database error checking existing rules' }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        if (existingRules && existingRules.length > 0) {
            // Rule already exists, just enable it
            const { error: updateError } = await supabaseClient
                .from('notification_auto_send_rules')
                .update({ is_active: true })
                .eq('id', existingRules[0].id);

            if (updateError) {
                console.error('Error updating rule:', updateError);
                return new Response(JSON.stringify({ error: 'Failed to enable rule' }), {
                    status: 500,
                    headers: corsHeaders,
                });
            }

            const successResponse = JSON.stringify({
                success: true,
                message: 'Rule enabled',
                rule_id: existingRules[0].id,
            });

            return new Response(successResponse, {
                status: 200,
                headers: corsHeaders,
            });
        }

        // Create new rule from preset
        const newRule = {
            admin_id: user.id,
            ...preset,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { data: createdRule, error: createError } = await supabaseClient
            .from('notification_auto_send_rules')
            .insert([newRule])
            .select()
            .single();

        if (createError) {
            console.error('Error creating rule:', createError);
            return new Response(JSON.stringify({ error: 'Failed to create rule' }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        const successResponse = JSON.stringify({
            success: true,
            message: 'Preset rule enabled successfully',
            rule: createdRule,
        });

        return new Response(successResponse, {
            status: 200,
            headers: corsHeaders,
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: corsHeaders,
        });
    }
};
