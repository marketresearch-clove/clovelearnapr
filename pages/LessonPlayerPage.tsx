import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { lessonService } from '../lib/lessonService';
import { durationService } from '../lib/durationService';
import { assessmentService } from '../lib/assessmentService';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { learningHoursService } from '../lib/learningHoursService';
import { lessonProgressService } from '../lib/lessonProgressService';
import { userStatisticsService } from '../lib/userStatisticsService';
import { enrollmentService } from '../lib/enrollmentService';
import { quizResultsService } from '../lib/quizResultsService';
import { courseCompletionService } from '../lib/courseCompletionService';
import { convertYouTubeUrl, isYouTubeUrl } from '../lib/youtubeHelper';
import { printAcknowledgement, downloadAcknowledgementPDF } from '../lib/acknowledgementDocumentService';

import PdfViewer from '../components/PdfViewer';
import InlineQuizRenderer from '../components/InlineQuizRenderer';
import FlashcardRenderer from '../components/FlashcardRenderer';
import ReactPlayer from 'react-player';
import TextToSpeech, { TextToSpeechRef } from '../components/TextToSpeech';

// Custom scrollbar styles
const customScrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;

interface LessonData {
  id: string;
  title: string;
  type: 'text' | 'pdf' | 'video' | 'quiz' | 'flashcard';
  content?: any;
  duration?: number;
  completed?: boolean;
  moduletitle?: string;
  moduleorder?: number;
  islocked?: boolean;
}

interface Module {
  title: string;
  lessons: any[];
}

const LessonPlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, lessonId } = useParams();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [activeLesson, setActiveLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [associatedAssessment, setAssociatedAssessment] = useState<any>(null);
  const [contentBlocks, setContentBlocks] = useState<any[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [showTableOfContents, setShowTableOfContents] = useState(false);
  const [completedLessonsCount, setCompletedLessonsCount] = useState(0);
  const [totalLessonsCount, setTotalLessonsCount] = useState(0);
  const [courseProgressPercentage, setCourseProgressPercentage] = useState(0);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [pdfScrolledToEnd, setPdfScrolledToEnd] = useState(false);
  const [acknowledgedBlocks, setAcknowledgedBlocks] = useState<Record<string, boolean>>({});
  const [signatureValues, setSignatureValues] = useState<Record<string, string>>({});
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playerVolume, setPlayerVolume] = useState(1);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [showMobileVolumeHover, setShowMobileVolumeHover] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const [playedDuration, setPlayedDuration] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTTSBlockId, setCurrentTTSBlockId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const playerRef = useRef<any>(null);
  const lessonStartTimeRef = useRef<number>(0);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const ttsRef = useRef<TextToSpeechRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const courseCompletionInProgressRef = useRef(false);
  const courseCompletionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }

    // Cleanup on component unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (courseId) {
      loadLessonsData();
    }

    // Cleanup function to abort any pending requests when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (courseCompletionTimeoutRef.current) {
        clearTimeout(courseCompletionTimeoutRef.current);
      }
    };
  }, [courseId, lessonId]);

  // Reset TTS state when lesson changes
  useEffect(() => {
    setIsTTSPlaying(false);
    setIsPlayerPlaying(false);
    setCurrentTTSBlockId(null);
  }, [activeLesson?.id]);

  // Add effect to check for retake status
  useEffect(() => {
    const checkRetakeStatus = async () => {
      if (!user?.id || !courseId) return;

      // Check if we came from a retake action or if enrollment is reset
      const isRetake = location.state?.retake;
      let shouldReset = isRetake;

      if (!shouldReset) {
        const enrollment = await enrollmentService.getEnrollment(user.id, courseId);
        if (enrollment && enrollment.progress === 0 && !enrollment.completed) {
          shouldReset = true;
        }
      }

      if (shouldReset) {
        // If enrollment is reset (progress 0, not completed), ensure local state reflects this
        setCourseProgressPercentage(0);
        setCourseCompleted(false);
        setCompletedLessonsCount(0);

        // Refresh lesson data to clear completion flags
        loadLessonsData();
      }
    };

    checkRetakeStatus();
  }, [courseId, user?.id, location.state]);

  useEffect(() => {
    const completed = modules.reduce((sum, module) =>
      sum + module.lessons.filter(l => l.completed).length, 0);
    setCompletedLessonsCount(completed);

    const total = modules.reduce((sum, module) => sum + module.lessons.length, 0);
    if (total > 0) {
      const percentage = Math.round((completed / total) * 100);
      setCourseProgressPercentage(percentage);
      setCourseCompleted(percentage === 100);

      if (user?.id && courseId && percentage === 100) {
        updateCourseCompletion(percentage);
      }
    }
  }, [modules, user?.id, courseId]);

  const ensureCourseCompletion = async (percentage: number) => {
    if (!user?.id || !courseId || courseCompletionInProgressRef.current) return;
    courseCompletionInProgressRef.current = true;

    try {
      if (percentage !== 100) {
        return;
      }

      const isFullyComplete = await validateCourseCompletion();
      if (!isFullyComplete) {
        console.log('[COURSE_COMPLETION] Course reached 100% progress but requirements are not fully met. Skipping final completion.');
        return;
      }

      let enrollment = await enrollmentService.getEnrollment(user.id, courseId);
      if (!enrollment) {
        console.warn('[COURSE_COMPLETION] No enrollment found for user, creating one before completing the course');
        enrollment = await enrollmentService.enrollCourse(user.id, courseId);
      }

      if (enrollment && !enrollment.completed) {
        const { data: course } = await supabase
          .from('courses')
          .select('duration')
          .eq('id', courseId)
          .single();

        const courseDuration = course?.duration || 0;
        await enrollmentService.completeCourse(user.id, courseId, courseDuration);
      }

      const skillAssignResult = await courseCompletionService.markCourseAsCompleted(user.id, courseId);
      console.log('Skills assigned:', skillAssignResult);

      if (courseCompletionTimeoutRef.current) {
        clearTimeout(courseCompletionTimeoutRef.current);
      }
      courseCompletionTimeoutRef.current = setTimeout(() => {
        console.log('[COURSE_COMPLETION] Redirecting to dashboard after completing course');
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Error ensuring course completion:', error);
    } finally {
      courseCompletionInProgressRef.current = false;
    }
  };

  const updateCourseCompletion = async (percentage: number) => {
    if (!user?.id || !courseId) return;

    try {
      if (percentage === 100) {
        await ensureCourseCompletion(percentage);
        return;
      }

      const enrollment = await enrollmentService.getEnrollment(user.id, courseId);
      if (enrollment && !enrollment.completed) {
        await enrollmentService.updateProgress(user.id, courseId, percentage);
      }
    } catch (error) {
      console.error('Error updating course completion:', error);
    }
  };

  useEffect(() => {
    if (activeLesson && user?.id && courseId) {
      recordLessonAccess();
      lessonStartTimeRef.current = Date.now();
    }
  }, [activeLesson?.id, user?.id, courseId]);

  const recordLessonAccess = async () => {
    if (!user?.id || !activeLesson?.id || !courseId) return;

    try {
      await lessonProgressService.recordLessonAccess(user.id, activeLesson.id, courseId);

      // Only auto-enroll if lesson is LOCKED (not a free preview)
      // Free/preview lessons should not auto-enroll users
      if (activeLesson.islocked) {
        const existingEnrollment = await supabase
          .from('enrollments')
          .select('id')
          .eq('userid', user.id)
          .eq('courseid', courseId)
          .maybeSingle();

        if (!existingEnrollment.data) {
          await supabase
            .from('enrollments')
            .insert([{
              userid: user.id,
              courseid: courseId,
              progress: 0,
              completed: false,
              lastaccessedat: new Date().toISOString(),
            }]);
        } else {
          await supabase
            .from('enrollments')
            .update({ lastaccessedat: new Date().toISOString() })
            .eq('userid', user.id)
            .eq('courseid', courseId);
        }
      }
    } catch (err) {
      console.error('Error recording lesson access:', err);
    }
  };

  // Check if quiz was previously passed when assessment loads
  useEffect(() => {
    if (activeLesson?.type === 'quiz' && associatedAssessment?.id && user?.id) {
      const checkAndSetQuizPassed = async () => {
        const hasPassed = await checkQuizPassed(associatedAssessment.id);
        setQuizPassed(hasPassed);
      };
      checkAndSetQuizPassed();
    }
  }, [associatedAssessment?.id, activeLesson?.type, user?.id]);

  // Monitor quiz passed status changes and update button states
  useEffect(() => {
    if (activeLesson?.type === 'quiz') {
      console.log('Quiz status updated:', {
        quizPassed: quizPassed,
        lessonCompleted: lessonCompleted,
        markCompleteButtonEnabled: quizPassed,
        retakeQuizButtonVisible: !quizPassed,
        timestamp: new Date().toISOString()
      });
    }
  }, [quizPassed, activeLesson?.type]);

  const loadLessonsData = async () => {
    if (!courseId) return;

    // Cancel any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    setLoading(true);
    setError(null);
    try {
      const lessons = await lessonService.getLessonsByCourseId(courseId);

      // If this request was aborted, don't update state
      if (currentController.signal.aborted) {
        console.log('loadLessonsData request was aborted, skipping state updates');
        return;
      }

      if (!lessons || lessons.length === 0) {
        setError('No lessons found for this course');
        setLoading(false);
        return;
      }

      const moduleMap = new Map<string, Module>();

      let lessonProgressMap = new Map<string, any>();
      if (user?.id) {
        const progressData = await lessonProgressService.getUserLessonProgress(user.id, courseId);
        lessonProgressMap = new Map(progressData.map((p: any) => [p.lessonid, p]));
      }

      lessons.forEach((lesson: any) => {
        const moduleTitle = lesson.module_title || 'General';
        if (!moduleMap.has(moduleTitle)) {
          moduleMap.set(moduleTitle, {
            title: moduleTitle,
            lessons: []
          });
        }
        // Duration is stored in minutes in the database
        const lessonDurationMinutes = lesson.duration || 0;

        const progress = lessonProgressMap.get(lesson.id);
        const module = moduleMap.get(moduleTitle)!;
        module.lessons.push({
          id: lesson.id,
          title: lesson.title,
          duration: lessonDurationMinutes > 0 ? durationService.formatDurationForDisplay(lessonDurationMinutes) : 'N/A',
          completed: progress?.completed || false,
          type: lesson.type || 'text',
          content: lesson.content,
          moduletitle: lesson.module_title,
          moduleorder: lesson.module_order
        });
      });

      const modulesArray = Array.from(moduleMap.values());

      // Check if this request was aborted before updating state
      if (currentController.signal.aborted) {
        console.log('loadLessonsData aborted before setModules');
        return;
      }

      setModules(modulesArray);

      const totalLessons = modulesArray.reduce((sum, module) => sum + module.lessons.length, 0);

      if (currentController.signal.aborted) {
        console.log('loadLessonsData aborted before setTotalLessonsCount');
        return;
      }

      setTotalLessonsCount(totalLessons);

      let selected = null;
      if (lessonId) {
        selected = lessons.find((l: any) => l.id === lessonId);
      }

      if (!selected && lessons.length > 0) {
        selected = lessons[0];
      }

      if (selected) {
        // Duration is stored in minutes in the database
        const lessonDurationMinutes = selected.duration || 0;

        // Check if this request was aborted before setting active lesson
        if (currentController.signal.aborted) {
          console.log('loadLessonsData aborted before setActiveLesson');
          return;
        }

        setActiveLesson({
          id: selected.id,
          title: selected.title,
          type: selected.type || 'text',
          content: selected.content,
          duration: lessonDurationMinutes,
          completed: false,
          moduletitle: selected.module_title,
          islocked: selected.islocked
        });

        setQuizPassed(false);
        setPdfScrolledToEnd(false);

        if (user?.id) {
          const lessonProg = await lessonProgressService.getLessonProgress(user.id, selected.id);

          if (lessonProg) {
            setLessonProgress(lessonProg.progress || 0);
            setLessonCompleted(lessonProg.completed || false);
          }
        }

        parseContentBlocks(selected.content);

        // Load existing acknowledgements for this lesson
        if (user?.id && courseId && selected.id) {
          try {
            await loadExistingAcknowledgements(selected.id);
          } catch (err) {
            console.error('Error loading acknowledgements in loadLessonsData:', err);
            // Continue - don't let this block other loading
          }
        }

        if (selected.type === 'quiz') {
          try {
            await loadOrCreateAssessment(selected.id, courseId, selected.type, selected.title);
          } catch (err) {
            console.error('Error loading assessment in loadLessonsData:', err);
            // Continue - quiz can still be shown without assessment
            setAssociatedAssessment(null);
          }
        }
      }
    } catch (err) {
      console.error('Error loading lessons:', err);

      // Only set error if this request wasn't aborted
      if (!currentController.signal.aborted) {
        setError('Failed to load lesson content');
      }
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!currentController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const parseContentBlocks = (content: any) => {
    let blocks: any[] = [];

    if (Array.isArray(content)) {
      blocks = content;
    } else if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          blocks = parsed;
        } else {
          blocks = [{ id: '1', type: 'text', title: '', content: content, description: '' }];
        }
      } catch {
        blocks = [{ id: '1', type: 'text', title: '', content: content, description: '' }];
      }
    } else if (typeof content === 'object' && content !== null) {
      blocks = [content];
    }

    setContentBlocks(blocks);
    if (blocks.length > 0) {
      setActiveBlockId(blocks[0].id);
    }
  };

  const loadOrCreateAssessment = async (lessonId: string, courseId: string, lessonType?: string, lessonTitle?: string) => {
    try {
      const { data: existingAssessments, error: readError } = await supabase
        .from('assessments')
        .select('*')
        .eq('lessonid', lessonId);

      if (readError) {
        console.error('Error reading assessments:', readError);
        return;
      }

      if (existingAssessments && existingAssessments.length > 0) {
        setAssociatedAssessment(existingAssessments[0]);
        console.log('Assessment loaded successfully:', existingAssessments[0]);
      } else if (lessonType === 'quiz') {
        // Auto-create assessment for quiz lessons
        console.log(`Creating default assessment for quiz lesson ${lessonId}`);
        const { data: newAssessment, error: createError } = await supabase
          .from('assessments')
          .insert([{
            courseid: courseId,
            lessonid: lessonId,
            title: `Quiz: ${lessonTitle || 'Untitled'}`,
            description: 'Auto-generated assessment for quiz content',
            type: 'quiz',
            passingscore: 70,
            questions: [],
            totalquestions: 0,
            duration: 30
          }])
          .select()
          .single();

        if (createError) {
          console.warn(`Could not auto-create assessment: ${createError.message}`);
          setAssociatedAssessment(null);
        } else {
          console.log('Assessment created successfully:', newAssessment);
          setAssociatedAssessment(newAssessment);
        }
      } else {
        console.warn(`No assessment found for lesson ${lessonId}. This may be a non-quiz lesson.`);
        setAssociatedAssessment(null);
      }
    } catch (err) {
      console.error('Error loading or creating assessment:', err);
      setAssociatedAssessment(null);
    }
  };

  const checkQuizPassed = async (assessmentId: string) => {
    if (!user?.id) return false;
    try {
      const { data, error } = await supabase
        .from('assessment_results')
        .select('passed, percentage')
        .eq('assessmentid', assessmentId)
        .eq('userid', user.id)
        .order('attemptnumber', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking quiz results:', error);
        return false;
      }

      if (data && data.length > 0) {
        const lastResult = data[0];
        return lastResult.passed === true;
      }
      return false;
    } catch (err) {
      console.error('Error in checkQuizPassed:', err);
      return false;
    }
  };

  const handleQuizSubmit = async (quizResult: any) => {
    try {
      const percentage = quizResult.percentage || 0;
      const passingScore = associatedAssessment?.passingscore || 70;
      const passed = quizResult.passed !== undefined ? quizResult.passed : percentage >= passingScore;

      if (!associatedAssessment?.id) {
        console.warn('No associated assessment found in database. Proceeding with UI completion only.');
      } else {
        if (!user?.id || !activeLesson?.id || !courseId) {
          console.error('Missing required data for quiz submission');
          alert('Unable to save quiz result. Please ensure you are logged in.');
          return;
        }

        const { data: previousAttempts } = await supabase
          .from('assessment_results')
          .select('attemptnumber')
          .eq('assessmentid', associatedAssessment.id)
          .eq('userid', user.id)
          .order('attemptnumber', { ascending: false })
          .limit(1);

        const attemptNumber = (previousAttempts?.[0]?.attemptnumber || 0) + 1;

        const resultData = {
          assessmentid: associatedAssessment.id,
          userid: user.id,
          score: quizResult.score || 0,
          percentage: percentage,
          passed: passed,
          answers: quizResult.answers || {},
          timetaken: quizResult.timeTaken || 0,
          attemptnumber: attemptNumber,
          completedat: new Date().toISOString(),
        };

        console.log('Attempting to save assessment result:', resultData);

        const { data: insertedResult, error: insertError } = await supabase
          .from('assessment_results')
          .insert([resultData])
          .select();

        if (insertError) {
          console.error('Insert error details:', insertError);
          throw insertError;
        }

        console.log('Assessment result saved successfully:', {
          insertedResult,
          passed,
          percentage,
          passingScore,
          attemptNumber,
        });

        const pointsEarned = Math.round(percentage);
        const totalPoints = 100;

        const quizResultData = {
          userId: user.id,
          courseId: courseId,
          assessmentId: associatedAssessment.id,
          quizTitle: associatedAssessment.title || activeLesson?.title || 'Quiz',
          pointsEarned: pointsEarned,
          totalPoints: totalPoints,
          percentage: percentage,
          passed: passed,
          answers: quizResult.answers || {},
          timeTaken: quizResult.timeTaken || 0,
          attemptNumber: attemptNumber,
        };

        await quizResultsService.saveQuizResult(quizResultData);
        console.log('Quiz result saved successfully:', quizResultData);
      }

      // Update button state immediately after quiz completion
      if (passed) {
        console.log('Quiz passed! Enabling Mark Complete button');
        // Set both states to enable Mark Complete button
        setQuizPassed(true);
        setLessonCompleted(false);

        // Show success message
        alert(`Congratulations! You passed the quiz with ${percentage}%!\n\nClick the 'Mark Complete' button in the header to finish the lesson.`);
      } else {
        console.log('Quiz failed! Showing Retake Quiz button');
        setQuizPassed(false);
        setLessonCompleted(false);

        alert(`Quiz completed. Your score: ${percentage}%\n\nPassing score: ${passingScore}%\n\nPlease retake the quiz to pass.`);
      }
    } catch (err) {
      console.error('Error saving assessment result:', err);
      alert('Failed to save assessment result. Please contact support.');
    }
  };

  const updateLessonProgress = async (progress: number, completed: boolean = false) => {
    if (!user?.id || !activeLesson?.id || !courseId) {
      console.error('Missing required data for updating progress:', { userId: user?.id, lessonId: activeLesson?.id, courseId });
      return;
    }

    setLessonProgress(progress);
    console.log(`Updating lesson progress: Lesson=${activeLesson.id}, Progress=${progress}, Completed=${completed}`);

    try {
      const existingProgress = await lessonProgressService.getLessonProgress(user.id, activeLesson.id);

      // If requesting to mark as complete, always set the UI state
      if (completed) {
        setLessonCompleted(true);
      }

      // Skip database update if already completed, but still set UI state above
      if (existingProgress?.completed && completed) {
        console.log('Lesson already completed in database, skipping database update but UI is now reflected');
        return;
      }

      // Calculate elapsed time in seconds when completing the lesson
      const elapsedSeconds = completed
        ? Math.max(1, Math.round((Date.now() - lessonStartTimeRef.current) / 1000))
        : 0;

      await lessonProgressService.updateLessonProgress(user.id, activeLesson.id, courseId, progress, completed, elapsedSeconds);

      if (completed) {
        await updateEnrollmentProgress();
        await recordLearningHours();

        const progressData = await lessonProgressService.getUserLessonProgress(user.id, courseId);
        if (progressData.length > 0) {
          const lessonProgressMap = new Map(progressData.map((p: any) => [p.lessonid, p]));

          const updatedModules = modules.map(module => ({
            ...module,
            lessons: module.lessons.map(lesson => ({
              ...lesson,
              completed: lessonProgressMap.get(lesson.id)?.completed || false,
            })),
          }));

          setModules(updatedModules);

          const totalLessons = updatedModules.reduce((sum, module) => sum + module.lessons.length, 0);
          const completedLessons = updatedModules.reduce((sum, module) => sum + module.lessons.filter(lesson => lesson.completed).length, 0);
          const updatedPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
          setCourseProgressPercentage(updatedPercentage);
          setCourseCompleted(updatedPercentage === 100);

          if (updatedPercentage === 100) {
            await updateCourseCompletion(updatedPercentage);
          }
        }
      }
    } catch (err) {
      console.error('Error updating lesson progress:', err);
      throw err;
    }
  };

  const validateCourseCompletion = async (): Promise<boolean> => {
    if (!user?.id || !courseId) return false;

    try {
      const allLessons = await supabase
        .from('lessons')
        .select('id, type')
        .eq('courseid', courseId);

      if (!allLessons.data || allLessons.data.length === 0) return false;

      const lessonProgress = await lessonProgressService.getUserLessonProgress(user.id, courseId);
      const completedLessons = new Set(lessonProgress.filter((l: any) => l.completed).map((l: any) => l.lessonid));

      for (const lesson of allLessons.data) {
        if (!completedLessons.has(lesson.id)) {
          console.log(`Lesson ${lesson.id} not completed`);
          return false;
        }

        if (lesson.type === 'quiz') {
          // First get the assessment ID for this lesson
          const { data: assessmentData } = await supabase
            .from('assessments')
            .select('id')
            .eq('lessonid', lesson.id)
            .maybeSingle();

          if (assessmentData?.id) {
            const quizResult = await supabase
              .from('assessment_results')
              .select('passed, percentage')
              .eq('userid', user.id)
              .eq('assessmentid', assessmentData.id)
              .eq('passed', true)
              .order('attemptnumber', { ascending: false })
              .limit(1);

            if (!quizResult.data || quizResult.data.length === 0) {
              console.log(`Quiz in lesson ${lesson.id} not passed`);
              return false;
            }
          }
        }
      }

      return true;
    } catch (err) {
      console.error('Error validating course completion:', err);
      return false;
    }
  };

  const updateEnrollmentProgress = async () => {
    if (!user?.id || !courseId) return;

    try {
      const allLessons = await supabase
        .from('lessons')
        .select('id')
        .eq('courseid', courseId);

      if (!allLessons.data || allLessons.data.length === 0) return 0;

      const totalLessons = allLessons.data.length;

      const lessonStats = await lessonProgressService.getCourseLessonStats(user.id, courseId);
      const completedLessons = lessonStats?.completedLessons || 0;
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      await supabase
        .from('enrollments')
        .update({
          progress: progressPercentage,
          lastaccessedat: new Date().toISOString(),
        })
        .eq('userid', user.id)
        .eq('courseid', courseId);

      return progressPercentage;
    } catch (err) {
      console.error('Error updating enrollment progress:', err);
      return 0;
    }
  };

  const recordLearningHours = async () => {
    if (!user?.id || !courseId) return;

    try {
      // Calculate time spent in minutes (minimum 1 minute if lesson was viewed)
      const timeSpent = Math.max(1, Math.floor((Date.now() - lessonStartTimeRef.current) / 60000));

      // Record learning hours in the learning_hours table
      await learningHoursService.recordLearningHours(user.id, courseId, timeSpent);

      // Get course duration to ensure it's captured
      const { data: courseData } = await supabase
        .from('courses')
        .select('duration')
        .eq('id', courseId)
        .single();

      const courseDuration = courseData?.duration || 0;

      // Get total accumulated hours for the course
      const totalMinutes = await learningHoursService.getCourseLearningHours(user.id, courseId);

      // Set hoursspent to the maximum of accumulated time and course duration
      // This ensures users get credit for at least the course's designed duration
      const hoursToSet = Math.max(totalMinutes || 0, courseDuration);

      // Update enrollments with total hours
      await supabase
        .from('enrollments')
        .update({
          hoursspent: hoursToSet,
          updatedat: new Date().toISOString(),
        })
        .eq('userid', user.id)
        .eq('courseid', courseId);

      // Update user statistics with recorded learning hours
      await userStatisticsService.updateLearningHours(user.id, timeSpent);
    } catch (err) {
      console.error('Error recording learning hours:', err);
    }
  };

  const updateUserStatistics = async () => {
    if (!user?.id || !courseId) return;

    try {
      const courseRes = await supabase
        .from('courses')
        .select('duration')
        .eq('id', courseId)
        .single();

      const courseDuration = courseRes.data?.duration || 0;
      const courseDurationHours = Math.round((courseDuration / 60) * 100) / 100;

      const stats = await supabase
        .from('user_statistics')
        .select('coursescompleted, totallearninghours, totalcoursesenrolled')
        .eq('userid', user.id)
        .maybeSingle();

      const completedCoursesCount = (stats.data?.coursescompleted || 0) + 1;
      const totalLearningHours = (stats.data?.totallearninghours || 0) + courseDurationHours;

      if (stats.data) {
        await supabase
          .from('user_statistics')
          .update({
            coursescompleted: completedCoursesCount,
            totallearninghours: totalLearningHours,
            totalcoursesenrolled: stats.data.totalcoursesenrolled || 0,
            updatedat: new Date().toISOString(),
          })
          .eq('userid', user.id);
      } else {
        await supabase
          .from('user_statistics')
          .insert([{
            userid: user.id,
            coursescompleted: 1,
            totallearninghours: courseDurationHours,
            totalcoursesenrolled: 1,
          }]);
      }
    } catch (err) {
      console.error('Error updating user statistics:', err);
    }
  };

  const handleLessonClick = async (lesson: any) => {
    try {
      // Prevent navigation if courseId is not available
      if (!courseId) {
        console.error('Cannot switch lessons: courseId is missing');
        return;
      }

      console.log('Switching to lesson:', {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonType: lesson.type,
        courseId
      });

      // Update the URL first to persist lesson selection
      navigate(`/lesson/${courseId}/${lesson.id}`, { replace: true });

      // Set the active lesson
      setActiveLesson({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type || 'text',
        content: lesson.content,
        duration: lesson.duration,
        completed: lesson.completed || false,
        moduletitle: lesson.moduletitle
      });

      // Reset progress states
      setLessonProgress(0);
      setLessonCompleted(false);
      setQuizPassed(false);
      setPdfScrolledToEnd(false);
      setAcknowledgedBlocks({});
      setSignatureValues({});
      parseContentBlocks(lesson.content);

      // Load the actual lesson progress from database
      if (user?.id && lesson.id && courseId) {
        try {
          const lessonProg = await lessonProgressService.getLessonProgress(user.id, lesson.id);

          if (lessonProg) {
            setLessonProgress(lessonProg.progress || 0);
            setLessonCompleted(lessonProg.completed || false);
          }
        } catch (err) {
          console.error('Error loading lesson progress:', err);
          // Continue - don't let this error block the lesson switch
        }
      }

      // Load existing acknowledgements for this lesson
      if (user?.id && courseId && lesson.id) {
        try {
          await loadExistingAcknowledgements(lesson.id);
        } catch (err) {
          console.error('Error loading acknowledgements:', err);
          // Continue - don't let this error block the lesson switch
        }
      }

      // Load assessment if this is a quiz lesson
      if (lesson.type === 'quiz') {
        try {
          await loadOrCreateAssessment(lesson.id, courseId || '', lesson.type, lesson.title);
          console.log('Assessment load attempt completed for quiz lesson');
        } catch (err) {
          console.error('Error loading assessment for quiz:', err);
          // Continue - assessment is optional, quiz can still be shown
          setAssociatedAssessment(null);
        }
      }

      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }

      console.log('Lesson switch completed successfully');
    } catch (err) {
      console.error('Critical error in handleLessonClick:', err);
      // DON'T re-throw - stay on the page to show what went wrong
      alert(`Error switching lessons: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Handle text-to-speech sentence changes
  const onSentenceChange = (sentenceIndex: number, totalSentencesCount: number) => {
    setCurrentSentenceIndex(sentenceIndex);
    setTotalSentences(totalSentencesCount);
  };

  // Handle word changes from TTS
  const onWordChange = (sentenceIndex: number, wordIndex: number, sentenceText: string) => {
    // Text highlighting removed
  };

  const loadExistingAcknowledgements = async (lessonId: string) => {
    if (!user?.id || !courseId) return;

    try {
      const { data, error } = await supabase
        .from('course_acknowledgements')
        .select('block_id, signature, acknowledged_at')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('lesson_id', lessonId);

      if (error) {
        console.error('Error loading acknowledgements:', error);
        return;
      }

      if (data && data.length > 0) {
        const newSignatures = { ...signatureValues };
        const newAcknowledged = { ...acknowledgedBlocks };

        data.forEach((ack: any) => {
          newSignatures[ack.block_id] = ack.signature || '';
          newAcknowledged[ack.block_id] = true;
        });

        setSignatureValues(newSignatures);
        setAcknowledgedBlocks(newAcknowledged);
        console.log(`Loaded ${data.length} existing acknowledgement(s) for lesson ${lessonId}`);
      }
    } catch (err) {
      console.error('Error in loadExistingAcknowledgements:', err);
    }
  };

  // Check if an acknowledgement block should be locked based on previous lesson/quiz completion
  const isAcknowledgementLocked = (blockIndex: number): boolean => {
    if (!activeLesson?.content) return false;

    let blocks: any[] = [];
    if (Array.isArray(activeLesson.content)) {
      blocks = activeLesson.content;
    } else if (typeof activeLesson.content === 'string') {
      try {
        const parsed = JSON.parse(activeLesson.content);
        blocks = Array.isArray(parsed) ? parsed : [];
      } catch {
        blocks = [];
      }
    }

    // Check all blocks before the current acknowledgement
    for (let i = 0; i < blockIndex; i++) {
      const block = blocks[i];

      // If there's a quiz block before this acknowledgement, check if quiz was passed
      if (block.type === 'quiz') {
        if (!quizPassed) {
          return true; // Lock if quiz not passed
        }
      }
    }

    // Also check if all previous lessons in the course are completed
    if (modules && modules.length > 0) {
      let allPreviousCompleted = true;
      let foundCurrentLesson = false;

      for (const module of modules) {
        for (const lesson of module.lessons) {
          if (lesson.id === activeLesson?.id) {
            foundCurrentLesson = true;
            break;
          }
          if (!lesson.completed && lesson.type !== 'acknowledgement') {
            allPreviousCompleted = false;
            break;
          }
        }
        if (foundCurrentLesson) break;
      }

      if (!allPreviousCompleted) {
        return true; // Lock if not all previous lessons are completed
      }
    }

    return false;
  };

  const getLessonIcon = (lesson: any) => {
    if (lesson.completed) return 'check_circle';
    if (lesson.id === activeLesson?.id) return 'play_circle';

    switch (lesson.type) {
      case 'quiz': return 'quiz';
      case 'assessment': return 'rate_review';
      case 'pdf': return 'picture_as_pdf';
      case 'ppt': return 'slideshow';
      case 'video': return 'videocam';
      case 'text': return 'description';
      case 'flashcard': return 'flip_to_front';
      default: return 'radio_button_unchecked';
    }
  };

  const getIconColor = (lesson: any) => {
    if (lesson.completed) return 'text-green-500';
    if (lesson.id === activeLesson?.id) return 'text-primary-600';
    if (lesson.type === 'quiz' || lesson.type === 'assessment') return 'text-slate-400 group-hover:text-primary-500';
    return 'text-slate-300';
  };

  /**
   * Render highlighted text content when TTS is active
   * Injects data-tts-idx attributes to sentences and highlights active sentence/word
   */
  const renderHighlightedTextContent = (html: string, sentenceOffset: number = 0) => {
    const div = document.createElement('div');
    div.innerHTML = html;

    // Extract sentences from plain text
    const plainText = div.textContent || '';
    const sentences = plainText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);

    // Create a mapping of sentence text to HTML spans with data attributes
    let htmlWithHighlight = html;
    sentences.forEach((sentence, idx) => {
      const cleanSentence = sentence.trim();
      // For now, just add data attribute without re-rendering to avoid breaking HTML
      // The highlighting will be done via CSS ::after pseudo-element or overlay
    });

    return (
      <div
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: htmlWithHighlight }}
      />
    );
  };

  // Memoize TTS text extraction to prevent repeated calculations on every render
  const ttsText = useMemo(() => {
    if (!activeLesson?.content) return '';

    let blocks: any[] = [];
    const content = activeLesson.content;

    // Parse content into blocks
    if (Array.isArray(content)) {
      blocks = content;
    } else if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          blocks = parsed;
        } else {
          blocks = [{ id: '1', type: 'text', title: '', content: content, description: '' }];
        }
      } catch {
        blocks = [{ id: '1', type: 'text', title: '', content: content, description: '' }];
      }
    } else if (typeof content === 'object' && content !== null) {
      blocks = [content];
    }

    // Extract plain text from HTML
    const extractPlainText = (html: string): string => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || div.innerText || '';
    };

    // Find the current block (active TTS block or active block)
    const currentBlock = blocks.find(b => b.id === currentTTSBlockId || b.id === activeBlockId);

    if (currentBlock && currentBlock.type === 'text') {
      const extracted = extractPlainText(currentBlock.content || '');
      if (extracted) {
        console.log('[LessonPlayer:TTS] Extracted text length:', extracted.length);
        console.log('[LessonPlayer:TTS] First 200 chars:', extracted.substring(0, 200));
        console.log('[LessonPlayer:TTS] Last 200 chars:', extracted.substring(Math.max(0, extracted.length - 200)));
        console.log('[LessonPlayer:TTS] TTS Text ready, length:', extracted.length);
      }
      return extracted;
    }

    return '';
  }, [activeLesson?.content, activeBlockId, currentTTSBlockId]);

  const renderTextContent = (content: any) => {

    if (!content) return null;

    let blocks: any[] = [];

    if (Array.isArray(content)) {
      blocks = content;
    } else if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          blocks = parsed;
        } else {
          blocks = [{ id: '1', type: 'text', title: '', content: content, description: '' }];
        }
      } catch {
        blocks = [{ id: '1', type: 'text', title: '', content: content, description: '' }];
      }
    } else if (typeof content === 'object' && content !== null) {
      blocks = [content];
    }

    // Note: TTS text extraction now happens in useMemo above to prevent repeated calculations
    // Use the memoized ttsText directly

    return (
      <div className="w-full h-full bg-white flex flex-col relative">
        {/* TTS component reads only the currently active block */}
        {ttsEnabled && ttsText && (
          <div style={{ display: 'none' }}>
            <TextToSpeech
              ref={ttsRef}
              text={ttsText}
              voiceGender={voiceGender}
              onSentenceChange={onSentenceChange}
              onWordChange={onWordChange}
              playbackSpeed={playbackSpeed}
              volume={playerVolume}
            />
          </div>
        )}
        {ttsEnabled && !ttsText && isTTSPlaying && (
          <div style={{ display: 'none' }}>
            <TextToSpeech
              ref={ttsRef}
              text=""
              voiceGender={voiceGender}
              onSentenceChange={onSentenceChange}
              onWordChange={onWordChange}
              playbackSpeed={playbackSpeed}
              volume={playerVolume}
            />
          </div>
        )}
        <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-8">
          <div className={`${blocks.some((b: any) => b.type === 'pdf') ? 'max-w-full' : 'max-w-4xl'} mx-auto`}>
            {blocks.map((block: any, idx: number) => {
              return (
                <div
                  key={block.id || idx}
                  id={`block-${block.id || idx}`}
                  data-tts-idx={idx}
                  className={`mb-8 pb-8 border-b border-gray-200 last:border-0 scroll-mt-20 ${activeBlockId === (block.id || idx) && ttsEnabled ? 'bg-blue-50 p-4 rounded-lg' : ''}`}
                >
                  {block.type === 'text' && (
                    <>
                      {block.title && <h2 className="text-2xl font-bold mb-4 text-gray-900">{block.title}</h2>}
                      <div
                        className="prose prose-lg max-w-none"
                        dangerouslySetInnerHTML={{ __html: block.content }}
                      />
                      {block.description && <p className="text-gray-800 text-sm mt-4 italic">{block.description}</p>}
                    </>
                  )}
                  {block.type === 'video' && block.content && (
                    <>
                      {block.title && <h3 className="text-xl font-bold mb-4 text-gray-900">{block.title}</h3>}
                      <div className="w-full aspect-video rounded-lg shadow-lg mb-4 overflow-hidden bg-black">
                        {(() => {
                          const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/)?([a-zA-Z0-9_-]{11})/;
                          const match = block.content.match(youtubeRegex);
                          const videoId = match ? match[1] : null;

                          if (videoId) {
                            const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                            return (
                              <iframe
                                width="100%"
                                height="100%"
                                src={embedUrl}
                                title={block.title || "Video"}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ display: 'block' }}
                              />
                            );
                          } else {
                            const normalizedUrl = isYouTubeUrl(block.content) ? convertYouTubeUrl(block.content) : block.content;
                            return (
                              <ReactPlayer
                                ref={playerRef}
                                url={normalizedUrl}
                                controls
                                width="100%"
                                height="100%"
                                playing={isPlayerPlaying}
                                playsinline
                                progressInterval={100}
                                onReady={(player) => {
                                  playerRef.current = player;
                                }}
                                onPlaybackRateReady={(player) => {
                                  try {
                                    const internalPlayer = player.getInternalPlayer();
                                    if (internalPlayer?.setPlaybackRate) {
                                      internalPlayer.setPlaybackRate(playbackSpeed);
                                    }
                                  } catch (e) {
                                    // Fallback for browsers that don't support playback rate
                                  }
                                }}
                                config={{
                                  youtube: {
                                    playerVars: {
                                      showinfo: 1,
                                      modestbranding: 1,
                                      rel: 0
                                    }
                                  }
                                }}
                              />
                            );
                          }
                        })()}
                      </div>
                      {block.description && <p className="text-gray-800 text-sm mt-4">{block.description}</p>}
                    </>
                  )}
                  {block.type === 'pdf' && block.content && (
                    <>
                      {block.title && <h3 className="text-xl font-bold mb-4 text-gray-900">{block.title}</h3>}
                      <div className="mb-4 h-96 sm:h-[60vh] lg:h-[calc(100vh-14rem)] rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
                        <PdfViewer file={block.content} onScrollToEnd={() => setPdfScrolledToEnd(true)} />
                      </div>
                      {block.description && <p className="text-gray-800 text-sm mt-4">{block.description}</p>}
                    </>
                  )}
                  {block.type === 'quiz' && (
                    <QuizBlockRenderer
                      block={block}
                      lessonId={activeLesson?.id || ''}
                      courseId={courseId || ''}
                      onComplete={handleQuizSubmit}
                      userId={user?.id}
                      assessmentId={associatedAssessment?.id}
                    />
                  )}
                  {block.type === 'flashcard' && (
                    <FlashcardRenderer
                      flashcardSetId={block.id}
                      lessonId={activeLesson?.id || ''}
                      courseId={courseId || ''}
                      title={block.title || 'Flashcards'}
                      description={block.description}
                      userId={user?.id}
                      inlineFlashcards={block.data?.flashcards}
                    />
                  )}
                  {block.type === 'acknowledgement' && (
                    <AcknowledgementBlockRenderer
                      block={block}
                      isAcknowledged={!!acknowledgedBlocks[block.id]}
                      signature={signatureValues[block.id] || ''}
                      isLocked={isAcknowledgementLocked(idx)}
                      onAcknowledge={(checked) =>
                        setAcknowledgedBlocks(prev => ({ ...prev, [block.id]: checked }))
                      }
                      onSignature={(val) =>
                        setSignatureValues(prev => ({ ...prev, [block.id]: val }))
                      }
                      user={user}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  const renderQuizContent = () => {
    let quizQuestions: any[] = [];
    let quizTitle = activeLesson?.title || 'Quiz';
    let quizDescription = '';
    let duration = 30;
    let passingScore = 70;

    if (activeLesson?.content) {
      let contentData: any = null;

      if (Array.isArray(activeLesson.content)) {
        contentData = activeLesson.content;
      } else if (typeof activeLesson.content === 'string') {
        try {
          contentData = JSON.parse(activeLesson.content);
        } catch {
          // Content is not JSON
        }
      }

      if (Array.isArray(contentData)) {
        const quizBlock = contentData.find((block: any) => block.type === 'quiz');
        if (quizBlock) {
          quizQuestions = quizBlock.data?.questions || quizBlock.questions || [];
          quizTitle = quizBlock.title || quizTitle;
          quizDescription = quizBlock.description || '';
          duration = quizBlock.data?.duration || quizBlock.duration || 30;
          passingScore = quizBlock.data?.passingScore || quizBlock.passingScore || 70;
        }
      }
    }

    if (associatedAssessment?.questions && associatedAssessment.questions.length > 0) {
      quizQuestions = associatedAssessment.questions;
    }

    if (quizQuestions.length === 0) {
      return (
        <div className="w-full h-full bg-white flex items-center justify-center relative">
          <div className="max-w-2xl w-full p-8 text-center">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-rounded text-4xl">quiz</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{quizTitle}</h2>
            <p className="text-gray-800 mb-6">No questions configured for this quiz yet.</p>
          </div>
        </div>
      );
    }

    return (
      <InlineQuizRenderer
        lessonId={activeLesson?.id || ''}
        courseId={courseId || ''}
        questions={quizQuestions}
        title={quizTitle}
        description={quizDescription}
        duration={duration}
        passingScore={passingScore}
        onComplete={handleQuizSubmit}
        userId={user?.id}
        assessmentId={associatedAssessment?.id}
      />
    );
  };

  const scrollToBlock = (blockId: string | number) => {
    setActiveBlockId(blockId);
    const element = document.getElementById(`block-${blockId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderTableOfContents = () => {
    if (contentBlocks.length <= 1) return null;

    return (
      <div className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto z-30 lg:hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-rounded">toc</span> Contents
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {contentBlocks.map((block, idx) => {
            const blockTitle = block.title || (
              block.type === 'video' ? 'Video' :
                block.type === 'quiz' ? 'Quiz' :
                  block.type === 'pdf' ? 'PDF' :
                    block.type === 'flashcard' ? 'Flashcards' :
                      `Section ${idx + 1}`
            );

            return (
              <button
                key={block.id || idx}
                onClick={() => {
                  scrollToBlock(block.id || idx);
                  setShowTableOfContents(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${activeBlockId === (block.id || idx)
                  ? 'bg-primary-100 text-primary-900 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-base">
                    {block.type === 'quiz' ? 'quiz' : block.type === 'video' ? 'videocam' : block.type === 'pdf' ? 'picture_as_pdf' : block.type === 'flashcard' ? 'flip_to_front' : 'description'}
                  </span>
                  <span className="truncate">{blockTitle}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!activeLesson) {
      return (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Loading lesson...</p>
          </div>
        </div>
      );
    }

    switch (activeLesson.type) {
      case 'text':
        return renderTextContent(activeLesson.content);
      case 'flashcard':
        return renderTextContent(activeLesson.content);
      case 'pdf': {
        const pdfSource = typeof activeLesson.content === 'string'
          ? activeLesson.content
          : activeLesson.content?.file || pdfFile;

        return (
          <div className="w-full h-[calc(100vh-8rem)] min-h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)] lg:max-h-[calc(100vh-8rem)] bg-black flex items-center justify-center relative overflow-hidden">
            <div className="w-full h-full max-w-full min-h-0 flex items-center justify-center">
              <PdfViewer file={pdfSource} onScrollToEnd={() => setPdfScrolledToEnd(true)} />
            </div>
          </div>
        );
      }
      case 'quiz':
        return renderQuizContent();
      case 'ppt':
        return (
          <div className="w-full h-full bg-slate-100 overflow-auto">
            <div className="w-full p-4 h-full flex flex-col">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-rounded text-4xl">slideshow</span>
                  </div>
                  <p className="text-slate-800 mb-6">PPTX preview is not available in the browser. Please download the file to view it.</p>
                  <a
                    href={pptxFile}
                    download="business-risk-management.pptx"
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors"
                  >
                    <span className="material-symbols-rounded">download</span> Download PPTX
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      case 'video':
        let videoUrl = null;

        if (typeof activeLesson.content === 'string') {
          try {
            const parsedContent = JSON.parse(activeLesson.content);
            if (Array.isArray(parsedContent) && parsedContent.length > 0) {
              videoUrl = parsedContent[0].content;
            } else {
              videoUrl = activeLesson.content;
            }
          } catch (error) {
            videoUrl = activeLesson.content;
          }
        }

        if (videoUrl) {
          const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/)?([a-zA-Z0-9_-]{11})/;
          const match = videoUrl.match(youtubeRegex);
          const videoId = match ? match[1] : null;

          if (videoId) {
            const embedUrl = `https://www.youtube.com/embed/${videoId}`;
            return (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <div className="w-full h-full relative">
                  <iframe
                    width="100%"
                    height="100%"
                    src={embedUrl}
                    title="Video Player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ display: 'block' }}
                  />
                </div>
              </div>
            );
          } else {
            const normalizedUrl = isYouTubeUrl(videoUrl) ? convertYouTubeUrl(videoUrl) : videoUrl;
            return (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <div className="w-full h-full relative">
                  <ReactPlayer
                    ref={playerRef}
                    url={normalizedUrl}
                    controls
                    width="100%"
                    height="100%"
                    playing={isPlayerPlaying}
                    playsinline
                    progressInterval={100}
                    onReady={(player) => {
                      playerRef.current = player;
                    }}
                    onProgress={(state) => {
                      setPlayedDuration(state.played * (videoDuration || 1));
                    }}
                    onDuration={(duration) => {
                      setVideoDuration(duration);
                    }}
                    onPlaybackRateReady={(player) => {
                      try {
                        const internalPlayer = player.getInternalPlayer();
                        if (internalPlayer?.setPlaybackRate) {
                          internalPlayer.setPlaybackRate(playbackSpeed);
                        }
                      } catch (e) {
                        // Fallback for browsers that don't support playback rate
                      }
                    }}
                    config={{
                      youtube: {
                        playerVars: {
                          showinfo: 1,
                          modestbranding: 1,
                          rel: 0
                        }
                      }
                    }}
                  />
                </div>
              </div>
            );
          }
        }

        return renderTextContent(activeLesson.content);
      default:
        return renderTextContent(activeLesson.content);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading course content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-900">
        <div className="text-center text-white">
          <p className="mb-4">{error}</p>
          {courseId ? (
            <button
              onClick={() => navigate(`/course/${courseId}`)}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-700"
            >
              <span className="material-symbols-rounded">arrow_back</span> Back to Course
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700"
            >
              <span className="material-symbols-rounded">home</span> Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{customScrollbarStyles}</style>
      <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
        {/* ========== TOP HEADER BAR ========== */}
        <header className="h-16 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between px-4 shrink-0 border-b border-slate-700 z-40 shadow-md">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => courseId && navigate(`/course/${courseId}`)}
              disabled={!courseId}
              className="p-2 -ml-2 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Back to course"
            >
              <span className="material-symbols-rounded">arrow_back</span>
            </button>
            <div className="h-5 w-px bg-slate-600 shrink-0 hidden sm:block"></div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold truncate">{activeLesson?.title || 'Lesson'}</h1>
              <span className="text-xs text-slate-400 hidden sm:block">
                {activeLesson?.duration ? `${activeLesson.duration} read` : 'Duration N/A'}
              </span>
            </div>
          </div>

          {/* Center: Progress Indicator */}
          <div className="hidden md:flex items-center gap-3 px-4">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${courseProgressPercentage}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium text-slate-300 whitespace-nowrap">{courseProgressPercentage}%</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Desktop: Mark Complete Button - Show for all lesson types, including quiz */}
            {!courseCompleted && !lessonCompleted && (
              <button
                onClick={async () => {
                  try {
                    const ackBlocks = contentBlocks.filter(b => b.type === 'acknowledgement');
                    console.log(`Saving ${ackBlocks.length} acknowledgement block(s)...`);

                    for (const b of ackBlocks) {
                      if (acknowledgedBlocks[b.id] && signatureValues[b.id]?.trim() && user?.id && courseId && activeLesson?.id) {
                        const ackData = {
                          user_id: user.id,
                          course_id: courseId,
                          lesson_id: activeLesson.id,
                          block_id: b.id,
                          policy_title: b.title || b.data?.policyTitle || 'Policy',
                          signature: signatureValues[b.id].trim(),
                          acknowledged_at: new Date().toISOString(),
                        };

                        console.log(`Saving acknowledgement for block: ${b.id}`, ackData);

                        const { data, error } = await supabase.from('course_acknowledgements').upsert(ackData, {
                          onConflict: 'user_id,lesson_id,block_id'
                        });

                        if (error) {
                          console.error(`Error saving acknowledgement for block ${b.id}:`, error);
                          alert(`Failed to save acknowledgement: ${error.message}`);
                          return;
                        }

                        console.log(`Acknowledgement saved successfully for block ${b.id}:`, data);
                      }
                    }

                    await updateLessonProgress(100, true);
                  } catch (err) {
                    console.error('Error during Mark Complete operation:', err);
                    alert('An error occurred while completing the lesson. Please try again.');
                  }
                }}
                disabled={
                  (activeLesson?.type === 'pdf' && !pdfScrolledToEnd) ||
                  (activeLesson?.type === 'quiz' && !quizPassed) ||
                  contentBlocks.some(b => b.type === 'acknowledgement' && (!acknowledgedBlocks[b.id] || !signatureValues[b.id]?.trim()))
                }
                className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${((activeLesson?.type === 'pdf' && !pdfScrolledToEnd) ||
                  (activeLesson?.type === 'quiz' && !quizPassed) ||
                  contentBlocks.some(b => b.type === 'acknowledgement' && (!acknowledgedBlocks[b.id] || !signatureValues[b.id]?.trim())))
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                  : activeLesson?.type === 'quiz' && quizPassed
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-emerald-600/50 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-emerald-600/50'
                  }`}
                title={activeLesson?.type === 'quiz' ? (quizPassed ? 'Click to complete the lesson' : 'Complete quiz to mark lesson as complete') : 'Mark this lesson as complete'}
              >
                <span className="material-symbols-rounded text-sm">check_circle</span>
                <span className="hidden md:inline">Mark Complete</span>
              </button>
            )}
            {(courseCompleted || lessonCompleted) && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold bg-emerald-600/20 px-3 py-2 rounded-lg text-emerald-400 border border-emerald-600/30">
                <span className="material-symbols-rounded text-sm">verified</span>
                <span className="hidden md:inline">Completed</span>
              </div>
            )}

            {/* Mobile: Checkmark Button (Mark Complete) - Show for all lesson types including quiz */}
            {!courseCompleted && !lessonCompleted && (
              <button
                onClick={async () => {
                  try {
                    const ackBlocks = contentBlocks.filter(b => b.type === 'acknowledgement');
                    console.log(`Saving ${ackBlocks.length} acknowledgement block(s)...`);

                    for (const b of ackBlocks) {
                      if (acknowledgedBlocks[b.id] && signatureValues[b.id]?.trim() && user?.id && courseId && activeLesson?.id) {
                        const ackData = {
                          user_id: user.id,
                          course_id: courseId,
                          lesson_id: activeLesson.id,
                          block_id: b.id,
                          policy_title: b.title || b.data?.policyTitle || 'Policy',
                          signature: signatureValues[b.id].trim(),
                          acknowledged_at: new Date().toISOString(),
                        };

                        console.log(`Saving acknowledgement for block: ${b.id}`, ackData);

                        const { data, error } = await supabase.from('course_acknowledgements').upsert(ackData, {
                          onConflict: 'user_id,lesson_id,block_id'
                        });

                        if (error) {
                          console.error(`Error saving acknowledgement for block ${b.id}:`, error);
                          alert(`Failed to save acknowledgement: ${error.message}`);
                          return;
                        }

                        console.log(`Acknowledgement saved successfully for block ${b.id}:`, data);
                      }
                    }

                    await updateLessonProgress(100, true);
                  } catch (err) {
                    console.error('Error during Mark Complete operation:', err);
                    alert('An error occurred while completing the lesson. Please try again.');
                  }
                }}
                disabled={
                  (activeLesson?.type === 'pdf' && !pdfScrolledToEnd) ||
                  (activeLesson?.type === 'quiz' && !quizPassed) ||
                  contentBlocks.some(b => b.type === 'acknowledgement' && (!acknowledgedBlocks[b.id] || !signatureValues[b.id]?.trim()))
                }
                className={`sm:hidden p-2 rounded-lg transition-all duration-300 border-2 ${((activeLesson?.type === 'pdf' && !pdfScrolledToEnd) ||
                  (activeLesson?.type === 'quiz' && !quizPassed) ||
                  contentBlocks.some(b => b.type === 'acknowledgement' && (!acknowledgedBlocks[b.id] || !signatureValues[b.id]?.trim())))
                  ? 'border-slate-400 text-slate-400 cursor-not-allowed opacity-50 bg-slate-900/20'
                  : activeLesson?.type === 'quiz' && quizPassed
                    ? 'border-emerald-400 text-emerald-400 hover:bg-emerald-600/20 hover:border-emerald-300 hover:text-emerald-300 animate-pulse'
                    : 'border-emerald-400 text-emerald-400 hover:bg-emerald-600/20 hover:border-emerald-300 hover:text-emerald-300'
                  }`}
                title={activeLesson?.type === 'quiz' ? (quizPassed ? 'Click to complete the lesson' : 'Complete quiz to mark lesson as complete') : 'Mark this lesson as complete'}
              >
                <span className="material-symbols-rounded text-xl">check_circle</span>
              </button>
            )}
            {(courseCompleted || lessonCompleted) && (
              <div className="sm:hidden p-2 rounded-lg text-emerald-400 border-2 border-emerald-400 bg-emerald-600/20">
                <span className="material-symbols-rounded text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>
            )}

            {/* Retake Quiz Button: Removed from header - users can retake from quiz results area */}

            {/* Mobile: Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 md:hidden rounded-lg transition-all ${sidebarOpen ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
              aria-label="Toggle menu"
              title="Toggle content menu"
            >
              <span className="material-symbols-rounded">{sidebarOpen ? 'menu_open' : 'menu'}</span>
            </button>

            {/* Desktop: Sidebar Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`hidden md:flex p-2 rounded-lg transition-all ${sidebarOpen ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
              aria-label="Toggle sidebar"
              title="Toggle lesson playlist"
            >
              <span className="material-symbols-rounded">{sidebarOpen ? 'menu_open' : 'menu'}</span>
            </button>
          </div>
        </header>

        {/* ========== MAIN CONTENT AREA ========== */}
        < div className="flex-1 flex overflow-hidden" >
          {/* Main Content */}
          < main className="flex-1 flex flex-col overflow-hidden bg-white" >
            {/* Content Display - Video/PDF/Text Priority */}
            < div className="flex-1 overflow-y-auto bg-black flex flex-col" >
              {/* Media Container - Video/PDF at top */}
              {
                activeLesson && (activeLesson.type === 'video' || contentBlocks.some(b => b.type === 'video')) ? (
                  <div className="w-full aspect-video bg-black flex items-center justify-center shrink-0 relative">
                    {renderContent()}
                  </div>
                ) : null
              }

              {/* Text/Content Container */}
              <div className={`flex-1 min-h-0 overflow-y-auto ${activeLesson?.type === 'pdf' ? 'bg-black' : 'bg-white'}`}>
                <div className={`${activeLesson?.type === 'pdf' ? 'w-full max-w-full px-4 py-6 lg:px-6 lg:py-8' : 'max-w-4xl mx-auto px-6 py-8'}`}>
                  {/* Only render non-video content here */}
                  {!contentBlocks.some(b => b.type === 'video') && renderContent()}
                </div>
              </div>
            </div >

            {/* Progress Tracker Line */}
            {
              activeLesson?.type === 'video' && videoDuration > 0 && (
                <div className="h-px bg-slate-200 shrink-0">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-100"
                    style={{ width: `${(playedDuration / videoDuration) * 100}%` }}
                  />
                </div>
              )
            }

            {/* Bottom Player Controls - Mobile Only */}
            <div className="md:hidden bg-white border-t border-slate-200 shrink-0 px-3 py-2 no-scrollbar relative">
              <div className="flex items-center justify-center gap-2">
                {/* TTS Toggle Button */}
                {activeLesson?.type !== 'video' && (
                  <button
                    onClick={() => {
                      if (ttsEnabled) {
                        setIsTTSPlaying(false);
                        setCurrentTTSBlockId(null);
                        ttsRef.current?.togglePlayPause(); // Stop if playing
                      }
                      setTtsEnabled(!ttsEnabled);
                    }}
                    className={`p-2 rounded-lg transition-colors active:scale-95 flex-shrink-0 ${ttsEnabled
                      ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    title={ttsEnabled ? "Disable Text-to-Speech" : "Enable Text-to-Speech"}
                  >
                    <span className="material-symbols-rounded text-xl">{ttsEnabled ? 'headphones' : 'headphones'}</span>
                  </button>
                )}

                {/* Rewind Button */}
                <button
                  onClick={() => playerRef.current?.seekTo((playerRef.current?.getCurrentTime?.() || 0) - 10)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors active:bg-slate-200 flex-shrink-0"
                  title="Rewind 10s"
                >
                  <span className="material-symbols-rounded text-xl">replay_10</span>
                </button>

                {/* Play/Pause Button - Square/Rounded */}
                <button
                  onClick={() => {
                    if (activeLesson?.type === 'video') {
                      setIsPlayerPlaying(!isPlayerPlaying);
                    } else if (ttsEnabled) {
                      // When starting TTS, set the current block to be read
                      if (!isTTSPlaying) {
                        setCurrentTTSBlockId(activeBlockId);
                      }
                      ttsRef.current?.togglePlayPause();
                      setIsTTSPlaying(!isTTSPlaying);
                    }
                  }}
                  disabled={activeLesson?.type !== 'video' && !ttsEnabled}
                  className={`px-3.5 py-2.5 rounded-xl transition-all active:scale-95 shadow-md flex-shrink-0 ${activeLesson?.type !== 'video' && !ttsEnabled
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700'
                    }`}
                  title={activeLesson?.type === 'video' ? (isPlayerPlaying ? 'Pause' : 'Play') : (isTTSPlaying ? 'Pause' : 'Play')}
                >
                  <span className="material-symbols-rounded text-xl">{activeLesson?.type === 'video' ? (isPlayerPlaying ? 'pause' : 'play_arrow') : (isTTSPlaying ? 'pause' : 'play_arrow')}</span>
                </button>

                {/* Forward Button */}
                <button
                  onClick={() => playerRef.current?.seekTo((playerRef.current?.getCurrentTime?.() || 0) + 10)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors active:bg-slate-200 flex-shrink-0"
                  title="Forward 10s"
                >
                  <span className="material-symbols-rounded text-xl">forward_10</span>
                </button>

                {/* Divider */}
                <div className="h-6 w-px bg-slate-300 mx-1 flex-shrink-0"></div>

                {/* Voice Gender Toggle */}
                {(activeLesson?.type === 'video' || ttsEnabled) && (
                  <button
                    onClick={() => setVoiceGender(voiceGender === 'male' ? 'female' : 'male')}
                    className={`p-2 rounded-lg transition-colors active:scale-95 flex-shrink-0 ${voiceGender === 'male'
                      ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                      : 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                      }`}
                    title={`Voice: ${voiceGender} (Tap to change)`}
                  >
                    <span className="material-symbols-rounded text-xl">{voiceGender === 'male' ? 'male' : 'female'}</span>
                  </button>
                )}
              </div>
            </div>
          </main >

          {/* ========== SIDEBAR: Course Playlist & Progress ========== */}
          < aside
            className={`
            fixed md:relative inset-y-0 right-0 bg-white border-l border-slate-200
            flex flex-col transition-all duration-300 ease-in-out z-30 md:z-0
            ${sidebarOpen ? 'w-full sm:w-80 translate-x-0' : 'w-full sm:w-80 translate-x-full md:translate-x-0 md:!w-0 md:border-l-0 md:overflow-hidden md:!translate-x-0'}
          `}
          >
            {/* Sidebar Header */}
            < div className="p-4 md:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50 flex items-center justify-between shrink-0" >
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900 text-base">Course Content</h3>
                <p className="text-xs text-slate-500 mt-1">{completedLessonsCount} of {totalLessonsCount} lessons</p>
              </div>
            </div >

            {/* Progress Bar with Percentage */}
            < div className="px-4 md:px-5 py-3 border-b border-slate-200 bg-white" >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Progress</span>
                <span className="text-sm font-bold text-emerald-600">{totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${totalLessonsCount > 0 ? (completedLessonsCount / totalLessonsCount) * 100 : 0}%` }}
                ></div>
              </div>
            </div >

            {/* Lessons List */}
            < div className="flex-1 overflow-y-auto custom-scrollbar" >
              {
                modules.length > 0 ? (
                  modules.map((module, idx) => (
                    <div key={idx} className="border-b border-slate-100 last:border-0">
                      {/* Module Divider */}
                      <div className="px-4 md:px-5 py-2.5 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{module.title}</p>
                      </div>

                      {/* Lessons */}
                      {module.lessons.map((lesson) => (
                        <button
                          key={lesson.id}
                          onClick={() => {
                            handleLessonClick(lesson).catch(err => console.error('Error in handleLessonClick:', err));
                          }}
                          className={`w-full text-left px-4 md:px-5 py-3 flex items-start gap-3 transition-all border-l-4 ${lesson.id === activeLesson?.id
                            ? 'bg-emerald-50 border-l-emerald-600 shadow-sm'
                            : 'hover:bg-slate-50 border-l-transparent'
                            }`}
                        >
                          {/* Icon */}
                          <div className={`mt-0.5 ${getIconColor(lesson)}`}>
                            <span className="material-symbols-rounded text-lg">{getLessonIcon(lesson)}</span>
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm truncate ${lesson.id === activeLesson?.id ? 'font-bold text-emerald-900' : 'text-slate-700'
                              }`}>
                              {lesson.title}
                            </p>
                            <span className="text-xs text-slate-400 mt-0.5 block">{lesson.duration}</span>
                          </div>

                          {/* Completion Badge */}
                          {lesson.completed && (
                            <span className="text-emerald-600 shrink-0 mt-0.5">
                              <span className="material-symbols-rounded text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-500">
                    <span className="material-symbols-rounded text-3xl block mb-2 opacity-50">folder_open</span>
                    <p className="text-sm">No lessons available</p>
                  </div>
                )
              }
            </div >
          </aside >

          {/* Mobile Backdrop */}
          {
            sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/40 z-20 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )
          }
        </div >

        {/* ========== BOTTOM PLAYER CONTROLS - Desktop Only ========== */}
        < footer className="hidden md:flex h-14 bg-white border-t border-slate-200 shrink-0 px-6 items-center gap-4 z-10" >
          {/* TTS Toggle Button */}
          {activeLesson?.type !== 'video' && (
            <button
              onClick={() => {
                if (ttsEnabled) {
                  setIsTTSPlaying(false);
                  ttsRef.current?.togglePlayPause(); // Stop if playing
                }
                setTtsEnabled(!ttsEnabled);
              }}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${ttsEnabled
                ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              title={ttsEnabled ? "Disable Text-to-Speech" : "Enable Text-to-Speech"}
            >
              <span className="material-symbols-rounded text-base">{ttsEnabled ? 'headphones' : 'headphones'}</span>
              <span className="text-sm font-medium hidden sm:inline">{ttsEnabled ? 'TTS On' : 'TTS Off'}</span>
            </button>
          )}

          <button
            onClick={() => playerRef.current?.seekTo((playerRef.current?.getCurrentTime?.() || 0) - 10)}
            className="p-2 rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 transition-colors flex items-center gap-2"
            title="Rewind 10s"
          >
            <span className="material-symbols-rounded text-base">replay_10</span>
            <span className="text-sm font-medium hidden sm:inline">Rewind</span>
          </button>
          <button
            onClick={() => {
              if (activeLesson?.type === 'video') {
                setIsPlayerPlaying(!isPlayerPlaying);
              } else if (ttsEnabled) {
                // When starting TTS, set the current block to be read
                if (!isTTSPlaying) {
                  setCurrentTTSBlockId(activeBlockId);
                }
                ttsRef.current?.togglePlayPause();
                setIsTTSPlaying(!isTTSPlaying);
              }
            }}
            disabled={activeLesson?.type !== 'video' && !ttsEnabled}
            className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${activeLesson?.type !== 'video' && !ttsEnabled
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            title={activeLesson?.type === 'video' ? (isPlayerPlaying ? 'Pause' : 'Play') : (isTTSPlaying ? 'Pause' : 'Play')}
          >
            <span className="material-symbols-rounded text-base">{activeLesson?.type === 'video' ? (isPlayerPlaying ? 'pause' : 'play_arrow') : (isTTSPlaying ? 'pause' : 'play_arrow')}</span>
          </button>
          <button
            onClick={() => playerRef.current?.seekTo((playerRef.current?.getCurrentTime?.() || 0) + 10)}
            className="p-2 rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 transition-colors flex items-center gap-2"
            title="Forward 10s"
          >
            <span className="material-symbols-rounded text-base">forward_10</span>
            <span className="text-sm font-medium hidden sm:inline">Forward</span>
          </button>
          {/* Voice Selection - Toggle Button */}
          {(activeLesson?.type === 'video' || ttsEnabled) && (
            <button
              onClick={() => setVoiceGender(voiceGender === 'male' ? 'female' : 'male')}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${voiceGender === 'male'
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                }`}
              title={`Voice: ${voiceGender} (Click to change)`}
            >
              <span className="material-symbols-rounded text-base">{voiceGender === 'male' ? 'male' : 'female'}</span>
              <span className="text-sm font-medium hidden sm:inline">{voiceGender === 'male' ? 'Male' : 'Female'}</span>
            </button>
          )}
        </footer >
      </div >
    </>
  );
};

interface QuizBlockRendererProps {
  block: any;
  lessonId: string;
  courseId: string;
  onComplete: (result: any) => void;
  userId?: string;
  assessmentId?: string;
}

const QuizBlockRenderer: React.FC<QuizBlockRendererProps> = ({
  block,
  lessonId,
  courseId,
  onComplete,
  userId,
  assessmentId,
}) => {
  const quizQuestions = block.data?.questions || block.questions || [];
  const quizTitle = block.title || 'Quiz';
  const quizDescription = block.description || '';
  const duration = block.data?.duration || block.duration || 30;
  const passingScore = block.data?.passingScore || block.passingScore || 70;

  if (quizQuestions.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-rounded text-3xl">quiz</span>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{quizTitle}</h3>
        <p className="text-gray-800">No questions configured for this quiz yet.</p>
      </div>
    );
  }

  return (
    <>
      {block.title && <h3 className="text-xl font-bold mb-4 text-gray-900">{block.title}</h3>}
      {block.description && <p className="text-gray-800 text-sm mb-6">{block.description}</p>}
      <InlineQuizRenderer
        lessonId={lessonId}
        courseId={courseId}
        questions={quizQuestions}
        title={quizTitle}
        description={quizDescription}
        duration={duration}
        passingScore={passingScore}
        onComplete={onComplete}
        userId={userId}
        assessmentId={assessmentId}
      />
    </>
  );
};

export default LessonPlayerPage;

const AcknowledgementBlockRenderer: React.FC<{
  block: any;
  isAcknowledged: boolean;
  signature: string;
  isLocked?: boolean;
  onAcknowledge: (checked: boolean) => void;
  onSignature: (val: string) => void;
  user?: any;
}> = ({ block, isAcknowledged, signature, isLocked = false, onAcknowledge, onSignature, user }) => {
  const data = block.data || {};
  const checkboxLabel = data.checkboxLabel || 'I acknowledge that I have read and understood the above policy.';
  const signatureLabel = data.signatureLabel || 'Type your full name as your digital signature';
  const policyTitle = data.policyTitle || block.title || 'Policy Document';
  const isComplete = isAcknowledged && signature.trim().length > 0;

  if (isLocked) {
    return (
      <div className="space-y-6">
        {/* Policy Header - Locked */}
        <div className="flex items-center gap-3 p-4 bg-gray-100 border border-gray-300 rounded-xl opacity-60">
          <span className="material-symbols-rounded text-gray-500 text-2xl">policy</span>
          <div>
            <h3 className="font-bold text-gray-600 text-lg">{policyTitle}</h3>
            <p className="text-xs text-gray-500">Please read the entire document before signing.</p>
          </div>
        </div>

        {/* Lock Overlay */}
        <div className="relative">
          <div className="prose prose-sm max-w-none bg-gray-50 border border-gray-300 rounded-xl p-6 max-h-80 overflow-y-auto text-gray-500 shadow-inner opacity-50 blur-sm blur-sm" />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 hover:bg-black/20 transition-colors">
            <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-sm">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
                  <span className="material-symbols-rounded text-4xl text-yellow-600">lock</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Content Locked</h3>
              <p className="text-sm text-gray-600 mb-4">
                You must complete all previous lessons and quizzes before accessing this acknowledgement section.
              </p>
              <div className="text-xs text-gray-500 font-medium">
                <p>Progress: Complete pending lessons in order</p>
              </div>
            </div>
          </div>
        </div>

        {/* Locked Acknowledgement Section */}
        <div className="bg-gray-100 border border-gray-300 rounded-xl p-6 space-y-5 opacity-60">
          <h4 className="font-semibold text-gray-500 text-sm uppercase tracking-wide flex items-center gap-2">
            <span className="material-symbols-rounded text-gray-400 text-base">draw</span>
            Your Acknowledgement
          </h4>

          {/* Disabled Checkbox */}
          <label className="flex items-start gap-3 cursor-not-allowed p-4 rounded-lg border-2 border-gray-300 bg-gray-50">
            <input
              type="checkbox"
              disabled
              className="mt-0.5 w-5 h-5 accent-gray-400 flex-shrink-0 cursor-not-allowed"
            />
            <span className="text-sm text-gray-500 leading-relaxed">{checkboxLabel}</span>
          </label>

          {/* Disabled Signature */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              {signatureLabel}
              <span className="text-red-400 ml-1">*</span>
            </label>
            <input
              type="text"
              disabled
              placeholder="Type your full name..."
              className="w-full px-4 py-3 border-b-2 border-gray-300 bg-gray-50 text-gray-400 font-medium text-lg outline-none cursor-not-allowed placeholder:text-gray-400 italic"
              style={{ fontFamily: 'cursive, Georgia, serif' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Unlocked version
  return (
    <div className="space-y-6">
      {/* Policy Header */}
      <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
        <span className="material-symbols-rounded text-orange-600 text-2xl">policy</span>
        <div>
          <h3 className="font-bold text-orange-900 text-lg">{policyTitle}</h3>
          <p className="text-xs text-orange-600">Please read the entire document before signing.</p>
        </div>
        {isComplete && (
          <div className="ml-auto flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
            <span className="material-symbols-rounded text-sm">verified</span>
            Acknowledged
          </div>
        )}
      </div>

      {/* Policy Content */}
      {block.content && (
        <div
          className="prose prose-sm max-w-none bg-white border border-gray-200 rounded-xl p-6 max-h-80 overflow-y-auto text-gray-800 shadow-inner"
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      )}

      {/* Acknowledgement Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-5">
        <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
          <span className="material-symbols-rounded text-orange-500 text-base">draw</span>
          Your Acknowledgement
        </h4>

        {/* Checkbox */}
        <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors ${isAcknowledged ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white hover:border-orange-400'
          }`}>
          <input
            type="checkbox"
            checked={isAcknowledged}
            onChange={e => onAcknowledge(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-orange-500 flex-shrink-0 cursor-pointer"
          />
          <span className="text-sm text-gray-700 leading-relaxed">{checkboxLabel}</span>
          {isAcknowledged && <span className="ml-auto material-symbols-rounded text-green-500 flex-shrink-0">check_circle</span>}
        </label>

        {/* Signature */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {signatureLabel}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={signature}
            onChange={e => onSignature(e.target.value)}
            placeholder="Type your full name..."
            className={`w-full px-4 py-3 border-b-2 bg-transparent text-gray-900 font-medium text-lg outline-none transition-colors placeholder:text-gray-300 italic ${signature.trim() ? 'border-green-500' : 'border-gray-400 focus:border-orange-500'
              }`}
            style={{ fontFamily: 'cursive, Georgia, serif' }}
          />
          {signature.trim() && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <span className="material-symbols-rounded text-sm">check</span>
              Signature captured
            </p>
          )}
        </div>

        {/* Print/Download Actions - Show only when complete and user is admin */}
        {isComplete && user?.role === 'admin' && (
          <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                try {
                  printAcknowledgement({
                    policyTitle,
                    policyContent: block.content || '',
                    userFullName: signature,
                    signature,
                    acknowledgedAt: new Date().toISOString(),
                  });
                } catch (error) {
                  console.error('Error printing document:', error);
                  alert('Error printing document. Please try again.');
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
            >
              <span className="material-symbols-rounded text-base">print</span>
              Print Acknowledgement
            </button>
            <button
              onClick={() => {
                try {
                  downloadAcknowledgementPDF({
                    policyTitle,
                    policyContent: block.content || '',
                    userFullName: signature,
                    signature,
                    acknowledgedAt: new Date().toISOString(),
                  }, `${policyTitle}-acknowledgement.pdf`);
                } catch (error) {
                  console.error('Error preparing PDF:', error);
                  alert('Error preparing PDF. Please use your browser\'s Print to PDF feature.');
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium"
            >
              <span className="material-symbols-rounded text-base">download</span>
              Download as PDF
            </button>
          </div>
        )}

        {/* Status */}
        {!isComplete && (
          <p className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="material-symbols-rounded text-sm">info</span>
            {!isAcknowledged && !signature.trim()
              ? 'Check the acknowledgement box and sign to complete this lesson.'
              : !isAcknowledged
                ? 'Check the acknowledgement box to continue.'
                : 'Add your signature to complete this lesson.'}
          </p>
        )}
      </div>
    </div>
  );
};