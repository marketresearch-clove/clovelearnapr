
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({ storage: storage });

app.post('/convert', upload.single('file'), (req, res) => {
  const file = fs.readFileSync(req.file.path);
  const outputPath = path.join(__dirname, `converted/${path.parse(req.file.originalname).name}.pdf`);

  libre.convert(file, '.pdf', undefined, (err, done) => {
    if (err) {
      console.log(`Error converting file: ${err}`);
      res.status(500).send('Error converting file');
    }

    fs.writeFileSync(outputPath, done);
    res.download(outputPath);
  });
});

app.get('/pptx', (req, res) => {
  const filePath = path.join(__dirname, '..', 'Assets', 'business-risk-management.pptx');
  res.sendFile(filePath);
});

app.get('/api/assessments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching assessment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/lessons/:lessonId/assessment', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('lessonId', lessonId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Assessment not found for this lesson' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching lesson assessment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/courses/:courseId/assessments', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('courseId', courseId)
      .order('createdAt', { ascending: true });

    if (error) {
      return res.status(404).json({ error: 'No assessments found' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Error fetching course assessments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/assessments/:assessmentId/submit', async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { userId, answers, timeTaken } = req.body;

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single();

    if (assessmentError) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    let score = 0;
    const questions = assessment.questions || [];

    questions.forEach((question) => {
      const userAnswer = answers[question.id.toString()];
      if (userAnswer && userAnswer === question.correctAnswer.toString()) {
        score += question.points || 1;
      }
    });

    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
    const passed = percentage >= (assessment.passingScore || 70);

    const { data, error } = await supabase
      .from('assessment_results')
      .insert([{
        assessmentId,
        userId,
        score,
        percentage: Math.round(percentage * 100) / 100,
        passed,
        answers,
        timeTaken,
        attemptNumber: 1,
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to save assessment results' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error submitting assessment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/enrollment/enroll', async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    const { data: existing, error: checkError } = await supabaseAdmin
      .from('enrollments')
      .select('*')
      .eq('userid', userId)
      .eq('courseid', courseId)
      .single();

    if (existing) {
      return res.json(existing);
    }

    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .insert([{
        userid: userId,
        courseid: courseId,
        progress: 0,
        completed: false,
        hoursspent: 0,
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error enrolling:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lesson-progress/update', async (req, res) => {
  try {
    const { userId, lessonId, courseId, progress, completed } = req.body;

    const { data: existing } = await supabaseAdmin
      .from('lesson_progress')
      .select('*')
      .eq('userid', userId)
      .eq('lessonid', lessonId)
      .single();

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('lesson_progress')
        .update({
          progress,
          completed,
          lastaccessedat: new Date().toISOString(),
          completedat: completed ? new Date().toISOString() : null,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    } else {
      const { data, error } = await supabaseAdmin
        .from('lesson_progress')
        .insert([{
          userid: userId,
          lessonid: lessonId,
          courseid: courseId,
          progress,
          completed,
          lastaccessedat: new Date().toISOString(),
          completedat: completed ? new Date().toISOString() : null,
        }])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    }
  } catch (err) {
    console.error('Error updating lesson progress:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/enrollment/update', async (req, res) => {
  try {
    const { userId, courseId, progress, completed, hoursspent } = req.body;

    // Check if already completed to avoid duplicate operations
    const { data: existingEnrollment } = await supabaseAdmin
      .from('enrollments')
      .select('completed, hoursspent')
      .eq('userid', userId)
      .eq('courseid', courseId)
      .single();

    const wasAlreadyCompleted = existingEnrollment?.completed || false;

    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .update({
        progress: progress !== undefined ? progress : undefined,
        completed: completed !== undefined ? completed : undefined,
        hoursspent: hoursspent !== undefined ? hoursspent : undefined,
        lastaccessedat: new Date().toISOString(),
        ...(completed && { completedat: new Date().toISOString() }),
      })
      .eq('userid', userId)
      .eq('courseid', courseId)
      .select()
      .single();

    if (error) throw error;
    // If the enrollment was marked completed for the first time, create skill assignments and achievements
    if (completed && !wasAlreadyCompleted) {
      try {
        const completedAt = (data && data.completedat) ? data.completedat : new Date().toISOString();

        // Fetch skill-course mappings for this course
        const { data: mappings, error: mapError } = await supabaseAdmin
          .from('skill_course_mappings')
          .select('id, skillid, expiry_date, visible, skills(id,name), courses(id, title, level)')
          .eq('courseid', courseId);

        if (mapError) throw mapError;

        if (mappings && mappings.length > 0) {
          for (const mapping of mappings) {
            if (mapping.visible === false) continue; // skip invisible mappings

            // Determine expiry date for the assignment
            let expiryDate = null;
            const rawExpiry = mapping.expiry_date;

            if (rawExpiry) {
              // If admin stored an absolute date (ISO), use it
              const isoMatch = /^\d{4}-\d{2}-\d{2}/.test(rawExpiry);
              if (isoMatch) {
                expiryDate = rawExpiry;
              } else {
                // Try to parse duration strings like '1 year', '6 months', '12 months', '180 days', '1y', '6m'
                const dur = rawExpiry.toString().toLowerCase();
                const numMatch = dur.match(/(\d+)\s*/);
                const unitMatch = dur.match(/(year|years|y|month|months|m|day|days|d)/);

                if (numMatch && unitMatch) {
                  const n = parseInt(numMatch[1], 10);
                  const u = unitMatch[1];
                  const base = new Date(completedAt);

                  if (/^y|year/.test(u)) base.setFullYear(base.getFullYear() + n);
                  else if (/^m(onth)?/.test(u)) base.setMonth(base.getMonth() + n);
                  else if (/^d(ay)?/.test(u)) base.setDate(base.getDate() + n);

                  expiryDate = base.toISOString();
                } else {
                  // Fallback: attempt to parse as Date
                  const parsed = Date.parse(rawExpiry);
                  if (!isNaN(parsed)) expiryDate = new Date(parsed).toISOString();
                }
              }
            }

            // Determine level from mapping.courses.level if available
            const levelRaw = mapping.courses && mapping.courses.level ? mapping.courses.level : null;
            const level = levelRaw ? (levelRaw.charAt(0).toUpperCase() + levelRaw.slice(1)) : null;

            // Upsert skill_assignment (avoid duplicates)
            await supabaseAdmin
              .from('skill_assignments')
              .upsert([{
                userid: userId,
                skillid: mapping.skillid,
                visible: true,
                hidden: false,
                assignedat: completedAt,
                expiry_date: expiryDate,
                level: level,
                createdat: new Date().toISOString(),
                updatedat: new Date().toISOString()
              }], { onConflict: 'userid,skillid' });

            // Also ensure there is a corresponding user_skill_achievements record (so Acquired Skills UI shows it)
            // We'll upsert a record for this completion with 100% achieved for the course-level
            try {
              const courseLevel = level || 'Beginner';
              const skillName = mapping.skills && mapping.skills.name ? mapping.skills.name : 'Unknown Skill';
              await supabaseAdmin
                .from('user_skill_achievements')
                .upsert([{
                  user_id: userId,
                  skill_id: mapping.skillid,
                  skill_name: skillName,
                  course_level: courseLevel,
                  course_id: courseId,
                  course_title: mapping.courses && mapping.courses.title ? mapping.courses.title : null,
                  percentage_achieved: 100,
                  completed_at: completedAt,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }], { onConflict: 'user_id,skill_id,course_id' });
              console.log(`[COMPLETION] Recorded skill achievement for user ${userId}: skill_id=${mapping.skillid}, skill_name=${skillName}`);
            } catch (innerErr) {
              console.error('Failed to upsert user_skill_achievements for mapping', mapping, innerErr);
            }
          }
        }
      } catch (err) {
        console.error('Error while creating skill assignments/achievements after completion:', err);
      }

      // Issue certificate if enabled for this course
      try {
        const { data: courseData } = await supabaseAdmin
          .from('courses')
          .select('title, certificate_enabled')
          .eq('id', courseId)
          .single();

        console.log(`[CERTIFICATE_CHECK] Course: "${courseData?.title}", certificate_enabled: ${courseData?.certificate_enabled} (type: ${typeof courseData?.certificate_enabled})`);

        // Strictly check for true (not just truthy)
        const isCertificateEnabled = courseData?.certificate_enabled === true;

        if (isCertificateEnabled) {
          // Check if certificate already issued
          const { data: existingCert } = await supabaseAdmin
            .from('certificates')
            .select('id')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .maybeSingle();

          if (!existingCert) {
            const { data: newCert } = await supabaseAdmin
              .from('certificates')
              .insert([{
                user_id: userId,
                course_id: courseId,
                issued_at: new Date().toISOString()
              }])
              .select();
            console.log(`[COMPLETION] Certificate issued for user ${userId} on course ${courseData?.title} (ID: ${courseId})`);
          }
        } else {
          console.log(`[COMPLETION] Certificate SKIPPED for user ${userId} on course ${courseData?.title} (certificate_enabled = ${courseData?.certificate_enabled})`);
        }
      } catch (certErr) {
        console.error('Error issuing certificate:', certErr);
      }

      // Update or initialize user statistics when course is completed
      try {
        const enrollments = await supabaseAdmin
          .from('enrollments')
          .select('completed, hoursspent')
          .eq('userid', userId);

        const completedCount = (enrollments.data || []).filter((e) => e.completed).length;
        const totalMinutes = (enrollments.data || []).reduce((sum, e) => sum + (e.hoursspent || 0), 0);
        const totalHours = Math.round(totalMinutes / 60);

        const statsRes = await supabaseAdmin
          .from('user_statistics')
          .select('id, totalpoints')
          .eq('userid', userId)
          .maybeSingle();

        if (statsRes.data?.id) {
          // Update existing stats - ensure XP is at least completedCount * 100
          await supabaseAdmin
            .from('user_statistics')
            .update({
              coursescompleted: completedCount,
              totallearninghours: totalHours,
              totalpoints: Math.max(statsRes.data?.totalpoints || 0, completedCount * 100),
              updatedat: new Date().toISOString(),
            })
            .eq('userid', userId);
        } else {
          // Create new stats - initialize with correct values
          await supabaseAdmin
            .from('user_statistics')
            .insert([{
              userid: userId,
              coursescompleted: completedCount,
              totallearninghours: totalHours,
              totalcoursesenrolled: enrollments.data?.length || 1,
              totalpoints: completedCount * 100,
              currentstreak: 1,
            }]);
        }
        console.log(`[COMPLETION] Updated stats for user ${userId}: completed=${completedCount}, hours=${totalHours}, xp=${completedCount * 100}`);
      } catch (statsErr) {
        console.error('Error updating user statistics after course completion:', statsErr);
      }
    }

    res.json(data);
  } catch (err) {
    console.error('Error updating enrollment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});