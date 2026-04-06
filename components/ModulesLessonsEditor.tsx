import React, { useState, useEffect } from 'react';
import LessonContentEditor from './LessonContentEditor';
import { supabase } from '../lib/supabaseClient';
import './ModulesLessonsEditor.css';
import {
  DndContext,
  closestCenter,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ContentBlock {
  id: string;
  type: 'text' | 'pdf' | 'video' | 'quiz' | 'acknowledgement' | 'flashcard';
  title: string;
  content: string;
  description?: string;
  url?: string;
  data?: {
    questions?: Array<{ id: number; question: string; type: string; options: string[]; correctAnswer: number }>;
    duration?: number;
    passingScore?: number;
    policyTitle?: string;
    checkboxLabel?: string;
    signatureLabel?: string;
  };
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  type: 'text' | 'pdf' | 'video' | 'quiz' | 'acknowledgement';
  content?: ContentBlock[];
  duration_minutes?: number;
}

interface ModulesLessonsEditorProps {
  courseData: any;
  onComplete: (modules: Module[]) => void;
}

const SortableLessonItem: React.FC<{
  module: Module;
  lesson: Lesson;
  getLessonIcon: (type: string) => string;
  onEdit: (args: { moduleId: string; lessonId: string }) => void;
  onRemove: (moduleId: string, lessonId: string) => void;
}> = ({ module, lesson, getLessonIcon, onEdit, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span {...listeners} className="material-symbols-outlined text-black/60 cursor-grab">
            drag_indicator
          </span>
          <span className="material-symbols-outlined text-black/60">
            {getLessonIcon(lesson.type)}
          </span>
          <div>
            <p className="text-sm font-medium text-black">{lesson.title}</p>
            <p className="text-xs text-black/50 capitalize">{lesson.type}</p>
            {lesson.content && lesson.content.length > 0 && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                {lesson.content.length} content block{lesson.content.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit({ moduleId: module.id, lessonId: lesson.id })}
            className="p-2 hover:bg-blue-100 text-blue-600 rounded transition-colors"
            title="Edit lesson content"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
          <button
            type="button"
            onClick={() => onRemove(module.id, lesson.id)}
            className="p-2 hover:bg-red-100 text-red-600 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const SortableModuleItem: React.FC<{
  module: Module;
  expandedModule: string;
  setExpandedModule: (id: string) => void;
  removeModule: (id: string) => void;
  sensors: any;
  handleDragEnd: (event: any) => void;
  getLessonIcon: (type: string) => string;
  setEditingLesson: (args: { moduleId: string; lessonId: string } | null) => void;
  removeLesson: (moduleId: string, lessonId: string) => void;
  addLesson: (moduleId: string, type?: 'text' | 'pdf' | 'video' | 'quiz' | 'acknowledgement') => void;
}> = ({ module, expandedModule, setExpandedModule, removeModule, sensors, handleDragEnd, getLessonIcon, setEditingLesson, removeLesson, addLesson }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-gray-300 rounded-lg overflow-hidden bg-white mb-4">
      <div
        onClick={() => setExpandedModule(expandedModule === module.id ? '' : module.id)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span {...listeners} {...attributes} className="material-symbols-outlined text-black/60 cursor-grab p-1 hover:bg-gray-100 rounded">
            drag_indicator
          </span>
          <span className="font-semibold text-black">{module.title}</span>
          <span className="text-sm text-black/50">({module.lessons.length} lessons)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeModule(module.id);
            }}
            className="p-2 hover:bg-red-100 text-red-600 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
          <span className="material-symbols-outlined text-black/60">
            {expandedModule === module.id ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </div>

      {expandedModule === module.id && (
        <div className="p-4 space-y-2 border-t border-gray-300 bg-white">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={module.lessons.map((l: Lesson) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {module.lessons.map((lesson: Lesson) => (
                <SortableLessonItem
                  key={lesson.id}
                  module={module}
                  lesson={lesson}
                  getLessonIcon={getLessonIcon}
                  onEdit={setEditingLesson}
                  onRemove={removeLesson}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => addLesson(module.id, 'text')}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 border-dashed border-gray-400 text-black/60 hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span className="text-sm font-medium">Add Lesson</span>
            </button>
            <button
              type="button"
              onClick={() => addLesson(module.id, 'quiz')}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 border-dashed border-purple-400 text-purple-600 hover:bg-purple-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">quiz</span>
              <span className="text-sm font-medium">Add Module Quiz</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ModulesLessonsEditor: React.FC<ModulesLessonsEditorProps> = ({ courseData, onComplete }) => {
  const [modules, setModules] = useState<Module[]>(courseData?.modules || []);
  const [loading, setLoading] = useState(!!courseData?.id);
  const [error, setError] = useState<string | null>(null);

  const [expandedModule, setExpandedModule] = useState<string>('1');
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ moduleId: string; lessonId: string } | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load existing lessons from database
  useEffect(() => {
    if (courseData?.modules && courseData.modules.length > 0) {
      console.log('Using modules from courseData:', courseData.modules);
      setModules(courseData.modules);
      setLoading(false);
    } else if (courseData?.id) {
      console.log('Fetching modules from database for courseId:', courseData.id);
      loadExistingLessons();
    }
  }, [courseData?.id, courseData?.modules]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setModules((modules) => {
        const activeModule = modules.find(m => m.lessons.some(l => l.id === active.id));
        const overModule = modules.find(m => m.lessons.some(l => l.id === over.id));

        if (activeModule && overModule && activeModule.id === overModule.id) {
          const oldIndex = activeModule.lessons.findIndex(l => l.id === active.id);
          const newIndex = overModule.lessons.findIndex(l => l.id === over.id);
          const newLessons = arrayMove(activeModule.lessons, oldIndex, newIndex);
          return modules.map(m => m.id === activeModule.id ? { ...m, lessons: newLessons } : m);
        }
        return modules;
      });
    }
  };

  const handleModuleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = modules.findIndex(m => m.id === active.id);
      const newIndex = modules.findIndex(m => m.id === over.id);
      setModules(arrayMove(modules, oldIndex, newIndex));
    }
  };

  const loadExistingLessons = async () => {
    if (!courseData.id) {
      console.log('No courseData.id, using default modules');
      setModules([
        {
          id: '1',
          title: 'Module 1: Introduction',
          lessons: [
            { id: '1-1', title: 'Welcome to the Course', type: 'text', content: [] },
            { id: '1-2', title: 'Course Overview', type: 'video', content: [] },
          ],
        },
      ]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Loading lessons for courseId:', courseData.id);

      const { data: lessons, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('courseid', courseData.id)
        .order('module_order', { ascending: true })
        .order('order', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!lessons || lessons.length === 0) {
        console.log('No lessons found, using default modules');
        setModules([
          {
            id: '1',
            title: 'Module 1: Introduction',
            lessons: [
              { id: '1-1', title: 'Welcome to the Course', type: 'text', content: [] },
              { id: '1-2', title: 'Course Overview', type: 'video', content: [] },
            ],
          },
        ]);
        setLoading(false);
        return;
      }

      console.log('Loaded lessons:', lessons);

      // Group lessons by module
      const moduleMap = new Map<string, Module>();

      lessons.forEach((lesson: any) => {
        if (!moduleMap.has(lesson.module_title)) {
          moduleMap.set(lesson.module_title, {
            id: `module-${lesson.module_order}`,
            title: lesson.module_title,
            lessons: []
          });
        }

        const module = moduleMap.get(lesson.module_title)!;
        const lessonContent = (() => {
          try {
            if (typeof lesson.content === 'string') {
              const parsed = JSON.parse(lesson.content);
              return Array.isArray(parsed) ? parsed : [];
            }
            return Array.isArray(lesson.content) ? lesson.content : [];
          } catch {
            console.log('Failed to parse content for lesson:', lesson.id);
            return [];
          }
        })();

        module.lessons.push({
          id: lesson.id,
          title: lesson.title,
          type: lesson.type || 'text',
          content: lessonContent,
          duration_minutes: lesson.duration_minutes
        });
      });

      const loadedModules = Array.from(moduleMap.values());
      console.log('Loaded modules:', loadedModules);
      setModules(loadedModules);
    } catch (err) {
      console.error('Error loading lessons:', err);
      setError(`Failed to load existing lessons: ${err instanceof Error ? err.message : 'Unknown error'}`);
      // Fallback to default modules
      setModules([
        {
          id: '1',
          title: 'Module 1: Introduction',
          lessons: [
            { id: '1-1', title: 'Welcome to the Course', type: 'text', content: [] },
            { id: '1-2', title: 'Course Overview', type: 'video', content: [] },
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const addModule = () => {
    const newModule: Module = {
      id: Date.now().toString(),
      title: newModuleTitle || `Module ${modules.length + 1}: New Module`,
      lessons: [],
    };
    setModules([...modules, newModule]);
    setNewModuleTitle('');
    setEditingModule(null);
  };

  const addLesson = (moduleId: string, type: 'text' | 'pdf' | 'video' | 'quiz' | 'acknowledgement' = 'text') => {
    setModules(
      modules.map((m) =>
        m.id === moduleId
          ? {
            ...m,
            lessons: [
              ...m.lessons,
              {
                id: `${moduleId}-${m.lessons.length + 1}`,
                title: type === 'quiz' ? 'Module Quiz' : type === 'acknowledgement' ? 'New Acknowledgement' : 'New Lesson',
                type,
                content: (type === 'quiz' || type === 'acknowledgement') ? (type === 'quiz' ? [{
                  id: crypto.randomUUID(),
                  type: 'quiz',
                  title: 'Quiz Assessment',
                  content: '',
                  data: {
                    questions: [{ id: 1, question: '', type: 'multiple-choice', options: ['', '', '', ''], correctAnswer: 0 }],
                    duration: 30,
                    passingScore: 70
                  }
                }] : [{
                  id: crypto.randomUUID(),
                  type: 'acknowledgement',
                  title: 'New Acknowledgement',
                  content: '',
                  data: {
                    policyTitle: 'Policy Document',
                    checkboxLabel: 'I acknowledge that I have read and understood the above policy.',
                    signatureLabel: 'Type your full name as your digital signature'
                  }
                }]) : []
              },
            ],
          }
          : m
      )
    );
  };

  const saveLessonContent = (moduleId: string, lessonId: string, content: ContentBlock[], duration: number) => {
    // Extract title from content blocks - check for acknowledgement blocks regardless of lesson type
    let lessonTitle: string | undefined;

    if (Array.isArray(content) && content.length > 0) {
      // Check for acknowledgement block first
      if (content.some((b: any) => b.type === 'acknowledgement')) {
        const ackBlock = content.find((b: any) => b.type === 'acknowledgement');
        if (ackBlock?.title && ackBlock.title !== 'New Acknowledgement') {
          lessonTitle = ackBlock.title;
        }
      }
      // Otherwise check for quiz block
      else if (content.some((b: any) => b.type === 'quiz')) {
        const quizBlock = content.find((b: any) => b.type === 'quiz');
        if (quizBlock?.title && quizBlock.title !== 'Module Quiz' && quizBlock.title !== 'Quiz Assessment') {
          lessonTitle = quizBlock.title;
        }
      }
      // Otherwise use first block's title as fallback
      else {
        const firstBlock = content[0];
        if (firstBlock?.title && firstBlock.title !== 'New Lesson') {
          lessonTitle = firstBlock.title;
        }
      }
    }

    // Just update local state - the CourseBuilder will handle saving to database
    setModules(
      modules.map((m) =>
        m.id === moduleId
          ? {
            ...m,
            lessons: m.lessons.map((l) =>
              l.id === lessonId ? { ...l, content, duration_minutes: duration, ...(lessonTitle && { title: lessonTitle }) } : l
            ),
          }
          : m
      )
    );
    setEditingLesson(null);
  };

  const removeModule = (moduleId: string) => {
    setModules(modules.filter((m) => m.id !== moduleId));
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    setModules(
      modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      // Just pass the modules data back to CourseBuilder
      // The CourseBuilder will handle saving to database when the course is published
      onComplete(modules);
    } catch (err) {
      console.error('Error in modules editor:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getLessonIcon = (type: string) => {
    const icons: Record<string, string> = {
      text: 'description',
      pdf: 'picture_as_pdf',
      video: 'videocam',
      quiz: 'quiz',
    };
    return icons[type] || 'description';
  };

  if (editingLesson) {
    const module = modules.find((m) => m.id === editingLesson.moduleId);
    const lesson = module?.lessons.find((l) => l.id === editingLesson.lessonId);

    if (!lesson) return null;

    return (
      <LessonContentEditor
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        lessonType={lesson.type}
        courseId={courseData.id}
        initialContent={lesson.content}
        initialDuration={lesson.duration_minutes}
        onSave={(content, duration) => saveLessonContent(editingLesson.moduleId, editingLesson.lessonId, content, duration)}
        onCancel={() => setEditingLesson(null)}
      />
    );
  }

  if (loading && modules.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-2">Modules & Lessons</h2>
            <p className="text-gray-600">Organize your course content into modules and lessons.</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading existing lessons...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold text-gray-900 mb-2">Modules & Lessons</h2>
          <p className="text-gray-600">Organize your course content into modules and lessons.</p>
        </div>
        <button
          onClick={() => setEditingModule('new')}
          className="btn-create-course"
        >
          <span className="material-symbols-outlined">add</span>
          Create New Course
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600">error</span>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-300 p-6">
          <div className="space-y-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={handleModuleDragEnd}
            >
              <SortableContext
                items={modules.map(m => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {modules.map((module) => (
                  <SortableModuleItem
                    key={module.id}
                    module={module}
                    expandedModule={expandedModule}
                    setExpandedModule={setExpandedModule}
                    removeModule={removeModule}
                    sensors={sensors}
                    handleDragEnd={handleDragEnd}
                    getLessonIcon={getLessonIcon}
                    setEditingLesson={setEditingLesson}
                    removeLesson={removeLesson}
                    addLesson={addLesson}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {editingModule !== 'new' ? (
            <button
              type="button"
              onClick={() => setEditingModule('new')}
              className="w-full flex items-center justify-center gap-2 mt-4 py-3 px-4 rounded-lg border-2 border-dashed border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5]/10 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">add_circle</span>
              <span className="font-medium">Add New Module</span>
            </button>
          ) : (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Module title..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={addModule}
                className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingModule(null);
                  setNewModuleTitle('');
                }}
                className="px-4 py-2 bg-gray-300 text-black rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-300 pt-6">
          <button
            type="submit"
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-opacity ${loading
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-[#4f46e5] text-white hover:opacity-90'
              }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                Save & Next
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ModulesLessonsEditor;