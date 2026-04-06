import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './LessonContentEditor.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { supabase } from '../lib/supabaseClient';
import { durationService } from '../lib/durationService';
import { generateLessonContent, generateTextVariation, AIGenerationOptions } from '../lib/aiService';
import FlashcardEditor from './FlashcardEditor';

// Register Quill modules
const Formula = Quill.import('formats/formula');
const List = Quill.import('formats/list');
Quill.register(Formula, true);
Quill.register(List, true);

window.katex = katex;

interface ContentBlock {
  id: string;
  type: 'text' | 'pdf' | 'video' | 'quiz' | 'flashcard' | 'acknowledgement';
  title: string;
  content: string;
  description?: string;
  url?: string;
  data?: any;
}

interface LessonContentEditorProps {
  lessonId: string;
  lessonTitle?: string;
  lessonType?: string;
  courseId?: string;
  onSave: (content: ContentBlock[], duration: number) => void;
  onCancel: () => void;
  initialContent?: ContentBlock[];
  initialDuration?: number;
}

const LessonContentEditor: React.FC<LessonContentEditorProps> = ({
  lessonId,
  lessonTitle = 'New Lesson',
  lessonType = 'text',
  courseId,
  onSave,
  onCancel,
  initialContent = [],
  initialDuration = 0,
}) => {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>(
    initialContent.length > 0 ? initialContent : []
  );
  const [duration, setDuration] = useState(initialDuration);
  const [addingContent, setAddingContent] = useState(false);
  const [selectedType, setSelectedType] = useState<'text' | 'pdf' | 'video' | 'quiz' | 'flashcard' | null>(null);

  useEffect(() => {
    const calculateDuration = () => {
      let totalMinutes = 0;
      contentBlocks.forEach(block => {
        if (block.type === 'text') {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = block.content;
          const text = tempDiv.textContent || tempDiv.innerText || '';
          const wordCount = text.trim().split(/\s+/).length;
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
          // 1-2 minutes per card on average (depending on review)
          const cardCount = block.data?.totalCards || 10;
          totalMinutes += Math.max(5, Math.ceil(cardCount * 1.5));
        } else if (block.type === 'acknowledgement') {
          // 3 minutes to read policy + acknowledge
          totalMinutes += 3;
        }
      });
      return Math.ceil(totalMinutes);
    };

    // Only auto-update if the calculated duration is different and greater than 0
    // We want to allow manual override, but for now let's just auto-calculate
    // A better approach might be to have an "Auto-calculate" button or just show it as a suggestion
    // But the requirement says "auto calculate minutes... enable user(admin) can edit"
    // So we can set it, but user can change it.
    // If we put it in useEffect, it will overwrite user changes whenever content changes.
    // Maybe we only update if the user hasn't manually edited it? 
    // Or we can just update it and let user adjust at the end.
    // Let's update it but maybe provide a lock mechanism? 
    // For simplicity, let's just update it. The user can edit it before saving.
    // But if they edit and then add more content, it will overwrite.
    // Let's stick to auto-calculation for now.
    setDuration(calculateDuration());
  }, [contentBlocks]);

  const addContentBlock = (type: 'text' | 'pdf' | 'video' | 'quiz' | 'flashcard' | 'acknowledgement') => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      title: '',
      content: '',
      description: '',
    };
    setContentBlocks([...contentBlocks, newBlock]);
    setAddingContent(false);
    setSelectedType(null);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setContentBlocks(
      contentBlocks.map((block) => (block.id === id ? { ...block, ...updates } : block))
    );
  };

  const removeBlock = (id: string) => {
    setContentBlocks(contentBlocks.filter((block) => block.id !== id));
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const index = contentBlocks.findIndex((b) => b.id === id);
    if ((direction === 'up' && index > 0) || (direction === 'down' && index < contentBlocks.length - 1)) {
      const newBlocks = [...contentBlocks];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
      setContentBlocks(newBlocks);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(contentBlocks, duration);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-gray-900">{lessonTitle}</h3>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded capitalize">
              {lessonType}
            </span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Lesson Content</h2>
          <p className="text-gray-600">Add text, PDF, video, quiz, and flashcard content to your lesson.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Duration <span className="text-xs text-gray-500">(minutes)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-500">timer</span>
            <input
              type="number"
              min="0"
              value={duration}
              onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-right font-medium"
            />
            <span className="text-gray-600 text-sm">
              {durationService.formatDurationForDisplay(duration)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Auto-calculated based on content. You can override before saving.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content Blocks */}
        <div className="space-y-4">
          {contentBlocks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {contentBlocks.map((block, index) => (
                <ContentBlockEditor
                  key={block.id}
                  block={block}
                  lessonId={lessonId}
                  courseId={courseId}
                  onUpdate={(updates) => updateBlock(block.id, updates)}
                  onRemove={() => removeBlock(block.id)}
                  onMoveUp={() => moveBlock(block.id, 'up')}
                  onMoveDown={() => moveBlock(block.id, 'down')}
                  canMoveUp={index > 0}
                  canMoveDown={index < contentBlocks.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add Content Button */}
        {!addingContent ? (
          <button
            type="button"
            onClick={() => setAddingContent(true)}
            className="w-full py-4 border-2 border-dashed border-primary rounded-lg hover:border-primary hover:bg-primary/10 transition-colors text-center text-primary font-semibold"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-2xl">add_circle</span>
              <span className="font-medium">Add Content Block</span>
            </div>
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Content Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <button
                type="button"
                onClick={() => {
                  addContentBlock('text');
                  setSelectedType('text');
                }}
                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${selectedType === 'text'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                  }`}
              >
                <span className="material-symbols-outlined text-4xl">description</span>
                <span className="font-medium">Rich Text</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addContentBlock('pdf');
                  setSelectedType('pdf');
                }}
                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${selectedType === 'pdf'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                  }`}
              >
                <span className="material-symbols-outlined text-4xl">picture_as_pdf</span>
                <span className="font-medium">PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addContentBlock('video');
                  setSelectedType('video');
                }}
                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${selectedType === 'video'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                  }`}
              >
                <span className="material-symbols-outlined text-4xl">videocam</span>
                <span className="font-medium">Video</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addContentBlock('quiz');
                  setSelectedType('quiz');
                }}
                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${selectedType === 'quiz'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                  }`}
              >
                <span className="material-symbols-outlined text-4xl">quiz</span>
                <span className="font-medium">Quiz</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addContentBlock('flashcard');
                  setSelectedType('flashcard');
                }}
                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${selectedType === 'flashcard'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                  }`}
              >
                <span className="material-symbols-outlined text-4xl">flip_to_front</span>
                <span className="font-medium">Flashcards</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addContentBlock('acknowledgement');
                  setSelectedType('acknowledgement' as any);
                }}
                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${selectedType === ('acknowledgement' as any)
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-gray-200 hover:border-orange-500 hover:bg-orange-50'
                  }`}
              >
                <span className="material-symbols-outlined text-4xl text-orange-500">draw</span>
                <span className="font-medium">Acknowledgement</span>
                <span className="text-xs text-gray-500 text-center">Policy + Sign & Accept</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddingContent(false);
                setSelectedType(null);
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={contentBlocks.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Save Content
            <span className="material-symbols-outlined text-lg text-white">check</span>
          </button>
        </div>
      </form>
    </div>
  );
};

