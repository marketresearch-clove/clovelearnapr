import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactPlayer from 'react-player';
import DocViewer, { DocViewerRenderers } from 'react-doc-viewer';
import { courseService } from '../lib/courseService';
import { durationService } from '../lib/durationService';
import { lessonService } from '../lib/lessonService';
import { enrollmentService } from '../lib/enrollmentService';
import { feedbackService } from '../lib/feedbackService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import pdfFile from '../Assets/business-risk-management.pdf';
import pptxFile from '../Assets/business-risk-management.pptx';
import videoFile from '../Assets/main-output-1.mp4';

interface CourseData {
  id: string;
  title: string;
  description?: string;
  instructorname: string;
  thumbnail?: string;
  averagerating: number;
  totalstudents: number;
  createdat?: string;
  category: string;
  duration: number;
  level: string;
}

interface CourseSkill {
  id: string;
  name: string;
  family: string;
}

interface Module {
  id: string;
  title: string;
  lessons: Array<{
    id: string;
    title: string;
    duration: string;
    isFree: boolean;
  }>;
}

import { courseCompletionService } from '../lib/courseCompletionService';

const CourseDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPdf, setShowPdf] = useState(false);
  const [showPptx, setShowPptx] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [instructorProfile, setInstructorProfile] = useState<any>(null);
  const [syllabus, setSyllabus] = useState<Module[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [courseProgress, setCourseProgress] = useState(0);
  const [courseSkills, setCourseSkills] = useState<CourseSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [retaking, setRetaking] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [userFeedback, setUserFeedback] = useState<string>('');
  const [feedbackStats, setFeedbackStats] = useState<any>(null);
  const [allFeedback, setAllFeedback] = useState<any[]>([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [enrollmentCount, setEnrollmentCount] = useState(0);

  const checkEnrollmentStatus = async () => {
    if (!user?.id || !id) return;
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, completed, progress')
        .eq('userid', user.id)
        .eq('courseid', id)
        .maybeSingle();

      setIsEnrolled(!!data);
      const progress = data?.progress || 0;
      const isCompletedState = data?.completed || progress >= 100;

      setIsCompleted(isCompletedState);
      setCourseProgress(progress);

      // If course is completed (or progress is 100%), ensure skills are assigned and DB is updated
      if (isCompletedState && user?.id && id) {
        courseCompletionService.markCourseAsCompleted(user.id, id)
          .catch(err => console.error('Error ensuring skills assigned:', err));
      }
    } catch (err) {
      console.error('Error checking enrollment:', err);
      setIsEnrolled(false);
      setIsCompleted(false);
      setCourseProgress(0);
    }
  };

  const handleRetakeCourse = async () => {
    if (!user?.id || !id) return;

    const confirmed = window.confirm(
      'Are you sure you want to retake this course? This will reset all your progress, including completed lessons.'
    );

    if (!confirmed) return;

    setRetaking(true);
    try {
      await enrollmentService.retakeCourse(user.id, id);
      await checkEnrollmentStatus();
      alert('Course progress has been reset. You can now start the course again!');
      const firstLesson = syllabus[0]?.lessons[0]?.id;
      if (firstLesson) {
        navigate(`/lesson/${id}/${firstLesson}`, { state: { retake: true } });
      }
    } catch (err) {
      console.error('Error retaking course:', err);
      alert('Failed to reset course progress. Please try again.');
    } finally {
      setRetaking(false);
    }
  };

  const handleStartLearning = async () => {
    if (!user?.id || !id) {
      alert('Please log in first');
      return;
    }

    const firstLesson = syllabus[0]?.lessons[0]?.id;
    if (!firstLesson) {
      alert('No lessons available in this course');
      return;
    }

    if (isEnrolled) {
      navigate(`/lesson/${id}/${firstLesson}`);
      return;
    }

    setEnrolling(true);
    try {
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .insert([{
          userid: user.id,
          courseid: id,
          progress: 0,
          completed: false,
          hoursspent: 0,
        }])
        .select()
        .single();

      if (enrollmentError) throw enrollmentError;

      const statsResult = await supabase
        .from('user_statistics')
        .select('id, totalcoursesenrolled')
        .eq('userid', user.id)
        .maybeSingle();

      if (statsResult.data) {
        const currentCount = (statsResult.data as any).totalcoursesenrolled || 0;
        await supabase
          .from('user_statistics')
          .update({
            totalcoursesenrolled: currentCount + 1,
            updatedat: new Date().toISOString(),
          })
          .eq('userid', user.id);
      } else {
        await supabase
          .from('user_statistics')
          .insert([{
            userid: user.id,
            totalcoursesenrolled: 1,
            totallearninghours: 0,
            coursescompleted: 0,
            createdat: new Date().toISOString(),
            updatedat: new Date().toISOString(),
          }]);
      }

      setIsEnrolled(true);
      navigate(`/lesson/${id}/${firstLesson}`);
    } catch (err) {
      console.error('Error enrolling in course:', err);
      alert('Failed to enroll in course. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const calculateLessonDuration = (lesson: any): number => {
    // If duration is set and greater than 0, use it
    if (lesson.duration && lesson.duration > 0) {
      return lesson.duration;
    }

    // Calculate from content blocks
    let totalMinutes = 0;
    let contentBlocks: any[] = [];

    try {
      if (lesson.content) {
        if (typeof lesson.content === 'string') {
          contentBlocks = JSON.parse(lesson.content);
        } else {
          contentBlocks = Array.isArray(lesson.content) ? lesson.content : [];
        }
      }
    } catch (e) {
      console.error('Error parsing lesson content:', e);
      return 0;
    }

    contentBlocks.forEach((block: any) => {
      if (block.type === 'text') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = block.content || '';
        const text = tempDiv.textContent || tempDiv.innerText || '';
        const wordCount = text.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
        // 100 words = 0.6 minutes (36 seconds)
        totalMinutes += (wordCount / 100) * 0.6;
      } else if (block.type === 'pdf') {
        // 2 minutes per page
        const pages = block.data?.pages || 1;
        totalMinutes += pages * 2;
      } else if (block.type === 'video') {
        // Default 5 mins for video if not specified
        totalMinutes += 5;
      } else if (block.type === 'quiz') {
        // Default 5 mins for quiz
        totalMinutes += 5;
      } else if (block.type === 'flashcard') {
        // 1-2 minutes per card on average
        const cardCount = block.data?.totalCards || 10;
        totalMinutes += Math.max(5, Math.ceil(cardCount * 1.5));
      }
    });

    return Math.ceil(totalMinutes || 0);
  };

  const fetchCourseSyllabus = async (courseId: string) => {
    try {
      const lessons = await lessonService.getLessonsByCourseId(courseId);

      if (!lessons || lessons.length === 0) {
        setSyllabus([]);
        setTotalDuration(0);
        return;
      }

      // Calculate total duration from all lessons
      const totalMinutes = lessons.reduce((sum: number, lesson: any) => {
        return sum + calculateLessonDuration(lesson);
      }, 0);
      setTotalDuration(totalMinutes);

      // Group lessons by module_order
      const modulesMap = new Map<number, any[]>();

      lessons.forEach((lesson: any) => {
        const moduleOrder = lesson.module_order || 0;
        if (!modulesMap.has(moduleOrder)) {
          modulesMap.set(moduleOrder, []);
        }
        modulesMap.get(moduleOrder)!.push(lesson);
      });

      // Convert to Module array format
      const modules: Module[] = Array.from(modulesMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map((entry) => ({
          id: `module-${entry[0]}`,
          title: entry[1][0]?.module_title || `Module ${entry[0]}`,
          lessons: entry[1].map((lesson: any) => ({
            id: lesson.id,
            title: lesson.title,
            duration: `${calculateLessonDuration(lesson)} min`,
            isFree: !lesson.islocked, // Free if not locked
          })),
        }));

      setSyllabus(modules);
    } catch (err) {
      console.error('Error fetching course syllabus:', err);
      setSyllabus([]);
      setTotalDuration(0);
    }
  };

  const loadFeedbackData = useCallback(async (courseId: string) => {
    try {
      setFeedbackLoading(true);

      // Get feedback stats
      const stats = await feedbackService.getCourseFeedbackStats(courseId);
      setFeedbackStats(stats);

      // Get all feedback for this course
      const feedback = await feedbackService.getCourseFeedback(courseId);
      setAllFeedback(feedback || []);

      // Get user's existing feedback if logged in
      if (user?.id) {
        const userFeedbackData = await feedbackService.getUserFeedback(courseId, user.id);
        if (userFeedbackData) {
          setUserRating(userFeedbackData.rating);
          setUserFeedback(userFeedbackData.feedback || '');
        }
      }

      // Get enrollment count
      const { count: enrollmentCount, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('courseid', courseId);

      if (!enrollmentError && enrollmentCount !== null) {
        setEnrollmentCount(enrollmentCount);
      }
    } catch (err) {
      console.error('Error loading feedback data:', err);
    } finally {
      setFeedbackLoading(false);
    }
  }, [user?.id]);

  const handleSubmitFeedback = async () => {
    if (!user?.id || !id || userRating === 0) {
      alert('Please provide a rating');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await feedbackService.submitFeedback(id, user.id, userRating, userFeedback);
      alert('Thank you for your feedback!');

      // Reload feedback data
      await loadFeedbackData(id);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const fetchCourseSkills = useCallback(async (courseId: string) => {
    try {
      setSkillsLoading(true);
      const { data, error } = await supabase
        .from('skill_course_mappings')
        .select(`
          skills (id, name, family)
        `)
        .eq('courseid', courseId);

      if (error) throw error;

      const skills = data?.map((mapping: any) => mapping.skills).filter(Boolean) || [];
      setCourseSkills(skills);
    } catch (err) {
      console.error('Error fetching course skills:', err);
      setCourseSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const loadCourseDetails = useCallback(async () => {
    if (!id) {
      setError('Course ID not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const courseDetail = await courseService.getCourseById(id);
      if (!courseDetail) {
        setError('Course not found');
        setLoading(false);
        return;
      }

      setCourseData(courseDetail);

      // Fetch instructor profile using instructorid
      if (courseDetail.instructorid) {
        const { data: instructor, error: instructorError } = await supabase
          .from('profiles')
          .select('id, fullname, avatarurl')
          .eq('id', courseDetail.instructorid)
          .single();

        if (instructor && !instructorError) {
          setInstructorProfile(instructor);
        }
      }

      // Fetch course syllabus (lessons organized by modules)
      if (courseDetail.id) {
        await fetchCourseSyllabus(courseDetail.id);
      }

      // Fetch course skills
      if (courseDetail.id) {
        fetchCourseSkills(courseDetail.id);
      }

      // Fetch feedback data
      if (courseDetail.id) {
        loadFeedbackData(courseDetail.id);
      }
    } catch (err) {
      console.error('Error loading course details:', err);
      setError('Failed to load course details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, fetchCourseSkills, loadFeedbackData]);

  useEffect(() => {
    loadCourseDetails();
  }, [loadCourseDetails]);

  useEffect(() => {
    checkEnrollmentStatus();
  }, [id, user?.id]);

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4f46e5] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading course details...</p>
          </div>
        </div>
      )}

      {error || !courseData ? (
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium mb-2">Unable to Load Course</p>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button
              onClick={() => navigate('/catalog')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Back to Catalog
            </button>
          </div>
        </div>
      ) : courseData && (() => {
        const course = {
          id: courseData.id,
          title: courseData.title,
          description: courseData.description || 'No description available',
          instructor: {
            name: courseData.instructorname,
            role: `${courseData.level} Course`,
            avatar: instructorProfile?.avatarurl || `https://i.pravatar.cc/150?u=${courseData.instructorname}`,
          },
          thumbnail: courseData.thumbnail || 'https://picsum.photos/800/450',
          rating: courseData.averagerating || 0,
          students: courseData.totalstudents || 0,
          lastUpdated: courseData.createdat ? new Date(courseData.createdat).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Recently',
          language: 'English',
          syllabus: syllabus.length > 0 ? syllabus : [],
        };



        return (
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Breadcrumbs */}
            <div className="flex items-center text-sm text-black/50 gap-2">
              <span className="cursor-pointer hover:text-[#4f46e5]" onClick={() => navigate('/catalog')}>Catalog</span>
              <span className="material-symbols-rounded text-base">chevron_right</span>
              <span className="text-black font-medium truncate">{course.title}</span>
            </div>

            {/* Header Card */}
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-300 flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/3">
                <img src={course.thumbnail} alt={course.title} className="w-full h-auto rounded-2xl shadow-md" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="bg-[#4f46e5]/10 text-[#4f46e5] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Bestseller</span>
                  <div className="flex items-center text-yellow-500 gap-1 text-sm font-bold">
                    <span className="material-symbols-rounded text-base">star</span> {course.rating}
                  </div>
                  <span className="text-black/50 text-sm">({course.students.toLocaleString()} students)</span>
                  {isCompleted && (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-rounded text-sm">check_circle</span>
                      Completed
                    </span>
                  )}
                  {isEnrolled && !isCompleted && courseProgress > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      {Math.min(100, courseProgress)}% Complete
                    </span>
                  )}
                </div>

                <h1 className="text-3xl lg:text-4xl font-heading font-bold text-black mb-4">{course.title}</h1>
                <p className="text-black/70 mb-6 leading-relaxed">{course.description}</p>

                <div className="flex items-center gap-3 mb-8">
                  <img
                    src={course.instructor.avatar}
                    alt={course.instructor.name}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = `https://i.pravatar.cc/150?u=${encodeURIComponent(course.instructor.name)}`;
                    }}
                  />
                  <div>
                    <p className="text-sm font-bold text-black">{course.instructor.name}</p>
                    <p className="text-xs text-black/50">{course.instructor.role}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  {isCompleted ? (
                    <>
                      <button
                        onClick={handleStartLearning}
                        className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-green-600/20 flex items-center gap-2"
                      >
                        View Course <span className="material-symbols-rounded">visibility</span>
                      </button>
                      <button
                        onClick={handleRetakeCourse}
                        disabled={retaking}
                        className="bg-[#4f46e5] text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-[#4f46e5]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {retaking ? 'Resetting...' : 'Retake Course'} <span className="material-symbols-rounded">refresh</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleStartLearning}
                      disabled={enrolling}
                      className="bg-[#4f46e5] text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-[#4f46e5]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {enrolling ? 'Enrolling...' : (isEnrolled && !isCompleted) ? 'Continue Learning' : 'Start Learning'} <span className="material-symbols-rounded">play_circle</span>
                    </button>
                  )}
                  <button className="bg-white border border-gray-300 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2">
                    <span className="material-symbols-rounded">bookmark</span> Save
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Col - Syllabus */}
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-black mb-4">Course Content</h2>
                  <div className="bg-white rounded-2xl border border-gray-300 overflow-hidden">
                    {course.syllabus.length > 0 ? (
                      course.syllabus.map((module, idx) => (
                        <div key={module.id} className="border-b border-gray-200 last:border-0">
                          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between font-semibold text-black">
                            <span>Module {idx + 1}: {module.title}</span>
                            <span className="text-xs text-black/50 font-normal">{module.lessons.length} lessons</span>
                          </div>
                          <div className="divide-y divide-gray-200">
                            {module.lessons.map(lesson => (
                              <div
                                key={lesson.id}
                                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group"
                                onClick={() => navigate(`/lesson/${course.id}/${lesson.id}`)}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-black/40 group-hover:bg-[#4f46e5]/10 group-hover:text-[#4f46e5] transition-colors">
                                    <span className="material-symbols-rounded text-lg">play_arrow</span>
                                  </div>
                                  <span className="text-black group-hover:text-[#4f46e5] transition-colors">{lesson.title}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {lesson.isFree && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Preview</span>}
                                  <span className="text-sm text-black/50">{lesson.duration}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-black/50">
                        <span className="material-symbols-rounded text-4xl block mb-2">info</span>
                        <p>No lessons available for this course yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-black mb-4">Description</h2>
                  <div className="bg-white rounded-2xl border border-gray-300 p-6 text-black/70 leading-relaxed space-y-4">
                    {(() => {
                      const desc = course.description;
                      const lines = desc.split('\n').filter(line => line.trim());
                      const isBulletList = lines.some(line => /^[\d\.\-\*•]/.test(line.trim()));

                      if (isBulletList) {
                        return (
                          <ul className="list-disc list-inside space-y-2 marker:text-[#4f46e5]">
                            {lines.map((line, idx) => {
                              const cleanLine = line.replace(/^[\d\.\-\*•]\s*/, '').trim();
                              return cleanLine ? <li key={idx} className="text-black/70">{cleanLine}</li> : null;
                            })}
                          </ul>
                        );
                      }
                      return <div className="whitespace-pre-wrap">{desc}</div>;
                    })()}
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-black mb-4">Resources & Downloads</h2>
                  <div className="bg-white rounded-2xl border border-gray-300 p-6 text-black/70 leading-relaxed space-y-4">

                    <ul className="list-disc list-inside space-y-2 marker:text-[#4f46e5]">
                      <li onClick={() => setShowPdf(!showPdf)} className="text-[#4f46e5] hover:underline cursor-pointer">{showPdf ? 'Hide' : 'Show'} PDF</li>
                      <li onClick={() => setShowPptx(!showPptx)} className="text-[#4f46e5] hover:underline cursor-pointer">{showPptx ? 'Hide' : 'Show'} PPTX</li>
                    </ul>
                    {showPdf && (
                      <DocViewer
                        pluginRenderers={DocViewerRenderers}
                        documents={[{ uri: pdfFile }]}
                        style={{ height: 500 }}
                      />
                    )}
                    {showPptx && (
                      <iframe
                        src={`https://view.officeapps.live.com/op/embed.aspx?src=http://localhost:3001/pptx`}
                        width="100%"
                        height="500px"
                        frameBorder="0"
                      ></iframe>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Col - Info */}
              <div className="space-y-6">
                {courseSkills.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-300 p-6">
                    <h3 className="font-bold text-black mb-4 flex items-center gap-2">
                      <span className="material-symbols-rounded text-lg">psychology</span>
                      Skills You'll Gain
                    </h3>
                    <div className="space-y-2">
                      {skillsLoading ? (
                        <p className="text-gray-500 text-sm">Loading skills...</p>
                      ) : (
                        courseSkills.map((skill) => (
                          <div key={skill.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                            <span className="material-symbols-rounded text-blue-600 text-lg flex-shrink-0">star</span>
                            <div>
                              <p className="font-semibold text-black text-sm">{skill.name}</p>
                              <p className="text-xs text-gray-500">{skill.family}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-gray-300 p-6">
                  <h3 className="font-bold text-black mb-4">Course Features</h3>
                  <ul className="space-y-4 text-sm text-black/70">
                    <li className="flex items-center gap-3">
                      <span className="material-symbols-rounded text-black/40">schedule</span>
                      <span>{durationService.minutesToHours(totalDuration)} hours on-demand video</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="material-symbols-rounded text-black/40">description</span>
                      <span>5 downloadable resources</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="material-symbols-rounded text-black/40">all_inclusive</span>
                      <span>Full lifetime access</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="material-symbols-rounded text-black/40">devices</span>
                      <span>Access on mobile and desktop</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="material-symbols-rounded text-black/40">workspace_premium</span>
                      <span>Certificate of completion</span>
                    </li>
                  </ul>
                </div>

                {/* Feedback Section */}
                <div className="bg-white rounded-2xl border border-gray-300 p-6">
                  <h3 className="font-bold text-black mb-4">Course Ratings & Reviews</h3>

                  {!feedbackLoading && feedbackStats && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="flex-shrink-0">
                            <div className="text-3xl font-bold text-black">{feedbackStats.averageRating.toFixed(1)}</div>
                            <div className="flex items-center gap-1 mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className={`material-symbols-rounded text-base ${star <= Math.round(feedbackStats.averageRating) ? 'text-yellow-400' : 'text-gray-300'}`}>
                                  star
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{feedbackStats.totalRatings} ratings</p>
                          </div>
                          <div className="flex-1 space-y-2 text-xs w-full">
                            {[5, 4, 3, 2, 1].map((rating) => (
                              <div key={rating} className="flex items-center gap-2">
                                <span className="w-10 flex-shrink-0">{rating} star</span>
                                <div className="flex-1 bg-gray-300 rounded h-2 min-w-0">
                                  <div
                                    className="bg-yellow-400 h-2 rounded"
                                    style={{
                                      width: `${feedbackStats.totalRatings > 0 ? (feedbackStats.ratingDistribution[rating] / feedbackStats.totalRatings) * 100 : 0}%`
                                    }}
                                  />
                                </div>
                                <span className="w-6 text-right flex-shrink-0">{feedbackStats.ratingDistribution[rating]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {
                    user?.id && (
                      <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <h4 className="font-semibold text-black mb-3">Share Your Feedback</h4>
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-black mb-2">Rating</label>
                          <div className="flex gap-1.5 w-fit">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setUserRating(star)}
                                className="focus:outline-none transition-transform hover:scale-110 w-8 h-8 flex items-center justify-center"
                              >
                                <span
                                  className={`material-symbols-rounded text-2xl cursor-pointer ${star <= userRating ? 'text-yellow-400' : 'text-gray-300'
                                    }`}
                                >
                                  star
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-black mb-2">Your Feedback (Optional)</label>
                          <textarea
                            value={userFeedback}
                            onChange={(e) => setUserFeedback(e.target.value)}
                            placeholder="Share your experience with this course..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                            rows={3}
                          />
                        </div>
                        <button
                          onClick={handleSubmitFeedback}
                          disabled={submittingFeedback || userRating === 0}
                          className="w-full px-4 py-2 bg-[#4f46e5] text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors disabled:cursor-not-allowed"
                        >
                          {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                      </div>
                    )
                  }

                  {
                    !user?.id && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                        <p className="text-sm text-gray-600 mb-3">Sign in to leave your feedback</p>
                        <button
                          onClick={() => navigate('/signin')}
                          className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Sign In
                        </button>
                      </div>
                    )
                  }

                  {
                    allFeedback.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-black mb-3">Recent Reviews ({allFeedback.length})</h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {allFeedback.slice(0, 5).map((feedback: any, idx: number) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-medium text-black">{feedback.profiles?.fullname || 'Anonymous'}</p>
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <span
                                        key={star}
                                        className={`material-symbols-rounded text-sm ${star <= feedback.rating ? 'text-yellow-400' : 'text-gray-300'
                                          }`}
                                      >
                                        star
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {feedback.created_at ? new Date(feedback.created_at).toLocaleDateString() : ''}
                                </p>
                              </div>
                              {feedback.feedback && (
                                <p className="text-sm text-gray-700">{feedback.feedback}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                </div >
              </div >
            </div >
          </div >
        );
      })()}
    </>
  );
};

export default CourseDetailPage;