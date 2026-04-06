import React, { useState, useEffect } from 'react';
import CourseDetailsForm from './CourseDetailsForm';
import ModulesLessonsEditor from './ModulesLessonsEditor';
import CourseReview from './CourseReview';
import { lessonService, Lesson } from '../lib/lessonService';
import { Course } from '../lib/courseService';
import { durationService } from '../lib/durationService';
import { generateCourseContent, generateSkillsForCourse } from '../lib/aiService';
import { courseAssignmentService } from '../lib/courseAssignmentService';
import { skillService } from '../lib/skillService';
import { supabase } from '../lib/supabaseClient';

interface CourseBuilderProps {
  onCancel: () => void;
  onSave: (courseData: any, lessons: Omit<Lesson, 'id' | 'created_at'>[]) => void;
  onNavigateToAssignments?: (courseId: string) => void;
  editingCourse?: any;
}

const CourseBuilder: React.FC<CourseBuilderProps> = ({ onCancel, onSave, onNavigateToAssignments, editingCourse }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(!!editingCourse);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiOptions, setAIOptions] = useState({
    modulesCount: 3,
    lessonsPerModule: 3,
    quizQuestionsCount: 5,
    flashcardLimit: 15,
    difficulty: editingCourse?.level || 'beginner',
    contentType: 'text',
    additionalPrompt: '',
    generateSkills: true,
    courseType: (editingCourse?.course_type || 'regular') as 'regular' | 'policy' | 'compliance',
  });
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [publishedCourseId, setPublishedCourseId] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<any>({
    title: editingCourse?.title || '',
    description: editingCourse?.description || '',
    instructorname: editingCourse?.instructorname || '',
    category: editingCourse?.category || 'Programming',
    thumbnail: editingCourse?.thumbnail || '',
    level: (editingCourse?.level || 'beginner').toLowerCase(),
    duration: editingCourse?.duration || 0,
    status: editingCourse?.status || 'draft',
    language: editingCourse?.language || 'English',
    course_type: editingCourse?.course_type || 'regular',
    certificate_enabled: editingCourse?.certificate_enabled !== false,
    modules: editingCourse?.modules || [],
    selectedSkillIds: [],
    aiGeneratedSkillIds: [],
  });

  useEffect(() => {
    if (editingCourse?.id) {
      loadLessonsForCourse();
    }
  }, [editingCourse?.id]);

  const loadLessonsForCourse = async () => {
    try {
      const lessons = await lessonService.getLessonsByCourseId(editingCourse.id);

      const moduleMap = new Map<string, any>();

      lessons.forEach((lesson: any) => {
        const moduleTitle = lesson.module_title || 'General';
        if (!moduleMap.has(moduleTitle)) {
          moduleMap.set(moduleTitle, {
            id: `module-${lesson.module_order || 0}`,
            title: moduleTitle,
            lessons: []
          });
        }

        const module = moduleMap.get(moduleTitle)!;
        const lessonContent = (() => {
          try {
            if (typeof lesson.content === 'string') {
              const parsed = JSON.parse(lesson.content);
              return Array.isArray(parsed) ? parsed : [];
            }
            return Array.isArray(lesson.content) ? lesson.content : [];
          } catch {
            return [];
          }
        })();

        module.lessons.push({
          id: lesson.id,
          title: lesson.title,
          type: lesson.type || 'text',
          content: lessonContent,
          duration: lesson.duration || 0,
          islocked: lesson.islocked
        });
      });

      const modules = Array.from(moduleMap.values());

      // Load skills for this course
      const { data: skillMappings } = await supabase
        .from('skill_course_mappings')
        .select('skillid')
        .eq('courseid', editingCourse.id);

      const selectedSkillIds = skillMappings?.map((m: any) => m.skillid) || [];

      setCourseData(prev => ({ ...prev, modules, selectedSkillIds }));
    } catch (err) {
      console.error('Error loading lessons:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsChange = (details: any) => {
    console.log('handleDetailsChange - received details:', details);
    const { instructor, selectedSkillIds, ...rest } = details;
    console.log('Selected skill IDs from form:', selectedSkillIds);
    setCourseData(prev => ({ ...prev, ...rest, instructorname: instructor, selectedSkillIds: selectedSkillIds || [] }));
  };

  const handleDetailsComplete = (details: any) => {
    console.log('CourseBuilder - Details complete from form:', details);
    handleDetailsChange(details);
    setStep(2);
  };

  const handleGenerateContent = () => {
    setShowAIModal(true);
  };

  const executeAIGeneration = async () => {
    if (!courseData.title) {
      alert('Please enter a course title first.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);
    setShowAIModal(false);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.floor(Math.random() * 10);
        });
      }, 800);

      const courseTypePrompt = aiOptions.courseType === 'policy'
        ? 'This is a Policy & Acknowledgement course. Generate formal policy document sections with clear headings, definitions, rules, and procedures. Use professional legal/HR language. Each lesson should cover one aspect of the policy (e.g., scope, definitions, procedures, penalties).'
        : aiOptions.courseType === 'compliance'
          ? 'This is a mandatory compliance training course. Focus on regulations, rules, required behaviors and consequences. Use clear authoritative language.'
          : '';

      const enrichedOptions = {
        ...aiOptions,
        additionalPrompt: [courseTypePrompt, aiOptions.additionalPrompt].filter(Boolean).join(' '),
      };

      const content = await generateCourseContent(courseData.title, enrichedOptions);

      // Generate skills if option is enabled
      let generatedSkillIds: string[] = [];
      if (aiOptions.generateSkills) {
        setGenerationProgress(95);
        try {
          const families = await skillService.getSkillFamilies();
          const familyNames = families.map(f => f.name);

          const skillResult = await generateSkillsForCourse(
            content.title || courseData.title as string,
            content.description || courseData.description as string,
            courseData.category || 'Programming',
            aiOptions.difficulty,
            familyNames
          );

          if (skillResult.skills && Array.isArray(skillResult.skills)) {
            for (const suggestion of skillResult.skills) {
              const { skill } = await skillService.ensureSkillAndFamily(suggestion);
              if (skill && skill.id) {
                generatedSkillIds.push(skill.id);
              }
            }
          }
        } catch (skillError) {
          console.error('Error generating skills during course generation:', skillError);
          // Don't fail the whole course generation if skills fail
        }
      }

      clearInterval(progressInterval);
      setGenerationProgress(100);

      // Calculate total duration from AI generated content (in minutes)
      let totalDurationMinutes = 0;
      content.modules.forEach((module: any) => {
        module.lessons.forEach((lesson: any) => {
          totalDurationMinutes += (lesson.duration || 0);
        });
      });

      const finalDuration = totalDurationMinutes > 0 ? totalDurationMinutes : courseData.duration || 0;

      setCourseData((prev: any) => ({
        ...prev,
        title: content.title || prev.title,
        description: content.description || prev.description,
        modules: content.modules,
        level: aiOptions.difficulty,
        duration: finalDuration,
        course_type: aiOptions.courseType,
        selectedSkillIds: generatedSkillIds.length > 0
          ? [...new Set([...(prev.selectedSkillIds || []), ...generatedSkillIds])]
          : (prev.selectedSkillIds || []),
        aiGeneratedSkillIds: generatedSkillIds.length > 0
          ? [...new Set([...(prev.aiGeneratedSkillIds || []), ...generatedSkillIds])]
          : (prev.aiGeneratedSkillIds || []),
      }));

      setTimeout(() => {
        setIsGenerating(false);
        setGenerationProgress(0);
        setStep(2); // Move to Modules & Lessons editor
      }, 500);
    } catch (error) {
      console.error('Error generating course content:', error);
      alert('Failed to generate course content. Please try again.');
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleModulesComplete = (modules: any) => {
    // Calculate total duration in MINUTES from all lessons
    let totalMinutes = 0;
    modules.forEach((module: any) => {
      module.lessons.forEach((lesson: any) => {
        totalMinutes += (lesson.duration_minutes || lesson.duration || 0);
      });
    });

    setCourseData(prev => {
      // Store duration in MINUTES (never convert to hours)
      const finalDuration = totalMinutes > 0 ? totalMinutes : prev.duration;

      return {
        ...prev,
        modules,
        duration: finalDuration
      };
    });
    setStep(3);
  };

  const handlePublish = async () => {
    console.log('handlePublish - courseData before publish:', courseData);
    console.log('handlePublish - selectedSkillIds:', courseData.selectedSkillIds);
    const { modules, ...courseDetails } = courseData;
    const lessonsToSave: Omit<Lesson, 'id' | 'created_at'>[] = [];

    modules.forEach((module: any, moduleIndex: number) => {
      module.lessons.forEach((lesson: any, lessonIndex: number) => {
        let content;
        switch (lesson.type) {
          case 'video':
          case 'text':
          case 'quiz':
          case 'flashcard':
            content = JSON.stringify(lesson.content);
            break;
          default:
            content = '';
        }

        const lessonDuration = Math.round(lesson.duration_minutes || lesson.duration || 0);

        lessonsToSave.push({
          courseid: editingCourse?.id || '',
          module_title: module.title,
          module_order: moduleIndex,
          title: lesson.title,
          content: content,
          order: lessonIndex,
          type: lesson.type,
          duration: lessonDuration,
          islocked: lesson.islocked || false,
        });
      });
    });

    const finalStatus = courseData.status || (editingCourse?.status) || 'draft';
    const courseDataToSave = editingCourse?.id
      ? { ...courseDetails, id: editingCourse.id, status: finalStatus }
      : { ...courseDetails, status: finalStatus };

    const courseId = editingCourse?.id || courseData.id;
    setPublishedCourseId(courseId as string);
    onSave(courseDataToSave, lessonsToSave);
    if (finalStatus === 'published') {
      setShowAssignmentModal(true);
    } else {
      onCancel(); // Just close if it's draft? Or show success.
    }
  };

  const steps = [
    { id: 1, label: 'Course Details', icon: 'info' },
    { id: 2, label: 'Modules & Lessons', icon: 'library_books' },
    { id: 3, label: 'Review & Publish', icon: 'visibility' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-dark">school</span>
            </div>
            <div>
              <h1 className="text-gray-900 text-base font-semibold">Course Builder</h1>
              <p className="text-gray-600 text-xs">{editingCourse ? 'Edit Course' : 'Create New Course'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {steps.map((s) => (
            <button
              key={s.id}
              onClick={() => step >= s.id && setStep(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${step === s.id
                ? 'text-[#4f46e5]'
                : step > s.id
                  ? 'text-gray-700 hover:opacity-80'
                  : 'text-gray-500 cursor-not-allowed'
                }`}
            >
              <span className="material-symbols-outlined text-lg flex-shrink-0">{s.icon}</span>
              <span className="text-sm font-medium">{s.label}</span>
              {step > s.id && <span className="material-symbols-outlined text-lg ml-auto text-green-500">check_circle</span>}
            </button>
          ))}
        </nav>

        <div className="p-4">
          {isGenerating ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-600">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  <span>AI generating...</span>
                </div>
                <span>{generationProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateContent}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:bg-indigo-400"
            >
              <span className="material-symbols-outlined">auto_awesome</span>
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
          )}
        </div>

        <button
          onClick={onCancel}
          className="m-4 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          Cancel
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {loading && editingCourse ? (
          <div className="p-8 max-w-4xl mx-auto flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading course content...</p>
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-4xl mx-auto">
            {step === 1 && <CourseDetailsForm courseData={courseData} onComplete={handleDetailsComplete} onChange={handleDetailsChange} isEditing={!!editingCourse} />}
            {step === 2 && <ModulesLessonsEditor courseData={courseData} onComplete={handleModulesComplete} />}
            {step === 3 && <CourseReview courseData={courseData} onPublish={handlePublish} onBack={() => setStep(2)} isEditing={!!editingCourse} />}
          </div>
        )}

        {showAIModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center gap-3 px-8 pt-8 pb-5 border-b border-gray-100 flex-shrink-0">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                  <span className="material-symbols-outlined text-3xl">auto_awesome</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI Course Generator</h2>
                  <p className="text-gray-600 text-sm">Configure generation parameters</p>
                </div>
                <button onClick={() => setShowAIModal(false)} className="ml-auto text-gray-400 hover:text-gray-600">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-8 py-5 space-y-5">
                {/* Course Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Course Title</label>
                  <input
                    type="text"
                    value={courseData.title || ''}
                    onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                    placeholder="Enter course title..."
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
                  />
                </div>

                {/* Course Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Course Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'regular', icon: 'school', label: 'Regular', color: 'indigo' },
                      { value: 'policy', icon: 'policy', label: 'Policy & Ack.', color: 'orange' },
                      { value: 'compliance', icon: 'verified_user', label: 'Compliance', color: 'blue' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const isPolicy = opt.value === 'policy';
                          const isCompliance = opt.value === 'compliance';
                          setAIOptions(prev => ({
                            ...prev,
                            courseType: opt.value,
                            modulesCount: isPolicy ? 1 : isCompliance ? 2 : prev.modulesCount,
                            lessonsPerModule: isPolicy ? 2 : prev.lessonsPerModule,
                          }));
                          setCourseData((prev: any) => ({ ...prev, course_type: opt.value }));
                        }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${aiOptions.courseType === opt.value
                          ? opt.value === 'policy'
                            ? 'border-orange-500 bg-orange-50'
                            : opt.value === 'compliance'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <span className={`material-symbols-outlined text-lg ${aiOptions.courseType === opt.value
                          ? opt.value === 'policy' ? 'text-orange-600' : opt.value === 'compliance' ? 'text-blue-600' : 'text-indigo-600'
                          : 'text-gray-400'
                          }`}>{opt.icon}</span>
                        <span className={`text-xs font-semibold ${aiOptions.courseType === opt.value ? 'text-gray-900' : 'text-gray-500'}`}>{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Policy-specific info */}
                  {aiOptions.courseType === 'policy' && (
                    <div className="mt-2 flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <span className="material-symbols-outlined text-orange-500 text-sm flex-shrink-0 mt-0.5">info</span>
                      <p className="text-xs text-orange-700">
                        AI will generate policy text lessons with structured sections. Add <strong>Acknowledgement</strong> blocks manually after generation for sign-off.
                      </p>
                    </div>
                  )}
                </div>

                {/* Difficulty + Content Style — always user-selectable */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Difficulty</label>
                    <select
                      value={aiOptions.difficulty}
                      onChange={(e) => setAIOptions({ ...aiOptions, difficulty: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Content Style</label>
                    <select
                      value={aiOptions.contentType}
                      onChange={(e) => setAIOptions({ ...aiOptions, contentType: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
                    >
                      <option value="text">Rich Text (Document)</option>
                      <option value="quiz">Quiz Focused</option>
                      <option value="flashcards">Flashcards Only</option>
                      <option value="text + quiz">Rich Text + Quiz</option>
                      <option value="text + flashcards">Rich Text + Flashcards</option>
                      <option value="quiz + flashcards">Quiz + Flashcards</option>
                      <option value="text + quiz + flashcards">Text + Quiz + Flashcards</option>
                      <option value="video">Video Placeholder</option>
                      <option value="text + video">Rich Text + Video</option>
                    </select>
                  </div>
                </div>

                {/* Module/Lesson counts */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {aiOptions.courseType === 'policy' ? 'Policy Sections (Modules)' : 'Modules'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={aiOptions.courseType === 'policy' ? 5 : 10}
                      value={aiOptions.modulesCount}
                      onChange={(e) => setAIOptions({ ...aiOptions, modulesCount: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {aiOptions.courseType === 'policy' ? 'Lessons / Section' : 'Lessons / Module'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={aiOptions.courseType === 'policy' ? 5 : 10}
                      value={aiOptions.lessonsPerModule}
                      onChange={(e) => setAIOptions({ ...aiOptions, lessonsPerModule: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
                    />
                  </div>
                </div>

                {/* Quiz/Flashcard counts — shown only when relevant content style selected */}
                {(aiOptions.contentType.includes('quiz') || aiOptions.contentType.includes('flashcard')) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Questions / Quiz</label>
                      <input
                        type="number" min="1" max="50"
                        value={aiOptions.quizQuestionsCount}
                        onChange={(e) => setAIOptions({ ...aiOptions, quizQuestionsCount: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 disabled:opacity-50"
                        disabled={!aiOptions.contentType.includes('quiz')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Cards / Flashcard</label>
                      <input
                        type="number" min="1" max="50"
                        value={aiOptions.flashcardLimit}
                        onChange={(e) => setAIOptions({ ...aiOptions, flashcardLimit: parseInt(e.target.value) || 15 })}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 disabled:opacity-50"
                        disabled={!aiOptions.contentType.includes('flashcard')}
                        placeholder="Max 50"
                      />
                    </div>
                  </div>
                )}

                {/* Additional Instructions */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Instructions <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <textarea
                    value={aiOptions.additionalPrompt}
                    onChange={(e) => setAIOptions({ ...aiOptions, additionalPrompt: e.target.value })}
                    placeholder={aiOptions.courseType === 'policy'
                      ? 'E.g. Include definitions, grievance procedure, penalties for violation...'
                      : 'E.g. Focus on practical examples, use a formal tone, include case studies...'}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 h-20 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-8 py-5 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setShowAIModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={executeAIGeneration}
                  disabled={!courseData.title}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  Generate Now
                </button>
              </div>
            </div>
          </div>
        )}

        {showAssignmentModal && publishedCourseId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Course Published!</h2>
              <p className="text-gray-600 mb-6">
                How would you like to assign this course to users?
              </p>

              <div className="space-y-3">
                <button
                  onClick={async () => {
                    try {
                      const users = await courseAssignmentService.getAllUsers();
                      await courseAssignmentService.assignCoursesToUsers(
                        users.map(u => u.id),
                        [publishedCourseId]
                      );
                      setShowAssignmentModal(false);
                    } catch (error) {
                      console.error('Error assigning to all users:', error);
                    }
                  }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-left"
                >
                  <div className="font-semibold">Public Course</div>
                  <div className="text-sm opacity-90">Assign to all users immediately</div>
                </button>

                <button
                  onClick={() => {
                    setShowAssignmentModal(false);
                    onNavigateToAssignments?.(publishedCourseId);
                  }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-left"
                >
                  <div className="font-semibold">Specific Users</div>
                  <div className="text-sm opacity-90">Select users and set requirements</div>
                </button>

                <button
                  onClick={() => setShowAssignmentModal(false)}
                  className="w-full px-4 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CourseBuilder;