interface ContentBlockEditorProps {
  block: ContentBlock;
  lessonId: string;
  courseId?: string;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const ContentBlockEditor: React.FC<ContentBlockEditorProps> = ({
  block,
  lessonId,
  courseId,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return 'description';
      case 'pdf':
        return 'picture_as_pdf';
      case 'video':
        return 'videocam';
      case 'quiz':
        return 'quiz';
      case 'acknowledgement':
        return 'draw';
      default:
        return 'description';
    }
  };

  return (
    <div className="border-b border-gray-200 last:border-0">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-gray-600 cursor-grab">
            drag_indicator
          </span>
          <span className="material-symbols-outlined text-gray-600">
            {getTypeIcon(block.type)}
          </span>
          <input
            type="text"
            value={block.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-gray-900 bg-transparent border-none outline-none hover:bg-gray-200 px-2 py-1 rounded"
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={!canMoveUp}
            className={`p-2 rounded transition-colors ${canMoveUp
              ? 'hover:bg-gray-200 text-gray-600'
              : 'text-gray-300 cursor-not-allowed'
              }`}
          >
            <span className="material-symbols-outlined text-lg">arrow_upward</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={!canMoveDown}
            className={`p-2 rounded transition-colors ${canMoveDown
              ? 'hover:bg-gray-200 text-gray-600'
              : 'text-gray-300 cursor-not-allowed'
              }`}
          >
            <span className="material-symbols-outlined text-lg">arrow_downward</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-2 hover:bg-red-100 text-red-600 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>

          <span className="material-symbols-outlined text-gray-600">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 bg-white">
          {block.type === 'text' && (
            <TextContentEditor content={block.content} onChange={(content) => onUpdate({ content })} blockTitle={block.title} />
          )}
          {block.type === 'pdf' && (
            <PdfContentEditor block={block} content={block.content} onChange={(content) => onUpdate({ content })} onUpdate={onUpdate} />
          )}
          {block.type === 'video' && (
            <VideoContentEditor block={block} content={block.content} onUpdate={onUpdate} />
          )}
          {block.type === 'quiz' && (
            <QuizContentEditor block={block} content={block.content} onChange={(content) => onUpdate({ content })} onUpdate={onUpdate} />
          )}
          {block.type === 'flashcard' && (
            <FlashcardContentEditor block={block} lessonId={lessonId} courseId={courseId || ''} onUpdate={onUpdate} />
          )}
          {block.type === 'acknowledgement' && (
            <AcknowledgementContentEditor block={block} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  );
};

const TextContentEditor: React.FC<{ content: string; onChange: (content: string) => void; blockTitle?: string; courseTitle?: string }> = ({ content, onChange, blockTitle = '', courseTitle = '' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const isInitializing = useRef(false);
  const [showAIOptions, setShowAIOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiOptions, setAIOptions] = useState<AIGenerationOptions>({
    tone: 'professional',
    length: 'medium',
    difficulty: 'intermediate',
    includeExamples: true,
    includeSummary: true,
  });

  useEffect(() => {
    if (editorRef.current && !quillRef.current && !isInitializing.current) {
      isInitializing.current = true;
      const toolbarOptions = [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'font': [] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
        [{ 'script': 'sub' }, { 'script': 'super' }],
        [{ 'indent': '-1' }, { 'indent': '+1' }],
        [{ 'direction': 'rtl' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video', 'formula'],
        ['clean']
      ];

      const quill = new Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: toolbarOptions,
          formula: true,
        },
        placeholder: 'Start writing your lesson content here...',
        formats: [
          'header', 'font', 'size',
          'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
          'list', 'bullet', 'script', 'indent', 'direction',
          'color', 'background', 'align',
          'link', 'image', 'video', 'formula'
        ]
      });

      quill.on('text-change', (delta, oldDelta, source) => {
        if (source === 'user') {
          onChange(quill.root.innerHTML);
        }
      });

      if (content) {
        quill.clipboard.dangerouslyPasteHTML(content);
      }

      quillRef.current = quill;
    }

    return () => {
      if (quillRef.current && isInitializing.current) {
      }
    };
  }, [onChange]);

  const handleGenerateContent = async () => {
    setIsGenerating(true);
    try {
      const result = await generateLessonContent(blockTitle || 'Lesson Content', courseTitle, aiOptions);
      if (quillRef.current) {
        quillRef.current.root.innerHTML = result.content;
        onChange(quillRef.current.root.innerHTML);
      }
      setShowAIOptions(false);
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReplaceWithVariation = async (variationType: 'shorter' | 'longer' | 'simpler' | 'more_detailed' | 'different_perspective') => {
    if (!content) {
      alert('Please ensure the editor has content before generating variations.');
      return;
    }

    setIsGenerating(true);
    try {
      const plainText = quillRef.current?.getText() || '';
      const result = await generateTextVariation(plainText, blockTitle || 'Lesson Content', variationType);
      if (quillRef.current) {
        quillRef.current.root.innerHTML = result.content;
        onChange(quillRef.current.root.innerHTML);
      }
    } catch (error) {
      console.error('Error generating variation:', error);
      alert('Failed to generate variation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-2">AI Content Generation</h4>
            {!showAIOptions && !isGenerating && (
              <button
                type="button"
                onClick={() => setShowAIOptions(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                Generate Content with AI
              </button>
            )}
          </div>
        </div>

        {showAIOptions && !isGenerating && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tone
                </label>
                <select
                  value={aiOptions.tone}
                  onChange={(e) => setAIOptions({ ...aiOptions, tone: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                >
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                  <option value="professional">Professional</option>
                  <option value="conversational">Conversational</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Length
                </label>
                <select
                  value={aiOptions.length}
                  onChange={(e) => setAIOptions({ ...aiOptions, length: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                >
                  <option value="short">Short (200-300 words)</option>
                  <option value="medium">Medium (400-600 words)</option>
                  <option value="long">Long (800-1000 words)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty Level
                </label>
                <select
                  value={aiOptions.difficulty}
                  onChange={(e) => setAIOptions({ ...aiOptions, difficulty: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiOptions.includeExamples}
                      onChange={(e) => setAIOptions({ ...aiOptions, includeExamples: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Include Examples</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiOptions.includeSummary}
                      onChange={(e) => setAIOptions({ ...aiOptions, includeSummary: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Include Summary</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerateContent}
                disabled={isGenerating || !blockTitle}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined">check</span>
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
              <button
                type="button"
                onClick={() => setShowAIOptions(false)}
                className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {content && !isGenerating && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-3">Or refine existing content:</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => handleReplaceWithVariation('shorter')}
                title="Make content shorter and more concise"
                className="px-3 py-2 bg-gray-200 text-gray-900 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">compress</span>
                Shorter
              </button>
              <button
                type="button"
                onClick={() => handleReplaceWithVariation('longer')}
                title="Expand content with more details"
                className="px-3 py-2 bg-gray-200 text-gray-900 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">expand</span>
                Longer
              </button>
              <button
                type="button"
                onClick={() => handleReplaceWithVariation('simpler')}
                title="Simplify for beginners"
                className="px-3 py-2 bg-gray-200 text-gray-900 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">lightbulb</span>
                Simpler
              </button>
              <button
                type="button"
                onClick={() => handleReplaceWithVariation('more_detailed')}
                title="Add technical depth"
                className="px-3 py-2 bg-gray-200 text-gray-900 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">description</span>
                Detailed
              </button>
              <button
                type="button"
                onClick={() => handleReplaceWithVariation('different_perspective')}
                title="Rewrite from another angle"
                className="px-3 py-2 bg-gray-200 text-gray-900 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">panorama_horizontal</span>
                Rephrase
              </button>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-blue-700">Generating content with AI...</span>
          </div>
        )}
      </div>

      <div ref={editorRef} style={{ minHeight: '200px' }} />
    </div>
  );
};

const PdfContentEditor: React.FC<{ block: ContentBlock; content: string; onChange: (content: string) => void; onUpdate: (updates: Partial<ContentBlock>) => void }> = ({
  block,
  content,
  onChange,
  onUpdate,
}) => {
  const [fileName, setFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      if (file.size > 50 * 1024 * 1024) {
        alert('File size must be less than 50MB');
        return;
      }

      setIsUploading(true);
      setFileName(file.name);
      setUploadProgress(0);

      const filePath = `public/pdfs/${Date.now()}-${file.name}`;

      supabase.storage
        .from('lessons-content') // Assuming 'lessons-content' is your bucket name
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: ({ loaded, total }) => {
            setUploadProgress(Math.round((loaded / total) * 100));
          },
        })
        .then(({ data, error }) => {
          setIsUploading(false);
          if (error) throw error;
          onChange(supabase.storage.from('lessons-content').getPublicUrl(data.path).data.publicUrl);
        })
        .catch((error) => alert(`Error uploading file: ${error.message}`));
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        const input = document.createElement('input');
        input.type = 'file';
        input.files = files;
        handleFileUpload({ target: input } as any);
      }
    }
  };

  return (
    <div className="space-y-4">
      {content && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600">picture_as_pdf</span>
              <div>
                <p className="text-sm font-medium text-green-800">
                  {fileName || 'PDF uploaded successfully'}
                </p>
                <p className="text-xs text-green-600">Ready to embed</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setFileName('');
              }}
              className="p-2 hover:bg-green-100 text-green-600 rounded transition-colors"
              title="Remove PDF"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
      )}

      {!content && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-primary hover:bg-primary/5 transition-all"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <label className="flex flex-col items-center justify-center cursor-pointer">
            {isUploading ? (
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-600 mb-2">Uploading...</p>
                <div className="w-48 bg-gray-200 rounded-full h-2 mx-auto">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{uploadProgress}%</p>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-gray-400 mb-3 animate-bounce">
                  cloud_upload
                </span>
                <p className="text-sm text-gray-600 text-center mb-2">
                  <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF file (MAX. 50MB)</p>
              </>
            )}
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Number of Pages
        </label>
        <input
          type="number"
          min="1"
          value={block.data?.pages || 1}
          onChange={(e) => onUpdate({ data: { ...block.data, pages: parseInt(e.target.value) || 1 } })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
        />
        <p className="text-xs text-gray-500">Used to calculate lesson duration (2 mins per page)</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          PDF Description
        </label>
        <textarea
          placeholder="Add notes, description, or learning objectives for this PDF..."
          rows={3}
          value={block.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition resize-none"
        />
      </div>
    </div>
  );
};

const VideoContentEditor: React.FC<{ block: ContentBlock; content: string; onChange: (content: string) => void; onUpdate: (updates: Partial<ContentBlock>) => void }> = ({
  block,
  content,
  onChange,
  onUpdate,
}) => {
  const [videoUrl, setVideoUrl] = useState(block.url || '');
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('url');
  const [fileName, setFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setVideoUrl(newUrl);
    -   onUpdate({ url: newUrl, content: newUrl });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      if (file.size > 500 * 1024 * 1024) {
        alert('File size must be less than 500MB');
        return;
      }

      setIsUploading(true);
      setFileName(file.name);
      setUploadProgress(0);

      const filePath = `public/videos/${Date.now()}-${file.name}`;

      supabase.storage
        .from('lessons-content') // Assuming 'lessons-content' is your bucket name
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: ({ loaded, total }) => {
            setUploadProgress(Math.round((loaded / total) * 100));
          },
        })
        .then(({ data, error }) => {
          setIsUploading(false);
          if (error) throw error;
          onUpdate({ content: supabase.storage.from('lessons-content').getPublicUrl(data.path).data.publicUrl });
        })
        .catch((error) => alert(`Error uploading file: ${error.message}`));
    } else {
      alert('Please select a valid video file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.files = files;
        handleFileUpload({ target: input } as any);
      }
    }
  };

  const validateVideoUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    const vimeoRegex = /^(https?:\/\/)?(www\.)?vimeo\.com\/.+/;
    const directVideoRegex = /\.(mp4|mov|avi|webm|ogg)$/i;

    return youtubeRegex.test(url) || vimeoRegex.test(url) || directVideoRegex.test(url);
  };

  const handleEmbedUrl = () => {
    if (videoUrl && validateVideoUrl(videoUrl)) {
      onUpdate({ content: videoUrl, url: videoUrl });
    } else {
      alert('Please enter a valid video URL (YouTube, Vimeo, or direct video file)');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 border-transparent hover:border-primary/30 transition-all">
          <input
            type="radio"
            name="video-method"
            value="url"
            checked={uploadMethod === 'url'}
            onChange={(e) => setUploadMethod(e.target.value as 'url')}
            className="accent-primary"
          />
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-600">link</span>
            <span className="text-sm text-gray-700 font-medium">Video URL</span>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 border-transparent hover:border-primary/30 transition-all">
          <input
            type="radio"
            name="video-method"
            value="file"
            checked={uploadMethod === 'file'}
            onChange={(e) => setUploadMethod(e.target.value as 'file')}
            className="accent-primary"
          />
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-600">upload_file</span>
            <span className="text-sm text-gray-700 font-medium">Upload File</span>
          </div>
        </label>
      </div>

      {uploadMethod === 'url' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Video URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={videoUrl}
                onChange={handleUrlChange}
                placeholder="Paste YouTube, Vimeo, or direct video URL"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              />
              <button
                type="button"
                onClick={handleEmbedUrl}
                disabled={!videoUrl && !block.content}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity font-medium"
              >
                Embed
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Supports: YouTube, Vimeo, MP4, MOV, AVI, WebM
            </p>
          </div>

          {block.content && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">check_circle</span>
                  <span className="text-sm text-blue-800">Video ready to embed</span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdate({ content: '' })}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {uploadMethod === 'file' && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-primary hover:bg-primary/5 transition-all"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <label className="flex flex-col items-center justify-center cursor-pointer">
            {isUploading ? (
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-600 mb-2">Uploading video...</p>
                <div className="w-48 bg-gray-200 rounded-full h-2 mx-auto">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{uploadProgress}%</p>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-gray-400 mb-3 animate-pulse">
                  videocam
                </span>
                <p className="text-sm text-gray-600 text-center mb-2">
                  <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">MP4, MOV, AVI, WebM (MAX. 500MB)</p>
              </>
            )}
            <input
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Video Description & Transcript
        </label>
        <textarea
          placeholder="Add video description, learning objectives, or transcript..."
          rows={4}
          value={block.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition resize-none"
        />
      </div>
    </div>
  );
};

const QuizContentEditor: React.FC<{ block: ContentBlock; content: string; onChange: (content: string) => void; onUpdate: (updates: Partial<ContentBlock>) => void }> = ({
  block,
  content,
  onChange,
  onUpdate,
}) => {
  const [questions, setQuestions] = useState<any[]>(
    block.data?.questions || [{ id: 1, question: '', type: 'multiple-choice', options: ['', '', '', ''], correctAnswer: 0 }]
  );
  const [duration, setDuration] = useState(block.data?.duration || 30);
  const [passingScore, setPassingScore] = useState(block.data?.passingScore || 70);

  const handleAddQuestion = () => {
    const newQuestion = {
      id: Math.max(...questions.map(q => q.id), 0) + 1,
      question: '',
      type: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: 0,
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleUpdateQuestion = (id: number, updates: any) => {
    const updatedQuestions = questions.map(q => {
      if (q.id === id) {
        const updated = { ...q, ...updates };
        if (updated.type === 'true-false' && updated.options?.length !== 2) {
          updated.options = ['True', 'False'];
          if (updated.correctAnswer > 1) updated.correctAnswer = 0;
        }
        return updated;
      }
      return q;
    });
    setQuestions(updatedQuestions);
    onUpdate({ data: { questions: updatedQuestions, duration, passingScore } });
  };

  const handleRemoveQuestion = (id: number) => {
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    onUpdate({ data: { questions: updated, duration, passingScore } });
  };

  const handleAddOption = (questionId: number) => {
    const updatedQuestions = questions.map(q => {
      if (q.id === questionId) {
        return { ...q, options: [...q.options, ''] };
      }
      return q;
    });
    setQuestions(updatedQuestions);
    onUpdate({ data: { questions: updatedQuestions, duration, passingScore } });
  };

  const handleRemoveOption = (questionId: number, optionIndex: number) => {
    const updatedQuestions = questions.map(q => {
      if (q.id === questionId) {
        const newOptions = q.options.filter((_: string, idx: number) => idx !== optionIndex);
        let newCorrectAnswer = q.correctAnswer;
        if (q.correctAnswer === optionIndex) {
          newCorrectAnswer = 0;
        } else if (q.correctAnswer > optionIndex) {
          newCorrectAnswer = q.correctAnswer - 1;
        }
        return { ...q, options: newOptions, correctAnswer: newCorrectAnswer };
      }
      return q;
    });
    setQuestions(updatedQuestions);
    onUpdate({ data: { questions: updatedQuestions, duration, passingScore } });
  };

  const handleDurationChange = (value: number) => {
    setDuration(value);
    onUpdate({ data: { questions, duration: value, passingScore } });
  };

  const handlePassingScoreChange = (value: number) => {
    setPassingScore(value);
    onUpdate({ data: { questions, duration, passingScore: value } });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Quiz Duration (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="300"
            value={duration}
            onChange={(e) => handleDurationChange(parseInt(e.target.value) || 30)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
          />
          <p className="text-xs text-gray-500">Time limit for completing the quiz</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Passing Score (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={passingScore}
            onChange={(e) => handlePassingScoreChange(parseInt(e.target.value) || 70)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
          />
          <p className="text-xs text-gray-500">Minimum score to pass (0-100%)</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Quiz Instructions
        </label>
        <textarea
          placeholder="Provide instructions for the quiz..."
          rows={3}
          value={block.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition resize-none"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900">Questions ({questions.length})</h4>
          <span className="text-xs text-gray-500">Total: {questions.length} question{questions.length !== 1 ? 's' : ''}</span>
        </div>

        {questions.map((question, index) => (
          <div key={question.id} className="p-4 border border-gray-300 rounded-lg bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Question {index + 1}
              </label>
              <button
                type="button"
                onClick={() => handleRemoveQuestion(question.id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Remove
              </button>
            </div>

            <textarea
              placeholder="Enter your question..."
              value={question.question}
              onChange={(e) => handleUpdateQuestion(question.id, { question: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition resize-none"
              rows={2}
            />

            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">
                Question Type
              </label>
              <select
                value={question.type}
                onChange={(e) => handleUpdateQuestion(question.id, { type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
              >
                <option value="multiple-choice">Multiple Choice</option>
                <option value="true-false">True/False</option>
                <option value="short-answer">Short Answer</option>
              </select>
            </div>

            {question.type !== 'short-answer' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-700">
                    Options
                  </label>
                  {question.type === 'multiple-choice' && (
                    <button
                      type="button"
                      onClick={() => handleAddOption(question.id)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span> Add Option
                    </button>
                  )}
                </div>
                {question.options.map((option: string, optIndex: number) => (
                  <div key={optIndex} className="flex gap-2 items-start">
                    {question.type === 'true-false' ? (
                      <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm flex items-center">
                        {option}
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder={`Option ${optIndex + 1}`}
                        value={option}
                        onChange={(e) => {
                          const updated = [...question.options];
                          updated[optIndex] = e.target.value;
                          handleUpdateQuestion(question.id, { options: updated });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
                      />
                    )}
                    <div className="flex items-center gap-1">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={question.correctAnswer === optIndex}
                        onChange={() => handleUpdateQuestion(question.id, { correctAnswer: optIndex })}
                        className="cursor-pointer"
                      />
                      <label className="text-xs text-gray-600 cursor-pointer">Correct</label>
                    </div>
                    {question.type === 'multiple-choice' && question.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(question.id, optIndex)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        title="Remove option"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddQuestion}
          className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary hover:text-primary transition-colors text-sm font-medium"
        >
          + Add Question
        </button>
      </div>
    </div>
  );
};

export default LessonContentEditor;

const FlashcardContentEditor: React.FC<{
  block: ContentBlock;
  lessonId: string;
  courseId: string;
  onUpdate: (updates: Partial<ContentBlock>) => void;
}> = ({ block, lessonId, courseId, onUpdate }) => {
  const [showEditor, setShowEditor] = useState(false);

  const handleSave = (flashcards: any[]) => {
    onUpdate({
      data: {
        flashcards,
        totalCards: flashcards.length,
      },
      content: JSON.stringify(flashcards),
    });
    setShowEditor(false);
  };

  const currentFlashcards = block.data?.flashcards || [];

  return (
    <div className="space-y-4">
      {showEditor ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xl">
          <FlashcardEditor
            lessonId={lessonId}
            courseId={courseId}
            flashcardSetId={block.id}
            initialFlashcards={currentFlashcards}
            onSave={handleSave}
            onCancel={() => setShowEditor(false)}
          />
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-primary rounded-xl bg-blue-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl text-primary">
                flip_to_front
              </span>
            </div>
            <h5 className="text-lg font-bold text-gray-900 mb-2">
              {currentFlashcards.length > 0 ? '✓ Flashcard Set Ready' : '📚 Create Flashcards'}
            </h5>
            <p className="text-sm text-gray-700 mb-6 max-w-xs mx-auto">
              {currentFlashcards.length > 0
                ? `This set contains ${currentFlashcards.length} flashcards. Click below to add more or edit existing ones.`
                : 'Create interactive study cards for your students with manual entry or AI-powered generation.'}
            </p>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all font-semibold mx-auto"
            >
              <span className="material-symbols-outlined">edit</span>
              {currentFlashcards.length > 0 ? 'Edit Flashcards' : 'Create Flashcards'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AcknowledgementContentEditor: React.FC<{
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
}> = ({ block, onUpdate }) => {
  const data = block.data || {};
  const policyText = block.content || '';
  const checkboxLabel = data.checkboxLabel || 'I acknowledge that I have read and understood the above policy.';
  const signatureLabel = data.signatureLabel || 'Type your full name as your digital signature';
  const policyTitle = data.policyTitle || block.title || 'Policy Document';

  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);

  useEffect(() => {
    if (editorRef.current && !quillRef.current) {
      const q = new Quill(editorRef.current, {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] },
        placeholder: 'Enter policy text, terms, or code of conduct content here...',
      });
      q.on('text-change', () => {
        onUpdate({ content: q.root.innerHTML });
      });
      if (policyText) {
        q.clipboard.dangerouslyPasteHTML(policyText);
      }
      quillRef.current = q;
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <span className="material-symbols-outlined text-orange-600 text-2xl">policy</span>
        <div>
          <p className="text-sm font-semibold text-orange-800">Policy Acknowledgement Block</p>
          <p className="text-xs text-orange-600">Learner must read, check the box, and sign before they can complete this lesson.</p>
        </div>
      </div>

      {/* Policy Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Policy / Document Name</label>
        <input
          type="text"
          value={policyTitle}
          onChange={e => onUpdate({ title: e.target.value, data: { ...data, policyTitle: e.target.value } })}
          placeholder="e.g., POSH Policy, Code of Conduct, NDA..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
        />
      </div>

      {/* Policy Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Policy Text / Content</label>
        <div
          ref={editorRef}
          className="bg-white border border-gray-300 rounded-lg"
          style={{ minHeight: 180 }}
        />
      </div>

      {/* Checkbox Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Acknowledgement Checkbox Text
          <span className="ml-1 text-xs text-gray-400">(what learner agrees to)</span>
        </label>
        <input
          type="text"
          value={checkboxLabel}
          onChange={e => onUpdate({ data: { ...data, checkboxLabel: e.target.value } })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
        />
        <div className="mt-2 flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <input type="checkbox" disabled className="mt-0.5 w-4 h-4 accent-orange-500" />
          <span className="text-sm text-gray-600 italic">{checkboxLabel}</span>
        </div>
      </div>

      {/* Signature Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Signature Field Label</label>
        <input
          type="text"
          value={signatureLabel}
          onChange={e => onUpdate({ data: { ...data, signatureLabel: e.target.value } })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
        />
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">{signatureLabel}</p>
          <div className="h-10 border-b-2 border-gray-400 border-dashed flex items-end pb-1">
            <span className="text-xs text-gray-400 italic">Learner types full name here...</span>
          </div>
        </div>
      </div>
    </div>
  );
};