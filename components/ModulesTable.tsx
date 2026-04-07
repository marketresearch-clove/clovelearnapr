import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ModuleStat {
  moduleid: string;
  module_name: string;
  description: string;
  courseid?: string;
  course_name?: string;
  category?: string;
  total_users_enrolled: number;
  users_completed: number;
  avg_completion_percentage: number;
  total_module_hours: number;
  avg_hours_per_user: number;
  last_completion_date: string;
  completed_by_users: number;
}

const ModulesTable: React.FC = () => {
  const [modules, setModules] = useState<ModuleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'completion' | 'enrolled' | 'hours' | 'name'>('completion');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchModules();

    // Subscribe to changes
    const subscription = supabase
      .channel('public:module_learning_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'module_learning_stats' }, () => {
        fetchModules();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('module_learning_stats_summary')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        console.log('✅ Modules loaded:', data.length, 'modules');
        console.log('📊 Sample module data:', data[0]);
        console.log('🏷️ Available courses:', new Set(data.map(m => m.course_name).filter(Boolean)));
        console.log('📑 Available categories:', new Set(data.map(m => m.category).filter(Boolean)));
      }

      setModules(data || []);
    } catch (error) {
      console.error('❌ Error fetching module stats:', error);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique courses
  const courses = useMemo(() => {
    const courseSet = new Set(
      modules
        .map(m => m.course_name?.trim())
        .filter(Boolean)
    );
    return Array.from(courseSet).sort();
  }, [modules]);

  // Get unique categories
  const categories = useMemo(() => {
    const categorySet = new Set(
      modules
        .map(m => m.category?.trim())
        .filter(Boolean)
    );
    return Array.from(categorySet).sort();
  }, [modules]);

  // Sort and filter modules
  const filteredAndSortedModules = useMemo(() => {
    let filtered = modules.filter(module => {
      const matchesSearch = (module.module_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (module.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      const moduleCourse = (module.course_name || '').trim();
      const moduleCategory = (module.category || '').trim();
      const matchesCourse = !selectedCourse || selectedCourse === 'all' || moduleCourse === selectedCourse;
      const matchesCategory = !selectedCategory || selectedCategory === 'all' || moduleCategory === selectedCategory;

      return matchesSearch && matchesCourse && matchesCategory;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'enrolled':
          return (b.total_users_enrolled || 0) - (a.total_users_enrolled || 0);
        case 'completion':
          return (b.avg_completion_percentage || 0) - (a.avg_completion_percentage || 0);
        case 'hours':
          return (b.total_module_hours || 0) - (a.total_module_hours || 0);
        case 'name':
          return (a.module_name || '').localeCompare(b.module_name || '');
        default:
          return 0;
      }
    });
  }, [modules, sortBy, searchQuery, selectedCourse, selectedCategory]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600">Loading module data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 relative min-w-0">
          <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Search by module name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
          />
        </div>

        {/* Course Filter */}
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-4 py-2 pr-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-gray-700"
        >
          <option value="all">All Courses {courses.length > 0 ? `(${courses.length})` : ''}</option>
          {courses.length > 0 ? (
            courses.map((course) => (
              <option key={course} value={course}>{course}</option>
            ))
          ) : (
            <option disabled>No courses available</option>
          )}
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 pr-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-gray-700"
        >
          <option value="all">All Categories {categories.length > 0 ? `(${categories.length})` : ''}</option>
          {categories.length > 0 ? (
            categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))
          ) : (
            <option disabled>No categories available</option>
          )}
        </select>

        {/* Metric Filter Controls */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { id: 'completion', label: 'Completion', icon: 'analytics' },
            { id: 'enrolled', label: 'Enrolled', icon: 'group' },
            { id: 'hours', label: 'Hours', icon: 'schedule' },
            { id: 'name', label: 'Name', icon: 'description' }
          ].map((metric: any) => (
            <button
              key={metric.id}
              onClick={() => setSortBy(metric.id as any)}
              className={`px-4 py-2 text-[11px] font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${sortBy === metric.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
              title={`Sort by ${metric.label}`}
            >
              <span className="material-symbols-rounded text-base">{metric.icon}</span>
              <span>{metric.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      {filteredAndSortedModules.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{filteredAndSortedModules.length}</div>
            <div className="text-xs text-gray-600 mt-1">Total Modules</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(filteredAndSortedModules.reduce((sum, m) => sum + (m.avg_completion_percentage || 0), 0) / filteredAndSortedModules.length)}%
            </div>
            <div className="text-xs text-gray-600 mt-1">Avg Completion</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {filteredAndSortedModules.reduce((sum, m) => sum + (m.total_users_enrolled || 0), 0)}
            </div>
            <div className="text-xs text-gray-600 mt-1">Total Enrolled</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(filteredAndSortedModules.reduce((sum, m) => sum + ((m.total_module_hours || 0) / 60), 0))}
            </div>
            <div className="text-xs text-gray-600 mt-1">Total Hours</div>
          </div>
        </div>
      )}

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedModules.length > 0 ? (
          filteredAndSortedModules.map((module) => (
            <div
              key={module.moduleid}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-300"
            >
              {/* Header */}
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 text-sm line-clamp-2">{module.module_name || 'Unknown Module'}</h3>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{module.description || 'No description'}</p>
              </div>

              {/* Completion Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="text-gray-600 font-medium">Completion Rate</span>
                  <span className="text-gray-900 font-bold">{module.avg_completion_percentage || 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-300 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${module.avg_completion_percentage || 0}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-white/50 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary">{module.total_users_enrolled || 0}</div>
                  <div className="text-xs text-gray-600">Enrolled</div>
                </div>
                <div className="border-l border-r border-gray-200 text-center">
                  <div className="text-lg font-bold text-green-600">{module.users_completed || 0}</div>
                  <div className="text-xs text-gray-600">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-500">{Math.round((module.total_module_hours || 0) / 60)} hrs</div>
                  <div className="text-xs text-gray-600">Total Hours</div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Avg. per User</span>
                  <span className="font-bold text-gray-900">{Math.round((module.avg_hours_per_user || 0) / 60)} hrs</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center">
            <span className="material-symbols-rounded text-4xl text-gray-400 block mb-2">school</span>
            <p className="text-gray-600">No modules found matching your search</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModulesTable;
