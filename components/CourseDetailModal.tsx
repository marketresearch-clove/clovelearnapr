import React from 'react';
import { useNavigate } from 'react-router-dom';
import PdfViewer from './PdfViewer';
import { supabase } from '../lib/supabaseClient';

const CourseDetailModal: React.FC<{ onClose: () => void; courseId?: string }> = ({ onClose, courseId }) => {
  const navigate = useNavigate();
  const [course, setCourse] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (error) throw error;
      setCourse(data);
    } catch (err) {
      console.error('Error loading course for modal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (path: string) => {
    onClose();
    navigate(path);
  };

  if (!courseId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden relative animate-slide-up flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-200 shrink-0">
          <h2 className="text-2xl font-bold text-slate-800">{loading ? 'Loading...' : course?.title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <span className="material-symbols-rounded text-slate-500">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {/* Thumbnail */}
              {course?.thumbnail && (
                <div className="mb-8 rounded-2xl overflow-hidden border border-slate-200 shadow-md">
                  <img
                    src={course.thumbnail}
                    alt={course?.title}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150"%3E%3Crect fill="%23e2e8f0" width="400" height="150"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="16" fill="%2364748b" text-anchor="middle" dominant-baseline="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-amber-500 text-white p-4 rounded-xl">
                  <div className="text-sm opacity-80 font-bold uppercase tracking-wider">Course Category</div>
                  <div className="text-3xl font-bold mt-1">{course?.category}</div>
                </div>
                <div className="bg-indigo-500 text-white p-4 rounded-xl">
                  <div className="text-sm opacity-80 font-bold uppercase tracking-wider">Duration</div>
                  <div className="text-3xl font-bold mt-1">{course?.duration} <span className="text-xl">mins</span></div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Description</h3>
                <div className="text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  {course?.description || 'No description available for this course.'}
                </div>
              </div>

              {/* Action */}
              <div className="flex justify-center">
                <button
                  onClick={() => handleNavigation(`/course/${course.id}`)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center gap-3"
                >
                  <span className="material-symbols-rounded">play_circle</span>
                  Enter Course Dashboard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseDetailModal;