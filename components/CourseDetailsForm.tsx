import React, { useState, useEffect } from 'react';
import { categoryService } from '../lib/categoryService';
import { lessonService } from '../lib/lessonService';
import { durationService } from '../lib/durationService';
import CourseSkillSelector from './CourseSkillSelector';
import { supabase } from '../lib/supabaseClient';

interface CourseDetailsFormProps {
  courseData: any;
  onComplete: (details: any) => void;
  onChange?: (details: any) => void;
  isEditing?: boolean;
}

const CourseDetailsForm: React.FC<CourseDetailsFormProps> = ({ courseData, onComplete, onChange, isEditing }) => {
  const [categories, setCategories] = useState<string[]>(['Programming', 'Design', 'Marketing', 'Business', 'Sales', 'Data Science']);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [useCustomInstructor, setUseCustomInstructor] = useState(false);
  const [instructorSearch, setInstructorSearch] = useState('');
  const [showInstructorDropdown, setShowInstructorDropdown] = useState(false);
  const [calculatedDuration, setCalculatedDuration] = useState<number | null>(null);

  useEffect(() => {
    loadCategories();
    loadInstructors();
  }, []);

  useEffect(() => {
    // Auto-calculate duration from modules if they exist
    if (courseData.modules && courseData.modules.length > 0) {
      let totalMinutes = 0;
      courseData.modules.forEach((module: any) => {
        if (module.lessons && module.lessons.length > 0) {
          module.lessons.forEach((lesson: any) => {
            // Use the duration calculation from lessonService
            totalMinutes += lessonService.calculateLessonDuration(lesson);
          });
        }
      });
      setCalculatedDuration(totalMinutes);

      // Auto-fill duration if it's not set (0) or if modules have changed
      if (totalMinutes > 0 && (!courseData.duration || courseData.duration === 0)) {
        setFormData(prev => ({ ...prev, duration: totalMinutes }));
        if (onChange) {
          onChange({ ...courseData, duration: totalMinutes });
        }
      }
    } else {
      setCalculatedDuration(null);
    }
  }, [courseData.modules]);

  const loadInstructors = async () => {
    try {
      const { data: instructorsData } = await supabase
        .from('profiles')
        .select('id, fullname, email, role')
        .in('role', ['instructor', 'admin'])
        .order('fullname', { ascending: true });

      if (instructorsData) {
        setInstructors(instructorsData);
      }
    } catch (error) {
      console.error('Error loading instructors:', error);
    }
  };

  useEffect(() => {
    const currentInstructor = courseData.instructorname || courseData.instructor || '';
    const isCustom = currentInstructor && !instructors.find(i => i.fullname === currentInstructor);
    setUseCustomInstructor(isCustom);

    setFormData(prev => ({
      ...prev,
      title: courseData.title || '',
      description: courseData.description || '',
      instructor: currentInstructor,
      category: courseData.category || 'Programming',
      thumbnail: courseData.thumbnail || '',
      level: (courseData.level || 'beginner').toLowerCase(),
      duration: courseData.duration || 0,
      status: courseData.status || 'draft',
      prerequisites: courseData.prerequisites || '',
      language: courseData.language || 'English',
      course_type: courseData.course_type || 'regular',
      certificate_enabled: courseData.certificate_enabled !== false,
      is_hidden: courseData.is_hidden || false,
    }));
  }, [courseData, instructors]);

  const loadCategories = async () => {
    const dbCategories = await categoryService.getCategories();
    if (dbCategories && dbCategories.length > 0) {
      const categoryNames = dbCategories.map(c => c.name);
      setCategories(prev => Array.from(new Set([...prev, ...categoryNames])));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await categoryService.addCategory(newCategory.trim());
      setCategories(prev => [...prev, newCategory.trim()]);
      setFormData({ ...formData, category: newCategory.trim() });
      setIsAddingCategory(false);
      setNewCategory('');
    } catch (err) {
      // Fallback for local update if table doesn't exist
      setCategories(prev => [...prev, newCategory.trim()]);
      setFormData({ ...formData, category: newCategory.trim() });
      setIsAddingCategory(false);
      setNewCategory('');
    }
  };

  const [formData, setFormData] = useState({
    title: courseData.title || '',
    description: courseData.description || '',
    instructor: courseData.instructorname || courseData.instructor || '',
    category: courseData.category || 'Programming',
    thumbnail: courseData.thumbnail || '',
    level: (courseData.level || 'beginner').toLowerCase(),
    duration: courseData.duration || 0,
    status: courseData.status || 'draft',
    prerequisites: courseData.prerequisites || '',
    language: courseData.language || 'English',
    course_type: courseData.course_type || 'regular',
    selectedSkillIds: courseData.selectedSkillIds || [],
    certificate_enabled: courseData.certificate_enabled !== false,
    is_hidden: courseData.is_hidden || false,
  });

  useEffect(() => {
    // Update formData when courseData changes, including selectedSkillIds
    setFormData(prev => ({
      ...prev,
      selectedSkillIds: courseData.selectedSkillIds || [],
    }));
  }, [courseData.selectedSkillIds]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newFormData;
    if (name === 'duration') {
      newFormData = { ...formData, [name]: parseFloat(value) || 0 };
    } else {
      newFormData = { ...formData, [name]: value };
    }
    setFormData(newFormData);
    if (onChange) {
      onChange(newFormData);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('CourseDetailsForm submit - formData with skills:', formData);
    console.log('Selected skill IDs being submitted:', formData.selectedSkillIds);
    onComplete(formData);
  };

  const filteredInstructors = instructors.filter(instructor =>
    instructor.fullname.toLowerCase().includes(instructorSearch.toLowerCase()) ||
    instructor.email.toLowerCase().includes(instructorSearch.toLowerCase())
  );

  const handleSelectInstructor = (instructor: any) => {
    setFormData({ ...formData, instructor: instructor.fullname });
    setInstructorSearch('');
    setShowInstructorDropdown(false);
    if (onChange) {
      onChange({ ...formData, instructor: instructor.fullname });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-bold text-gray-900 mb-2">{isEditing ? 'Edit Course Details' : 'Course Details'}</h2>
        <p className="text-gray-600">{isEditing ? 'Update the metadata for your course.' : 'Enter the metadata for your new course.'}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-8 rounded-xl border border-gray-200">
        <div>
          <label className="block text-gray-900 text-base font-medium mb-2">
            Course Title
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Introduction to Digital Marketing"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
            required
          />
        </div>

        <div>
          <label className="block text-gray-900 text-base font-medium mb-2">
            Course Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Provide a detailed summary of the course content and learning objectives."
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition resize-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-gray-900 text-base font-medium mb-2">
              Instructor Name for Course
            </label>
            {useCustomInstructor ? (
              <div className="space-y-2">
                <input
                  type="text"
                  name="instructor"
                  value={formData.instructor}
                  onChange={handleChange}
                  placeholder="Enter custom instructor name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomInstructor(false);
                    setFormData({ ...formData, instructor: '' });
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select from instructors list
                </button>
              </div>
            ) : (
              <div className="space-y-2 relative">
                <div className="relative">
                  <input
                    type="text"
                    value={instructorSearch}
                    onChange={(e) => setInstructorSearch(e.target.value)}
                    onFocus={() => setShowInstructorDropdown(true)}
                    placeholder="Search instructors by name or email..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  />
                  {instructorSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setInstructorSearch('');
                        setShowInstructorDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <span className="material-symbols-rounded text-sm">close</span>
                    </button>
                  )}
                </div>

                {showInstructorDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-56 overflow-y-auto">
                    {filteredInstructors.length === 0 ? (
                      <div className="p-3 text-gray-500 text-sm">
                        {instructorSearch ? 'No instructors found' : 'No instructors available'}
                      </div>
                    ) : (
                      filteredInstructors.map(instructor => (
                        <button
                          key={instructor.id}
                          type="button"
                          onClick={() => handleSelectInstructor(instructor)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                        >
                          <p className="font-medium text-gray-900">{instructor.fullname}</p>
                          <p className="text-xs text-gray-500">{instructor.email}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {formData.instructor && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="text-sm font-medium text-blue-900">{formData.instructor}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setUseCustomInstructor(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Use custom name instead
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Select from your organization's instructors or enter a custom name
            </p>
          </div>

          <div>
            <label className="block text-gray-900 text-base font-medium mb-2">
              Category
            </label>
            {isAddingCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter new category"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
                  title="Add new category"
                >
                  <span className="material-symbols-outlined text-gray-700">add</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-gray-900 text-base font-medium mb-2">
              Level
            </label>
            <select
              name="level"
              value={formData.level}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-gray-900 text-base font-medium">
                Duration <span className="text-red-500">*</span> <span className="text-xs text-gray-500">(minutes)</span>
              </label>
              {calculatedDuration !== null && (
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                  Calculated: {durationService.formatDurationForDisplay(calculatedDuration)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                placeholder="e.g., 120"
                min="0"
                step="1"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              />
              {calculatedDuration !== null && calculatedDuration > 0 && calculatedDuration !== formData.duration && (
                <button
                  type="button"
                  onClick={() => {
                    const newFormData = { ...formData, duration: calculatedDuration };
                    setFormData(newFormData);
                    if (onChange) {
                      onChange(newFormData);
                    }
                  }}
                  className="px-4 py-3 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition text-sm whitespace-nowrap"
                >
                  Use Calculated
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {calculatedDuration !== null
                ? `Auto-calculated from all modules and lessons (${durationService.formatDurationForDisplay(calculatedDuration)})`
                : 'Enter total course duration in minutes (e.g., 90 for 90 minutes)'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-gray-900 text-base font-medium mb-2">
              Course Language
            </label>
            <select
              name="language"
              value={formData.language}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Chinese">Chinese</option>
              <option value="Japanese">Japanese</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-900 text-base font-medium mb-2">
              Course Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
            >
              <option value="draft">Draft (Not published)</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        {/* Course Type */}
        <div>
          <label className="block text-gray-900 text-base font-medium mb-3">
            Course Type
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: 'regular', icon: 'school', label: 'Regular Course', desc: 'Standard learning course with lessons, quizzes and assignments.' },
              { value: 'policy', icon: 'policy', label: 'Policy & Acknowledgement', desc: 'POSH, Code of Conduct, NDA — requires learner to sign and acknowledge.' },
              { value: 'compliance', icon: 'verified_user', label: 'Compliance Training', desc: 'Mandatory compliance course with tracked completion.' },
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.course_type === opt.value
                  ? opt.value === 'policy'
                    ? 'border-orange-500 bg-orange-50'
                    : opt.value === 'compliance'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <input
                  type="radio"
                  name="course_type"
                  value={opt.value}
                  checked={formData.course_type === opt.value}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-xl ${formData.course_type === opt.value
                    ? opt.value === 'policy' ? 'text-orange-600' : opt.value === 'compliance' ? 'text-blue-600' : 'text-primary'
                    : 'text-gray-600'
                    }`}>{opt.icon}</span>
                  <span className={`font-semibold text-sm ${formData.course_type === opt.value ? 'text-gray-900' : 'text-gray-700'}`}>{opt.label}</span>
                  {formData.course_type === opt.value && <span className="ml-auto material-symbols-outlined text-green-500 text-base">check_circle</span>}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
              </label>
            ))}
          </div>
          {{
            policy: (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-lg border bg-orange-50 border-orange-200 text-orange-700 text-xs">
                <span className="material-symbols-outlined text-sm flex-shrink-0">info</span>
                <span>Add an <strong>Acknowledgement</strong> block in each lesson — learner must read, check the box and sign to complete.</span>
              </div>
            ),
            compliance: (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 text-xs">
                <span className="material-symbols-outlined text-sm flex-shrink-0">verified_user</span>
                <span>All lessons are mandatory — completion is fully tracked and reported.</span>
              </div>
            ),
            regular: (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-lg border bg-gray-50 border-gray-200 text-gray-500 text-xs">
                <span className="material-symbols-outlined text-sm flex-shrink-0">school</span>
                <span>Standard course — learners progress through modules with lessons, quizzes and flashcards.</span>
              </div>
            ),
          }[formData.course_type as 'policy' | 'compliance' | 'regular'] ?? null}
        </div>

        <div>
          <label className="block text-gray-900 text-base font-medium mb-2">
            Prerequisites
          </label>
          <textarea
            name="prerequisites"
            value={formData.prerequisites}
            onChange={handleChange}
            placeholder="List any prerequisites for this course (optional)"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Describe what knowledge or skills students should have before taking this course
          </p>
        </div>

        <div>
          <label className="block text-gray-900 text-base font-medium mb-4">
            Course Thumbnail
          </label>
          <div className="flex items-center gap-6">
            {formData.thumbnail && (
              <div
                className="w-48 h-28 rounded-lg bg-cover bg-center flex-shrink-0"
                style={{ backgroundImage: `url(${formData.thumbnail})` }}
              />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <span className="material-symbols-outlined text-4xl text-gray-500">cloud_upload</span>
                    <p className="mb-2 text-sm text-gray-600">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">SVG, PNG, JPG, GIF or WEBP (MAX. 800x400px)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.webp"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setFormData({ ...formData, thumbnail: event.target?.result as string });
                        };
                        reader.readAsDataURL(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="block text-gray-900 text-base font-medium mb-4">
            Course Skills
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Select which skills students will acquire by taking this course. You can create new skills, add new skill families, or use AI to generate skill recommendations.
          </p>
          <CourseSkillSelector
            courseTitle={formData.title}
            courseDescription={formData.description}
            courseCategory={formData.category}
            courseLevel={formData.level}
            selectedSkillIds={formData.selectedSkillIds}
            onSkillsChange={(skillIds) => {
              console.log('CourseDetailsForm: Skills changed to:', skillIds);
              const updatedFormData = { ...formData, selectedSkillIds: skillIds };
              setFormData(updatedFormData);
              if (onChange) {
                onChange(updatedFormData);
              }
            }}
          />
        </div>

        {/* Certificate Generation Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-2xl ${formData.certificate_enabled ? 'text-amber-500' : 'text-gray-400'}`}>
              workspace_premium
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Certificate on Completion</p>
              <p className="text-xs text-gray-500">
                {formData.certificate_enabled
                  ? 'Learners will receive a certificate when they complete this course.'
                  : 'No certificate will be issued for this course.'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={formData.certificate_enabled}
              onChange={(e) => {
                const updated = { ...formData, certificate_enabled: e.target.checked };
                setFormData(updated);
                if (onChange) onChange(updated);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-amber-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {/* Hide Course from Public Catalog Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-2xl ${formData.is_hidden ? 'text-red-500' : 'text-gray-400'}`}>
              visibility_off
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Hide from Public Catalog</p>
              <p className="text-xs text-gray-500">
                {formData.is_hidden
                  ? 'This course is hidden. Only enrolled learners can access it.'
                  : 'This course is visible in the public catalog.'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={formData.is_hidden}
              onChange={(e) => {
                const updated = { ...formData, is_hidden: e.target.checked };
                setFormData(updated);
                if (onChange) onChange(updated);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-red-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Save & Next
            <span className="material-symbols-outlined text-lg text-white">arrow_forward</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default CourseDetailsForm;
