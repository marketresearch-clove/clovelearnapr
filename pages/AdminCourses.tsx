import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import CourseBuilder from '../components/CourseBuilder';
import FlashcardColorSettingsModal from '../components/FlashcardColorSettingsModal';
import CourseAssignments from '../src/pages/admin/components/CourseAssignments';
import ManageCourseAssignments from './ManageCourseAssignments';
import { courseService, Course } from '../lib/courseService';
import { durationService } from '../lib/durationService';
import { lessonService, Lesson } from '../lib/lessonService';
import { feedbackService } from '../lib/feedbackService';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../lib/userService';
import useAuthGuard from '../hooks/useAuthGuard';
import { supabase } from '../lib/supabaseClient';
import { quizService } from '../lib/quizService';

const AdminCourses: React.FC = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  useAuthGuard(['admin', 'instructor']);
  const [showBuilder, setShowBuilder] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [selectedCourseForColors, setSelectedCourseForColors] = useState<Course | null>(null);
  const [selectedCourseForFeedback, setSelectedCourseForFeedback] = useState<Course | null>(null);
  const [courseFeedbacks, setCourseFeedbacks] = useState<any[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<any>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // New filters and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [sortBy, setSortBy] = useState<'title' | 'students' | 'rating' | 'recent' | 'completion'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    course: true,
    instructor: true,
    category: true,
    students: true,
    completion: true,
    status: true,
    duration: true,
    rating: true,
    actions: true,
  });
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [showBatchStatusModal, setShowBatchStatusModal] = useState(false);
  const [batchStatusValue, setBatchStatusValue] = useState<'draft' | 'published'>('published');
  const [showBatchPublicViewModal, setShowBatchPublicViewModal] = useState(false);
  const [batchPublicViewValue, setBatchPublicViewValue] = useState<boolean>(true);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'courses' | 'assignments' | 'add-assignment'>('courses');

  useEffect(() => {
    // Load saved column preferences from localStorage
    const savedColumns = localStorage.getItem('courseTableColumns');
    if (savedColumns) {
      try {
        setVisibleColumns(JSON.parse(savedColumns));
      } catch (e) {
        console.error('Error loading saved columns:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchCourses();
    }
  }, [session]);

  const fetchCourses = async () => {
    try {
      setCoursesLoading(true);
      setError('');
      console.log('Fetching courses...');
      const data = await courseService.getCourses();
      console.log(`Successfully loaded ${data.length} courses`);
      setCourses(data);
    } catch (err) {
      const errorMsg = 'Failed to load courses';
      setError(errorMsg);
      console.error(errorMsg, err);
    } finally {
      setCoursesLoading(false);
    }
  };

  const loadCourseFeedback = async (courseId: string) => {
    try {
      setFeedbackLoading(true);
      const [feedbacks, stats] = await Promise.all([
        feedbackService.getCourseFeedback(courseId),
        feedbackService.getCourseFeedbackStats(courseId),
      ]);
      setCourseFeedbacks(feedbacks || []);
      setFeedbackStats(stats);
    } catch (err) {
      console.error('Error loading feedback:', err);
      setCourseFeedbacks([]);
      setFeedbackStats(null);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleViewFeedback = async (course: Course) => {
    setSelectedCourseForFeedback(course);
    await loadCourseFeedback(course.id!);
  };

  // Filter and sort logic
  const filteredCourses = courses.filter(course => {
    // Search filter
    const matchesSearch = !searchQuery ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.instructorname.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory = !filterCategory || course.category === filterCategory;

    // Status filter
    const matchesStatus = !filterStatus || course.status === filterStatus;

    // Level filter
    const matchesLevel = !filterLevel || course.level === filterLevel;

    return matchesSearch && matchesCategory && matchesStatus && matchesLevel;
  }).sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'title':
        compareValue = a.title.localeCompare(b.title);
        break;
      case 'students':
        compareValue = (a.totalstudents || 0) - (b.totalstudents || 0);
        break;
      case 'completion':
        compareValue = (a.completionrate || 0) - (b.completionrate || 0);
        break;
      case 'rating':
        compareValue = (a.averagerating || 0) - (b.averagerating || 0);
        break;
      case 'recent':
        compareValue = new Date(b.createdat || 0).getTime() - new Date(a.createdat || 0).getTime();
        break;
      default:
        compareValue = 0;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Pagination
  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const categories = Array.from(new Set(courses.map(c => c.category)));
  const levels = Array.from(new Set(courses.map(c => c.level)));

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterStatus('');
    setFilterLevel('');
    setSortBy('title');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  const toggleColumnVisibility = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
    // Save to localStorage
    const updated = { ...visibleColumns, [column]: !visibleColumns[column] };
    localStorage.setItem('courseTableColumns', JSON.stringify(updated));
  };

  const selectAllColumns = () => {
    const allVisible = Object.keys(visibleColumns).reduce((acc, key) => {
      acc[key as keyof typeof visibleColumns] = true;
      return acc;
    }, {} as typeof visibleColumns);
    setVisibleColumns(allVisible);
    localStorage.setItem('courseTableColumns', JSON.stringify(allVisible));
  };

  const deselectAllColumns = () => {
    const noneVisible = Object.keys(visibleColumns).reduce((acc, key) => {
      acc[key as keyof typeof visibleColumns] = false;
      return acc;
    }, {} as typeof visibleColumns);
    setVisibleColumns(noneVisible);
    localStorage.setItem('courseTableColumns', JSON.stringify(noneVisible));
  };

  const areAllColumnsVisible = Object.values(visibleColumns).every(val => val === true);
  const areNoColumnsVisible = Object.values(visibleColumns).every(val => val === false);

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const selectAllOnPage = () => {
    setSelectedCourses(new Set(paginatedCourses.map(course => course.id!)));
  };

  const deselectAllCoursesList = () => {
    setSelectedCourses(new Set());
  };

  const handleBatchStatusChange = async () => {
    if (selectedCourses.size === 0) return;

    setIsBatchUpdating(true);
    try {
      const coursesToUpdate = filteredCourses.filter(course => selectedCourses.has(course.id!));
      let successCount = 0;
      let errorCount = 0;

      for (const course of coursesToUpdate) {
        try {
          await courseService.updateCourse(course.id!, { status: batchStatusValue });
          successCount++;
        } catch (error) {
          console.error(`Error updating course ${course.id}:`, error);
          errorCount++;
        }
      }

      await fetchCourses();
      setSelectedCourses(new Set());
      setShowBatchStatusModal(false);

      if (successCount > 0) {
        alert(`✓ Successfully updated ${successCount} course(s) to ${batchStatusValue}${errorCount > 0 ? `. ${errorCount} failed.` : ''}`);
      }
    } catch (error) {
      console.error('Error during batch status update:', error);
      alert('Error updating courses. Please try again.');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const handleBatchPublicViewChange = async () => {
    if (selectedCourses.size === 0) return;

    setIsBatchUpdating(true);
    try {
      const coursesToUpdate = filteredCourses.filter(course => selectedCourses.has(course.id!));
      let successCount = 0;
      let errorCount = 0;

      for (const course of coursesToUpdate) {
        try {
          await courseService.updateCourse(course.id!, { is_hidden: !batchPublicViewValue });
          successCount++;
        } catch (error) {
          console.error(`Error updating course ${course.id}:`, error);
          errorCount++;
        }
      }

      await fetchCourses();
      setSelectedCourses(new Set());
      setShowBatchPublicViewModal(false);

      const action = batchPublicViewValue ? 'made public' : 'made private';
      if (successCount > 0) {
        alert(`✓ Successfully ${action} ${successCount} course(s)${errorCount > 0 ? `. ${errorCount} failed.` : ''}`);
      }
    } catch (error) {
      console.error('Error during batch public view update:', error);
      alert('Error updating courses. Please try again.');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const deleteAssessmentsForLessons = async (lessonIds: string[]) => {
    try {
      for (const lessonId of lessonIds) {
        await quizService.deleteQuizzesByLesson(lessonId);
      }

      const { error } = await supabase
        .from('assessments')
        .delete()
        .in('lessonid', lessonIds);

      if (error) {
        console.error('Error deleting assessments:', error);
      } else {
        console.log(`Deleted assessments and quizzes for ${lessonIds.length} lessons`);
      }
    } catch (err) {
      console.error('Error in deleteAssessmentsForLessons:', err);
    }
  };

  const createAssessmentForQuiz = async (lesson: any, courseId: string) => {
    try {
      let quizDataArray: any[] = [];
      const lessonId = lesson.id;

      if (typeof lesson.content === 'string') {
        try {
          const parsed = JSON.parse(lesson.content);
          if (Array.isArray(parsed)) {
            quizDataArray = parsed.filter((block: any) => block.type === 'quiz');
          } else if (parsed.type === 'quiz') {
            quizDataArray = [parsed];
          }
        } catch (e) {
          console.error('Error parsing quiz content:', e);
        }
      } else if (Array.isArray(lesson.content)) {
        quizDataArray = lesson.content.filter((block: any) => block.type === 'quiz');
      }

      if (quizDataArray.length === 0) {
        console.warn(`No quiz blocks found in lesson ${lessonId}`);
        return;
      }

      for (const quizData of quizDataArray) {
        const quizTitle = quizData.title || `Quiz in ${lesson.title}`;
        const quizDescription = quizData.description || quizData.content;
        const quizDuration = quizData.data?.duration || 30;
        const passingScore = quizData.data?.passingScore || 70;
        const questions = quizData.data?.questions || [];
        const totalPoints = quizData.data?.totalPoints || 100;

        const assessment = {
          courseid: courseId,
          lessonid: lessonId,
          title: quizTitle,
          description: quizDescription,
          type: 'quiz',
          duration: quizDuration,
          passingscore: passingScore,
          questions: questions,
          totalquestions: questions.length,
        };

        const { data, error } = await supabase
          .from('assessments')
          .insert([assessment])
          .select();

        if (error) {
          console.error('Error creating assessment:', error);
          throw error;
        }

        console.log(`Assessment created for quiz in lesson ${lessonId}:`, data);

        try {
          const quizRecord = await quizService.createQuiz({
            courseId: courseId,
            lessonId: lessonId,
            title: quizTitle,
            description: quizDescription,
            type: 'quiz',
            duration: quizDuration,
            passingScore: passingScore,
            totalPoints: totalPoints,
            questions: questions,
          });

          console.log(`Quiz created and saved for lesson ${lessonId}:`, quizRecord);
        } catch (quizErr) {
          console.error('Error creating quiz record:', quizErr);
        }
      }
    } catch (err) {
      console.error('Error in createAssessmentForQuiz:', err);
    }
  };

  const syncFlashcardsForLesson = async (lesson: any, courseId: string) => {
    try {
      let flashcardBlocks: any[] = [];
      const lessonId = lesson.id;

      if (typeof lesson.content === 'string') {
        try {
          const parsed = JSON.parse(lesson.content);
          if (Array.isArray(parsed)) {
            flashcardBlocks = parsed.filter((block: any) => block.type === 'flashcard');
          }
        } catch (e) {
          // Not JSON or other error
        }
      } else if (Array.isArray(lesson.content)) {
        flashcardBlocks = lesson.content.filter((block: any) => block.type === 'flashcard');
      }

      if (flashcardBlocks.length === 0) return;

      for (const block of flashcardBlocks) {
        const flashcards = block.data?.flashcards || [];
        if (flashcards.length === 0) continue;

        // Create or update flashcard set
        const { error: setError } = await supabase
          .from('flashcard_sets')
          .upsert([{
            id: block.id,
            lesson_id: lessonId,
            course_id: courseId,
            title: block.title || `Flashcards in ${lesson.title}`,
            description: block.description || '',
            total_cards: flashcards.length,
            ai_generated_count: flashcards.filter((f: any) => f.is_ai_generated).length,
          }], { onConflict: 'id' });

        if (setError) {
          console.error('Error syncing flashcard set:', setError);
          continue;
        }

        // Delete existing cards for this set to avoid duplicates
        await supabase.from('flashcards').delete().eq('flashcard_set_id', block.id);

        // Insert cards
        const cardsToInsert = flashcards.map((card: any, index: number) => ({
          flashcard_set_id: block.id,
          front: card.front,
          back: card.back,
          order: index,
          is_ai_generated: card.is_ai_generated || false,
          difficulty: card.difficulty || 'medium',
          tags: card.tags || [],
        }));

        const { error: cardsError } = await supabase.from('flashcards').insert(cardsToInsert);
        if (cardsError) console.error('Error syncing flashcards:', cardsError);
      }
    } catch (err) {
      console.error('Error in syncFlashcardsForLesson:', err);
    }
  };

  const handleSaveCourse = async (courseData: any, lessons: Omit<Lesson, 'id' | 'created_at'>[]) => {
    try {
      let courseId: string;
      console.log('Starting course save process...');
      console.log('Course data:', courseData);
      console.log('Lessons received:', lessons);

      if (editingCourse && editingCourse.id) {
        courseId = editingCourse.id;
        console.log('Updating existing course:', courseId);
        const updates = {
          title: courseData.title,
          description: courseData.description,
          category: courseData.category,
          thumbnail: courseData.thumbnail,
          instructorname: courseData.instructorname,
          level: (courseData.level || 'beginner').toLowerCase(),
          duration: courseData.duration || 0,
          updatedat: new Date().toISOString(),
          status: courseData.status,
          language: courseData.language,
          course_type: courseData.course_type || 'regular',
          certificate_enabled: courseData.certificate_enabled !== false,
          is_hidden: courseData.is_hidden || false,
        };
        await courseService.updateCourse(courseId, updates);

        // For existing courses, we'll delete old lessons and create new ones
        const existingLessons = await lessonService.getLessonsByCourseId(courseId);
        if (existingLessons && existingLessons.length > 0) {
          const lessonIdsToDelete = existingLessons.map(l => l.id!);
          // Delete assessments first
          await deleteAssessmentsForLessons(lessonIdsToDelete);
          await lessonService.deleteLessons(lessonIdsToDelete);
        }

      } else if (user) {
        console.log('Creating new course...');
        const profile = await userService.getUserProfile(user.id);
        const newCourse: any = {
          title: courseData.title,
          description: courseData.description,
          category: courseData.category,
          thumbnail: courseData.thumbnail,
          instructorname: courseData.instructorname || profile?.fullname || 'N/A',
          instructorid: user.id,
          totalstudents: 0,
          completionrate: 0,
          level: (courseData.level || 'beginner').toLowerCase(),
          duration: courseData.duration || 0,
          status: courseData.status || 'draft',
          language: courseData.language || 'English',
          course_type: courseData.course_type || 'regular',
          certificate_enabled: courseData.certificate_enabled !== false,
          is_hidden: courseData.is_hidden || false,
        };
        const createdCourse = await courseService.createCourse(newCourse);
        if (!createdCourse) throw new Error('Failed to create course');
        courseId = createdCourse.id!;
        console.log('Created new course with ID:', courseId);
      } else if (courseData.id) {
        // Handle case where course ID is passed from CourseBuilder for existing courses
        courseId = courseData.id;
        console.log('Using existing course ID from courseData:', courseId);
        const updates = {
          title: courseData.title,
          description: courseData.description,
          category: courseData.category,
          thumbnail: courseData.thumbnail,
          instructorname: courseData.instructorname,
          level: (courseData.level || 'beginner').toLowerCase(),
          duration: courseData.duration || 0,
          updatedat: new Date().toISOString(),
          status: courseData.status,
          language: courseData.language,
          course_type: courseData.course_type || 'regular',
          certificate_enabled: courseData.certificate_enabled !== false,
          is_hidden: courseData.is_hidden || false,
        };
        await courseService.updateCourse(courseId, updates);

        // For existing courses, we'll delete old lessons and create new ones
        const existingLessons = await lessonService.getLessonsByCourseId(courseId);
        if (existingLessons && existingLessons.length > 0) {
          const lessonIdsToDelete = existingLessons.map(l => l.id!);
          // Delete assessments first
          await deleteAssessmentsForLessons(lessonIdsToDelete);
          await lessonService.deleteLessons(lessonIdsToDelete);
        }
      } else {
        throw new Error('No user logged in and not editing existing course');
      }

      // Add courseId to lessons and save them
      // Filter out any lessons that might have empty courseid and ensure they all use the correct courseId
      const validLessons = lessons
        .filter(lesson => lesson.title && lesson.module_title) // Basic validation
        .map(lesson => {
          // Extract title from first content block if lesson title is still "New Lesson" or "New Acknowledgement"
          let finalTitle = lesson.title;
          if ((lesson.title === 'New Lesson' || lesson.title === 'New Acknowledgement') && Array.isArray(lesson.content) && lesson.content.length > 0) {
            // For acknowledgement lessons, look for acknowledgement block
            if (lesson.type === 'acknowledgement' || lesson.content.some((b: any) => b.type === 'acknowledgement')) {
              const ackBlock = lesson.content.find((b: any) => b.type === 'acknowledgement');
              if (ackBlock && ackBlock.title && ackBlock.title !== 'New Acknowledgement') {
                finalTitle = ackBlock.title;
              }
            } else {
              // For other types, use first block title
              const firstBlock = lesson.content[0];
              if (firstBlock.title && firstBlock.title !== 'New Lesson') {
                finalTitle = firstBlock.title;
              }
            }
          }

          // Check if lesson has quiz content
          let lessonType = lesson.type || 'text';
          if (Array.isArray(lesson.content) && lesson.content.some((block: any) => block.type === 'quiz')) {
            lessonType = 'quiz';
          }

          return {
            ...lesson,
            title: finalTitle,
            courseid: courseId,
            module_order: lesson.module_order || 0,
            order: lesson.order || 0,
            type: lessonType,
            duration: lesson.duration || 0,
            islocked: lesson.islocked || false
          };
        });

      console.log('Saving lessons with courseId:', courseId);
      console.log('Valid lessons to save:', validLessons);

      if (validLessons.length > 0) {
        const result = await lessonService.createLessons(validLessons);
        console.log('Lessons saved successfully:', result);

        // Create assessments for all lessons with quiz content
        // First, fetch the created lessons to get their IDs
        const createdLessons = await lessonService.getLessonsByCourseId(courseId);
        for (const lesson of createdLessons) {
          // Create assessment for quiz lessons OR lessons with quiz content blocks
          await createAssessmentForQuiz(lesson, courseId);
          // Sync flashcards for lessons with flashcard content blocks
          await syncFlashcardsForLesson(lesson, courseId);
        }
      } else {
        console.log('No valid lessons to save');
      }

      // Save skill-course mappings if skills were selected
      if (courseData.selectedSkillIds && courseData.selectedSkillIds.length > 0) {
        try {
          const aiGeneratedSet = new Set<string>(courseData.aiGeneratedSkillIds || []);
          const now = new Date().toISOString();

          // First, delete existing skill_course_mappings for this course
          await supabase
            .from('skill_course_mappings')
            .delete()
            .eq('courseid', courseId);

          // Then create new mappings, distinguishing AI vs manually selected
          const skillMappings = courseData.selectedSkillIds.map((skillId: string) => {
            const isAI = aiGeneratedSet.has(skillId);
            return {
              skillid: skillId,
              courseid: courseId,
              required: false,
              visible: true,
              hidden: false,
              generated_by_ai: isAI,
              ai_generated_at: isAI ? now : null,
            };
          });

          const { error } = await supabase
            .from('skill_course_mappings')
            .insert(skillMappings);

          if (error) {
            console.error('Error saving skill-course mappings:', error);
          } else {
            console.log(`Skill-course mappings saved for ${skillMappings.length} skills`);
          }
        } catch (err) {
          console.error('Error in skill mapping save:', err);
        }
      }

      await fetchCourses();
      setShowBuilder(false);
      setEditingCourse(null);
      console.log('Course save process completed successfully');
    } catch (err) {
      console.error('Error in handleSaveCourse:', err);
      setError(`Failed to save course: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setShowBuilder(true);
  };

  const handleCloseBuilder = () => {
    setShowBuilder(false);
    setEditingCourse(null);
  };

  const handleNavigateToAssignments = (courseId: string) => {
    setShowBuilder(false);
    setEditingCourse(null);
    navigate('/admin/course-assignments', { state: { selectedCourseId: courseId } });
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      await courseService.deleteCourse(id);
      await fetchCourses();
    } catch (err) {
      setError('Failed to delete course');
      console.error(err);
    }
  };

  const handleOpenColorSettings = (course: Course) => {
    setSelectedCourseForColors(course);
    setShowColorSettings(true);
  };

  const handleCloseColorSettings = () => {
    setShowColorSettings(false);
    setSelectedCourseForColors(null);
  };

  if (showBuilder) {
    return <CourseBuilder editingCourse={editingCourse} onCancel={handleCloseBuilder} onSave={handleSaveCourse} onNavigateToAssignments={handleNavigateToAssignments} />;
  }

  return (
    <AdminLayout title="Courses">
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-sm">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Courses</h2>
            <p className="text-gray-600 mt-1">Create and manage all course content</p>
          </div>
          {activeTab === 'courses' && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Clear course-related caches
                  localStorage.removeItem('cache:all_courses');
                  localStorage.removeItem('cache:published_courses');
                  localStorage.removeItem('cache:all_enrollments_summary');
                  localStorage.removeItem('cache:course_feedback_summary');
                  localStorage.removeItem('cache:all_lessons_summary');
                  // Reload data
                  fetchCourses();
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-sm flex items-center gap-2 transition-colors"
                title="Clear cache and reload course data"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                Refresh Data
              </button>
              <button
                onClick={() => setShowBuilder(true)}
                className="btn-create-course"
              >
                <span className="material-symbols-outlined">add</span>
                Create New Course
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('courses')}
            className={`pb-3 px-1 font-semibold text-sm transition-all relative flex items-center gap-2 ${activeTab === 'courses' ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span className="material-symbols-outlined text-base">school</span>
            Courses
            {activeTab === 'courses' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-sm" />}
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`pb-3 px-1 font-semibold text-sm transition-all relative flex items-center gap-2 ${activeTab === 'assignments' ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span className="material-symbols-outlined text-base">assignment_ind</span>
            Course Assignments
            {activeTab === 'assignments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-sm" />}
          </button>
          <button
            onClick={() => setActiveTab('add-assignment')}
            className={`pb-3 px-1 font-semibold text-sm transition-all relative flex items-center gap-2 ${activeTab === 'add-assignment' ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Add Assignment
            {activeTab === 'add-assignment' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-sm" />}
          </button>
        </div>

        {/* Courses Tab Content */}
        {activeTab === 'courses' && (
          <>
            {/* Search and Filter Controls - Simplified */}
            <div className="bg-white rounded-md border border-gray-200 p-4 space-y-3">
              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search by course title or instructor..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />

              {/* Filter Controls */}
              <div className="flex gap-3 flex-wrap items-center">
                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>

                {/* Level Filter */}
                <select
                  value={filterLevel}
                  onChange={(e) => {
                    setFilterLevel(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  <option value="">All Levels</option>
                  {levels.map(lvl => (
                    <option key={lvl} value={lvl}>{lvl.charAt(0).toUpperCase() + lvl.slice(1)}</option>
                  ))}
                </select>

                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  <option value="title">Sort: Title</option>
                  <option value="students">Sort: Learners</option>
                  <option value="completion">Sort: Completion</option>
                  <option value="rating">Sort: Rating</option>
                  <option value="recent">Sort: Recent</option>
                </select>

                {/* Sort Order */}
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1 text-sm"
                  title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
                >
                  <span className="material-symbols-outlined text-base">
                    {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                </button>

                {/* Items Per Page */}
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>

                {/* Reset button */}
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-2 bg-gray-200 text-gray-900 rounded-sm hover:bg-gray-300 transition-colors text-sm"
                  title="Reset all filters"
                >
                  <span className="material-symbols-outlined">refresh</span>
                </button>

                {/* Column Visibility Toggle */}
                <button
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-sm hover:bg-indigo-200 transition-colors flex items-center gap-1 text-sm"
                  title="Toggle visible columns"
                >
                  <span className="material-symbols-outlined text-base">view_column</span>
                  Columns
                </button>
              </div>

              {/* Column Visibility Settings */}
              {showColumnSettings && (
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200 space-y-4">
                  {/* Select All / Deselect All Buttons */}
                  <div className="flex gap-2 pb-3 border-b border-gray-200">
                    <button
                      onClick={selectAllColumns}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-indigo-50 text-indigo-700 rounded-sm hover:bg-indigo-100 transition-colors"
                      title="Select all columns"
                    >
                      <span className="material-symbols-outlined text-sm mr-1">check_box</span>
                      Select All
                    </button>
                    <button
                      onClick={deselectAllColumns}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-gray-200 text-gray-700 rounded-sm hover:bg-gray-300 transition-colors"
                      title="Deselect all columns"
                    >
                      <span className="material-symbols-outlined text-sm mr-1">check_box_outline_blank</span>
                      Deselect All
                    </button>
                  </div>

                  {/* Column Checkboxes */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(visibleColumns).map(([column, visible]) => (
                      <label key={column} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggleColumnVisibility(column as keyof typeof visibleColumns)}
                          className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 capitalize font-medium group-hover:text-indigo-600 transition-colors">
                          {column === 'course' && 'Course'}
                          {column === 'instructor' && 'Instructor'}
                          {column === 'category' && 'Category'}
                          {column === 'students' && 'Learners'}
                          {column === 'duration' && 'Duration'}
                          {column === 'completion' && 'Completion'}
                          {column === 'rating' && 'Rating'}
                          {column === 'status' && 'Status'}
                          {column === 'actions' && 'Actions'}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* View Preference Info */}
                  <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                    <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
                    Your column preferences are automatically saved
                  </div>
                </div>
              )}

              {/* Results count and Batch Actions */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <strong>{paginatedCourses.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredCourses.length)}</strong> of <strong>{filteredCourses.length}</strong> courses
                </div>

                {/* Batch Action Controls */}
                {selectedCourses.size > 0 && (
                  <div className="flex items-center gap-3 bg-indigo-50 px-4 py-3 rounded-md border border-indigo-200">
                    <div className="text-sm font-semibold text-indigo-700">
                      {selectedCourses.size} course{selectedCourses.size !== 1 ? 's' : ''} selected
                    </div>
                    <button
                      onClick={() => setShowBatchStatusModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-sm hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Change Status
                    </button>
                    <button
                      onClick={() => setShowBatchPublicViewModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">public</span>
                      Toggle Public View
                    </button>
                    <button
                      onClick={deselectAllCoursesList}
                      className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm font-medium"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Batch Status Change Modal */}
            {showBatchStatusModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                <div className="bg-white rounded-md shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">edit</span>
                    Change Status for {selectedCourses.size} Course{selectedCourses.size !== 1 ? 's' : ''}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Status
                      </label>
                      <select
                        value={batchStatusValue}
                        onChange={(e) => setBatchStatusValue(e.target.value as 'draft' | 'published')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-3">
                      <div className="flex gap-2 text-sm text-yellow-800">
                        <span className="material-symbols-outlined text-base flex-shrink-0">info</span>
                        <p>This action will update the status for all <strong>{selectedCourses.size}</strong> selected course{selectedCourses.size !== 1 ? 's' : ''} to <strong>{batchStatusValue}</strong>.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowBatchStatusModal(false)}
                      disabled={isBatchUpdating}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBatchStatusChange}
                      disabled={isBatchUpdating}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-sm hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isBatchUpdating && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                      {isBatchUpdating ? 'Updating...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Batch Public View Toggle Modal */}
            {showBatchPublicViewModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                <div className="bg-white rounded-md shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">public</span>
                    Toggle Public View for {selectedCourses.size} Course{selectedCourses.size !== 1 ? 's' : ''}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Visibility Setting
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-sm cursor-pointer hover:bg-blue-50" onClick={() => setBatchPublicViewValue(true)}>
                          <input
                            type="radio"
                            checked={batchPublicViewValue === true}
                            onChange={() => setBatchPublicViewValue(true)}
                            className="w-4 h-4 accent-blue-600 cursor-pointer"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Make Public</p>
                            <p className="text-xs text-gray-500">Courses will be visible to all learners</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-sm cursor-pointer hover:bg-red-50" onClick={() => setBatchPublicViewValue(false)}>
                          <input
                            type="radio"
                            checked={batchPublicViewValue === false}
                            onChange={() => setBatchPublicViewValue(false)}
                            className="w-4 h-4 accent-red-600 cursor-pointer"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Make Private</p>
                            <p className="text-xs text-gray-500">Courses will only be visible via assignment</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className={`${batchPublicViewValue ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'} border rounded-sm p-3`}>
                      <div className={`flex gap-2 text-sm ${batchPublicViewValue ? 'text-blue-800' : 'text-red-800'}`}>
                        <span className="material-symbols-outlined text-base flex-shrink-0">info</span>
                        <p>This action will make <strong>{selectedCourses.size}</strong> course{selectedCourses.size !== 1 ? 's' : ''} <strong>{batchPublicViewValue ? 'public' : 'private'}</strong> for all learners.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowBatchPublicViewModal(false)}
                      disabled={isBatchUpdating}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-sm hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBatchPublicViewChange}
                      disabled={isBatchUpdating}
                      className={`flex-1 px-4 py-2 ${batchPublicViewValue ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded-sm transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                      {isBatchUpdating && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                      {isBatchUpdating ? 'Updating...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Courses Table */}
            <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
              {coursesLoading ? (
                <div className="p-8 text-center text-gray-600">Loading courses...</div>
              ) : filteredCourses.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  {courses.length === 0 ? 'No courses found. Create your first course!' : 'No courses match the selected filters.'}
                </div>
              ) : coursesLoading ? (
                <div className="divide-y divide-gray-200 space-y-0">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-sm animate-pulse">
                      <div className="w-4 h-4 bg-gray-300 rounded-sm"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 rounded-sm w-1/3"></div>
                        <div className="h-3 bg-gray-200 rounded-sm w-1/4"></div>
                      </div>
                      <div className="h-4 bg-gray-300 rounded-sm w-24"></div>
                      <div className="h-4 bg-gray-300 rounded-sm w-20"></div>
                      <div className="h-4 bg-gray-300 rounded-sm w-16"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                          <input
                            type="checkbox"
                            checked={selectedCourses.size === paginatedCourses.length && paginatedCourses.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                selectAllOnPage();
                              } else {
                                deselectAllCoursesList();
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                          />
                        </th>
                        {visibleColumns.course && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Course</th>}
                        {visibleColumns.instructor && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Instructor</th>}
                        {visibleColumns.category && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>}
                        {visibleColumns.students && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Learners</th>}
                        {visibleColumns.duration && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>}
                        {visibleColumns.completion && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Completion</th>}
                        {visibleColumns.rating && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rating</th>}
                        {visibleColumns.status && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>}
                        {visibleColumns.actions && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedCourses.map((course) => (
                        <tr key={course.id} className={`hover:bg-gray-50 transition-colors ${selectedCourses.has(course.id!) ? 'bg-indigo-50' : ''}`}>
                          <td className="px-6 py-4 text-left">
                            <input
                              type="checkbox"
                              checked={selectedCourses.has(course.id!)}
                              onChange={() => toggleCourseSelection(course.id!)}
                              className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                            />
                          </td>
                          {visibleColumns.course && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-sm bg-cover bg-center flex-shrink-0"
                                  style={{ backgroundImage: `url(${course.thumbnail})` }}
                                />
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{course.title}</p>
                                </div>
                              </div>
                            </td>
                          )}
                          {visibleColumns.instructor && <td className="px-6 py-4 text-sm text-gray-600">{course.instructorname}</td>}
                          {visibleColumns.category && <td className="px-6 py-4 text-sm text-gray-600">{course.category}</td>}
                          {visibleColumns.students && <td className="px-6 py-4 text-sm text-gray-600">{course.totalstudents}</td>}
                          {visibleColumns.duration && (
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {course.duration && course.duration > 0 ? durationService.formatDurationForDisplay(course.duration) : '—'}
                            </td>
                          )}
                          {visibleColumns.completion && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-sm h-1.5">
                                  <div
                                    className="bg-primary h-1.5 rounded-sm"
                                    style={{ width: `${course.completionrate}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-600">{(course.completionrate || 0).toFixed(1)}%</span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.rating && (
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-yellow-400 text-base">star</span>
                                <span className="text-gray-600">{(course.rating || 0).toFixed(1)}</span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-2">
                                <span className={`inline-flex px-3 py-1 rounded-md text-xs font-semibold ${course.status === 'published'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'}`}>
                                  {course.status === 'published' ? 'Published' : 'Draft'}
                                </span>
                                {course.is_hidden && (
                                  <span className="inline-flex px-3 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700 w-fit">
                                    <span className="material-symbols-outlined text-xs mr-1">visibility_off</span>
                                    Hidden
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.actions && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleViewFeedback(course)}
                                  className="p-2 hover:bg-yellow-50 rounded-sm transition-colors text-yellow-600"
                                  title="View Feedback"
                                >
                                  <span className="material-symbols-outlined text-lg">star_rate</span>
                                </button>
                                <button
                                  onClick={() => handleOpenColorSettings(course)}
                                  className="p-2 hover:bg-indigo-50 rounded-sm transition-colors text-indigo-600"
                                  title="Customize Flashcard Colors"
                                >
                                  <span className="material-symbols-outlined text-lg">palette</span>
                                </button>
                                <button
                                  onClick={() => handleEditCourse(course)}
                                  className="p-2 hover:bg-gray-100 rounded-sm transition-colors text-gray-600"
                                  title="Edit Course"
                                >
                                  <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button
                                  onClick={() => handleNavigateToAssignments(course.id!)}
                                  className="p-2 hover:bg-blue-50 rounded-sm transition-colors text-blue-600"
                                  title="Assign Course to Users"
                                >
                                  <span className="material-symbols-outlined text-lg">person_add</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteCourse(course.id!)}
                                  className="p-2 hover:bg-red-50 rounded-sm transition-colors text-red-600"
                                  title="Delete Course"
                                >
                                  <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredCourses.length > 0 && (
              <div className="flex items-center justify-between bg-white rounded-md border border-gray-200 p-4">
                <div className="text-sm text-gray-600">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-sm transition-colors ${currentPage === page
                          ? 'bg-indigo-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-100'
                          }`}
                      >
                        {page}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Assignments Tab Content */}
        {activeTab === 'assignments' && (
          <div className="bg-white rounded-md border border-gray-200 p-6">
            <CourseAssignments />
          </div>
        )}

        {/* Add Assignment Tab Content */}
        {activeTab === 'add-assignment' && (
          <ManageCourseAssignments hideLayout={true} />
        )}
      </div>

      {/* Flashcard Color Settings Modal */}
      {
        selectedCourseForColors && (
          <FlashcardColorSettingsModal
            courseId={selectedCourseForColors.id!}
            courseName={selectedCourseForColors.title}
            isOpen={showColorSettings}
            onClose={handleCloseColorSettings}
            onSave={fetchCourses}
          />
        )
      }

      {/* Course Feedback Modal */}
      {
        selectedCourseForFeedback && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-md max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Feedback & Ratings</h3>
                  <p className="text-sm text-gray-600">View learner feedback</p>
                </div>
                <button
                  onClick={() => setSelectedCourseForFeedback(null)}
                  className="p-2 hover:bg-gray-200 rounded-sm transition-colors text-gray-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {feedbackLoading ? (
                  <div className="text-center py-8 text-gray-600">
                    <div className="inline-block animate-spin rounded-sm h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                    <p>Loading feedback data...</p>
                  </div>
                ) : (
                  <>
                    {feedbackStats && (
                      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-md border border-yellow-200 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="text-4xl font-bold text-yellow-600 mb-2">
                              {feedbackStats.averageRating.toFixed(1)}
                            </div>
                            <div className="flex gap-1 mb-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className={`material-symbols-outlined text-2xl ${star <= Math.round(feedbackStats.averageRating) ? 'text-yellow-400' : 'text-gray-300'}`}>
                                  star
                                </span>
                              ))}
                            </div>
                            <p className="text-sm text-gray-600">
                              {feedbackStats.totalRatings} {feedbackStats.totalRatings === 1 ? 'rating' : 'ratings'}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {[5, 4, 3, 2, 1].map((rating) => (
                              <div key={rating} className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-600 w-12">{rating} ⭐</span>
                                <div className="flex-1 bg-gray-200 rounded-sm h-2">
                                  <div
                                    className="bg-yellow-400 h-2 rounded-sm transition-all"
                                    style={{
                                      width: `${feedbackStats.totalRatings > 0 ? (feedbackStats.ratingDistribution[rating] / feedbackStats.totalRatings) * 100 : 0}%`
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-600 w-8 text-right">
                                  {feedbackStats.ratingDistribution[rating]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">
                        All Reviews ({courseFeedbacks.length})
                      </h4>
                      {courseFeedbacks.length > 0 ? (
                        <div className="space-y-4">
                          {courseFeedbacks.map((feedback: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {feedback.profiles?.fullname || 'Anonymous User'}
                                  </p>
                                  <div className="flex gap-1 mt-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <span
                                        key={star}
                                        className={`material-symbols-outlined text-sm ${star <= feedback.rating ? 'text-yellow-400' : 'text-gray-300'
                                          }`}
                                      >
                                        star
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">
                                    {feedback.created_at ? new Date(feedback.created_at).toLocaleDateString() : 'N/A'}
                                  </p>
                                  {feedback.updated_at && feedback.updated_at !== feedback.created_at && (
                                    <p className="text-xs text-gray-400">
                                      (edited)
                                    </p>
                                  )}
                                </div>
                              </div>
                              {feedback.feedback && (
                                <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                                  {feedback.feedback}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">comment</span>
                          <p>No feedback received yet</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }
    </AdminLayout >
  );
};

export default AdminCourses;

