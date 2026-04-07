import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { courseService } from '../lib/courseService';
import { durationService } from '../lib/durationService';
import { categoryService } from '../lib/categoryService';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { enrollmentService } from '../lib/enrollmentService';
import { getCertificateByUserAndCourse } from '../lib/certificateService';
import Loader from '../components/Loader';

// Lazy Image Component
const LazyImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    return () => observer.disconnect();
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={imageSrc || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="225"%3E%3Crect fill="%23e2e8f0" width="400" height="225"/%3E%3C/svg%3E'}
      alt={alt}
      className={`${className} ${isLoading ? 'blur-sm' : 'blur-0'} transition-[filter] duration-300`}
      onLoad={() => setIsLoading(false)}
    />
  );
};

interface CatalogCourse {
  id: string;
  title: string;
  instructorname: string;
  thumbnail: string;
  category: string;
  averagerating: number;
  duration: number;
  level: string;
  totalstudents: number;
  description?: string;
  status: string;
  isEnrolled?: boolean;
  isCompleted?: boolean;
  progress?: number;
  is_hidden?: boolean;
  certificate_enabled?: boolean;
}

const FilterCheckbox: React.FC<{ label: string; count?: number }> = ({ label, count }) => (
  <label className="flex items-center gap-2 cursor-pointer group">
    <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500 border-slate-300" />
    <span className="text-sm text-slate-600 group-hover:text-slate-900">{label}</span>
    {count && <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{count}</span>}
  </label>
);

const CatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [allCourses, setAllCourses] = useState<CatalogCourse[]>([]);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [expandedFilters, setExpandedFilters] = useState<{ [key: string]: boolean }>({
    categories: false,
    level: false,
  });
  const [itemsPerPage] = useState(12);
  const [displayedCourses, setDisplayedCourses] = useState<CatalogCourse[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const toggleFilterSection = (section: string) => {
    setExpandedFilters(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Initialize with URL parameters
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(decodeURIComponent(categoryParam));
    }
  }, [searchParams]);

  useEffect(() => {
    loadCourses();
  }, [user?.id]);

  const loadCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch courses and categories in parallel
      const [courses, cats] = await Promise.all([
        courseService.getPublishedCourses(),
        categoryService.getCategories()
      ]);
      setCategories(cats);

      let enrollmentMap = new Map<string, any>();
      let hiddenCourseIds = new Set<string>();
      let progressMap = new Map<string, number>();

      // If user is logged in, fetch their enrollment and progress data
      if (user?.id) {
        try {
          // Fetch enrollments and assignments in parallel
          const [enrollments, assignmentsResult, lessonProgressResult] = await Promise.all([
            enrollmentService.getUserEnrollments(user.id),
            supabase
              .from('course_assignments')
              .select('courseid, is_visible')
              .eq('userid', user.id),
            supabase
              .from('lesson_progress')
              .select('courseid, completed')
              .eq('userid', user.id)
          ]);

          // Build enrollment map
          enrollments.forEach((enrollment: any) => {
            enrollmentMap.set(enrollment.courseid, enrollment);
          });

          // Build hidden courses set
          if (assignmentsResult.data) {
            assignmentsResult.data.forEach((assignment: any) => {
              if (assignment.is_visible === false) {
                hiddenCourseIds.add(assignment.courseid);
              }
            });
          }

          // Calculate progress from lesson_progress data
          // We can use enrollment completion status as a shortcut
          enrollments.forEach((enrollment: any) => {
            if (enrollment.completed) {
              progressMap.set(enrollment.courseid, 100);
            }
          });
        } catch (err) {
          console.warn('Error fetching user enrollment data:', err);
        }
      }

      // Map courses - totalstudents already calculated by courseService
      const mappedCourses = (courses as any[]).map((course: any) => {
        const enrollment = enrollmentMap.get(course.id);
        const calculatedProgress = progressMap.get(course.id) || (enrollment?.progress || 0);
        const finalProgress = Math.min(100, calculatedProgress);
        const isCompleted = enrollment?.completed || finalProgress === 100;

        return {
          id: course.id,
          title: course.title,
          instructorname: course.instructorname,
          thumbnail: course.thumbnail || 'https://picsum.photos/400/225?random=default',
          category: course.category,
          averagerating: course.averagerating || 0,
          duration: course.duration || 0,
          level: course.level ? (course.level.charAt(0).toUpperCase() + course.level.slice(1).toLowerCase()) : 'Beginner',
          totalstudents: course.totalstudents || 0, // Already calculated by courseService
          description: course.description,
          status: course.status,
          isEnrolled: !!enrollment,
          isCompleted: isCompleted,
          progress: finalProgress,
          is_hidden: course.is_hidden || false,
          certificate_enabled: course.certificate_enabled ?? false,
        };
      });

      // Filter out hidden courses
      const finalMappedCourses = mappedCourses.filter(course => !hiddenCourseIds.has(course.id));

      setAllCourses(finalMappedCourses);
      setFilteredCourses(finalMappedCourses);
    } catch (err) {
      console.error('Error loading courses:', err);
      setError('Failed to load courses. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = [...allCourses];

    if (searchQuery) {
      result = result.filter(
        (course) =>
          course.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.instructorname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory) {
      result = result.filter((course) => course.category === selectedCategory);
    }

    if (selectedLevels.length > 0) {
      result = result.filter((course) => selectedLevels.includes(course.level));
    }

    if (sortBy === 'popular') {
      result.sort((a, b) => b.totalstudents - a.totalstudents);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.averagerating - a.averagerating);
    } else if (sortBy === 'duration') {
      result.sort((a, b) => a.duration - b.duration);
    }

    setFilteredCourses(result);
    setDisplayedCourses(result.slice(0, itemsPerPage));
    setHasMore(result.length > itemsPerPage);
  }, [searchQuery, selectedCategory, selectedLevels, sortBy, allCourses, itemsPerPage]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMoreCourses();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loading, displayedCourses, filteredCourses, itemsPerPage]);

  const loadMoreCourses = useCallback(() => {
    setDisplayedCourses((prev) => {
      const nextBatch = filteredCourses.slice(prev.length, prev.length + itemsPerPage);
      const updated = [...prev, ...nextBatch];
      setHasMore(updated.length < filteredCourses.length);
      return updated;
    });
  }, [filteredCourses, itemsPerPage]);

  const getCategoryCount = (category: string) => {
    return allCourses.filter((c) => c.category === category).length;
  };

  const getLevelCount = (level: string) => {
    return allCourses.filter((c) => c.level === level).length;
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Filters Sidebar */}
      <aside className="w-full md:w-64 flex-shrink-0 space-y-6">
        {/* Search */}
        <div>
          <h3 className="font-bold text-slate-900 mb-4">Search</h3>
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {/* Categories - Desktop View (visible on md and above) */}
        <div className="hidden md:block">
          <h3 className="font-bold text-slate-900 mb-4">Categories</h3>
          <div className="space-y-2">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedCategory === cat.name}
                  onChange={(e) => setSelectedCategory(e.target.checked ? cat.name : null)}
                  className="rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-900">{cat.name}</span>
                <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {getCategoryCount(cat.name)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Categories - Mobile View (dropdown) */}
        <div className="md:hidden border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleFilterSection('categories')}
            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between font-semibold text-slate-900 transition-colors"
          >
            <span>Categories</span>
            <span className={`material-symbols-rounded text-lg transition-transform ${expandedFilters.categories ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          {expandedFilters.categories && (
            <div className="px-4 py-3 space-y-2 bg-white border-t border-slate-200">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedCategory === cat.name}
                    onChange={(e) => setSelectedCategory(e.target.checked ? cat.name : null)}
                    className="rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 flex-1">{cat.name}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {getCategoryCount(cat.name)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Level - Desktop View (visible on md and above) */}
        <div className="hidden md:block">
          <h3 className="font-bold text-slate-900 mb-4">Level</h3>
          <div className="space-y-2">
            {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
              <label key={level} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedLevels.includes(level)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLevels([...selectedLevels, level]);
                    } else {
                      setSelectedLevels(selectedLevels.filter(l => l !== level));
                    }
                  }}
                  className="rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-900">{level}</span>
                <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {getLevelCount(level)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Level - Mobile View (dropdown) */}
        <div className="md:hidden border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleFilterSection('level')}
            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between font-semibold text-slate-900 transition-colors"
          >
            <span>Level</span>
            <span className={`material-symbols-rounded text-lg transition-transform ${expandedFilters.level ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          {expandedFilters.level && (
            <div className="px-4 py-3 space-y-2 bg-white border-t border-slate-200">
              {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedLevels.includes(level)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLevels([...selectedLevels, level]);
                      } else {
                        setSelectedLevels(selectedLevels.filter(l => l !== level));
                      }
                    }}
                    className="rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 flex-1">{level}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {getLevelCount(level)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Explore Courses</h1>
            <p className="text-sm text-slate-500 mt-1">{filteredCourses.length} courses available</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="popular">Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="duration">Duration</option>
            </select>
          </div>
        </div>

        {loading ? (
          <Loader size="lg" message="Loading courses..." containerPadding="py-12" />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded p-6 text-center">
            <p className="text-red-600 font-medium mb-2">Unable to Load Courses</p>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button
              onClick={loadCourses}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <span className="material-symbols-rounded text-6xl text-slate-300 block mb-4">
                search_off
              </span>
              <p className="text-slate-600 font-medium mb-2">No courses found</p>
              <p className="text-slate-500 text-sm">Try adjusting your filters or search query</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayedCourses.map((course) => (
                <div
                  key={course.id}
                  className="group bg-white rounded-lg border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/course/${course.id}`)}
                >
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300">
                    {course.thumbnail && course.thumbnail !== 'https://picsum.photos/400/225?random=default' ? (
                      <LazyImage
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-rounded text-5xl text-slate-400">
                          school
                        </span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-slate-900 shadow-sm">
                      {course.level}
                    </div>
                    {course.is_hidden && (
                      <div className="absolute top-3 left-24 bg-red-500/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-white shadow-sm flex items-center gap-1">
                        <span className="material-symbols-rounded text-sm">visibility_off</span>
                        Hidden
                      </div>
                    )}
                    {course.isCompleted && course.progress === 100 ? (
                      <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-bold text-white shadow-sm flex items-center gap-1">
                        <span className="material-symbols-rounded text-sm">check_circle</span>
                        Completed
                      </div>
                    ) : course.isEnrolled && course.progress && course.progress > 0 ? (
                      <div className="absolute top-3 right-3 bg-blue-500/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-bold text-white shadow-sm flex items-center gap-1">
                        <span className="material-symbols-rounded text-xs">schedule</span>
                        {course.progress}%
                      </div>
                    ) : null}
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
                        {course.category}
                      </span>
                      <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold">
                        <span className="material-symbols-rounded text-sm">star</span>
                        {typeof course.averagerating === 'number' ? course.averagerating.toFixed(1) : '0.0'}
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                      {course.title}
                    </h3>

                    <p className="text-sm text-slate-500 mb-4">by {course.instructorname}</p>

                    <div className="mt-auto pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-rounded text-base">schedule</span>
                          {course.duration > 0 ? durationService.formatDurationForDisplay(course.duration) : 'N/A'}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-rounded text-base">people</span>
                          {course.totalstudents} learners
                        </div>
                      </div>

                      {course.isEnrolled && course.progress && course.progress < 100 && (
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium text-slate-600">Progress</span>
                            <span className="text-xs font-semibold text-slate-700">{course.progress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${course.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {course.isCompleted && course.progress === 100 ? (
                        course.certificate_enabled ? (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (user?.id) {
                                const certificateId = await getCertificateByUserAndCourse(user.id, course.id);
                                if (certificateId) {
                                  navigate(`/certificate/${certificateId}`);
                                } else {
                                  console.error('Certificate not found');
                                }
                              }
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-rounded text-sm">workspace_premium</span>
                            View Certificate
                          </button>
                        ) : (
                          <div className="w-full bg-green-50 border border-green-300 text-green-700 px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2">
                            <span className="material-symbols-rounded text-sm">check_circle</span>
                            Completed
                          </div>
                        )
                      ) : course.isEnrolled ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/lesson/${course.id}`);
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-rounded text-sm">play_arrow</span>
                          Continue Learning
                        </button>
                      ) : (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (user?.id) {
                              try {
                                await enrollmentService.enrollCourse(user.id, course.id);
                                loadCourses();
                              } catch (err) {
                                console.error('Error enrolling:', err);
                                alert('Failed to enroll in course');
                              }
                            }
                          }}
                          className="w-full bg-slate-200 hover:bg-slate-300 text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-rounded text-sm">add</span>
                          Enroll Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && <div ref={loadMoreRef} className="py-8 text-center text-slate-500">Loading more courses...</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default CatalogPage;