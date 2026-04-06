import React from 'react';
import { durationService } from '../lib/durationService';

interface CourseReviewProps {
  courseData: any;
  onPublish: () => void;
  onBack: () => void;
  isEditing?: boolean;
}

const CourseReview: React.FC<CourseReviewProps> = ({ courseData, onPublish, onBack, isEditing }) => {

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-bold text-gray-900 mb-2">Review & Publish</h2>
        <p className="text-gray-600">Review your course details before publishing.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Course Information
            </h3>
            {courseData.thumbnail && (
              <div
                className="w-full h-48 rounded-lg bg-cover bg-center mb-6"
                style={{ backgroundImage: `url(${courseData.thumbnail})` }}
              />
            )}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Title
                </p>
                <p className="text-xl font-bold text-gray-900">{courseData.title}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Description
                </p>
                <p className="text-gray-700 leading-relaxed">{courseData.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Instructor
                  </p>
                  <p className="text-gray-900 font-medium">{courseData.instructorname}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Category
                  </p>
                  <p className="text-gray-900 font-medium">{courseData.category}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Duration
                  </p>
                  <p className="text-gray-900 font-medium">
                    {courseData.duration && courseData.duration > 0
                      ? durationService.formatDurationForDisplay(courseData.duration)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${courseData.status === 'published'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {courseData.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pb-8 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Course Structure
            </h3>
            <div className="space-y-4">
              {courseData.modules && courseData.modules.length > 0 ? (
                courseData.modules.map((module: any, idx: number) => (
                  <div key={module.id} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Module {idx + 1}: {module.title}
                    </h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      {module.lessons && module.lessons.length > 0 ? (
                        module.lessons.map((lesson: any) => (
                          <div key={lesson.id} className="flex items-center gap-2 ml-4">
                            <span className="material-symbols-outlined text-sm text-gray-500">
                              {lesson.type === 'text'
                                ? 'description'
                                : lesson.type === 'video'
                                  ? 'videocam'
                                  : lesson.type === 'pdf'
                                    ? 'picture_as_pdf'
                                    : 'quiz'}
                            </span>
                            <span>{lesson.title}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500 italic ml-4">No lessons added yet</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-600">No modules added yet</p>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-blue-600 flex-shrink-0">info</span>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">{isEditing ? 'Save your changes?' : 'Ready to publish?'}</h4>
                <p className="text-sm text-blue-800">
                  {isEditing
                    ? 'Your changes will be saved and updated across the platform.'
                    : 'Your course is ready to be published and made available to learners. You can continue to edit it after publishing.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-3 border-t border-gray-200 pt-6">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Back
          </button>
          <button
            onClick={onPublish}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-lg text-white">
              {courseData.status === 'published' ? 'check_circle' : 'save'}
            </span>
            {isEditing
              ? 'Save Changes'
              : courseData.status === 'published'
                ? 'Publish Course'
                : 'Save as Draft'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseReview;
