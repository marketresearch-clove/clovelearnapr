import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const CompletedLearningHoursCard: React.FC = () => {
  const [stats, setStats] = useState<any>({
    totalHours: 0,
    categories: [],
  });
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const colors = ['text-blue-500', 'text-green-500', 'text-indigo-500', 'text-red-500', 'text-yellow-500', 'text-indigo-500'];
  const bgColors = ['bg-blue-500', 'bg-green-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-indigo-500'];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, category')
        .eq('status', 'published');

      if (coursesError) throw coursesError;

      const { data: learningHours, error: hoursError } = await supabase
        .from('learning_hours')
        .select('courseid, hoursspent');

      if (hoursError) throw hoursError;

      const categoryMap = new Map();
      (courses || []).forEach((course: any) => {
        if (!categoryMap.has(course.category)) {
          categoryMap.set(course.category, 0);
        }
      });

      let totalMinutes = 0;
      (learningHours || []).forEach((record: any) => {
        const course = (courses || []).find((c: any) => c.id === record.courseid);
        if (course && categoryMap.has(course.category)) {
          categoryMap.set(course.category, categoryMap.get(course.category) + (record.hoursspent || 0));
          totalMinutes += record.hoursspent || 0;
        }
      });

      const totalHours = Math.round(totalMinutes / 60);
      const categories = Array.from(categoryMap.entries())
        .map(([name, minutes]) => ({
          name,
          hours: Math.round(minutes / 60),
          percent: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5);

      setStats({ totalHours, categories });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const handleMouseEnter = (categoryName: string) => {
    setHoveredSegment(categoryName);
  };

  const handleMouseLeave = () => {
    setHoveredSegment(null);
  };

  const getTooltipContent = (categoryName: string) => {
    const category = stats.categories.find((cat: any) => cat.name === categoryName);
    if (category) {
      return `${category.hours} hrs (${category.percent}%) - ${category.name}`;
    }
    return '';
  };

  const circumference = 2 * Math.PI * 15.9155;
  let offset = 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-800">Completed Learning hrs</h2>
        <span className="material-symbols-rounded text-gray-400 text-base">info</span>
      </div>
      <div className="flex items-center space-x-6">
        <div className="w-1/2">
          <p className="text-sm text-gray-500">by category</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalHours.toLocaleString()} hrs</p>
          <p className="text-sm text-gray-500">total of all skills</p>
          <div className="mt-6 space-y-3">
            {stats.categories.map((cat: any, idx: number) => (
              <div key={cat.name} className="flex items-center text-sm">
                <span className={`w-3 h-3 rounded-full ${bgColors[idx % bgColors.length]} mr-2`}></span>
                <span className="text-gray-600 flex-1">{cat.name}</span>
                <span className="font-medium text-gray-700">{cat.percent}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2 flex justify-center items-center">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path className="stroke-current text-gray-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"></path>
              {stats.categories.map((cat: any, idx: number) => {
                const dasharray = (cat.percent / 100) * circumference;
                const dashOffset = -offset;
                offset += dasharray;
                return (
                  <path
                    key={cat.name}
                    className={`stroke-current ${colors[idx % colors.length]} cursor-pointer transition-all ${hoveredSegment === cat.name ? 'opacity-100' : 'opacity-70'}`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    strokeDasharray={`${dasharray}, ${circumference}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    strokeWidth={hoveredSegment === cat.name ? 4 : 3}
                    onMouseEnter={() => handleMouseEnter(cat.name)}
                    onMouseLeave={handleMouseLeave}
                  ></path>
                );
              })}
            </svg>
            {/* Tooltip */}
            {hoveredSegment && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap mb-2">
                  {getTooltipContent(hoveredSegment)}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex space-x-6 text-xs text-gray-500 mt-4 border-t border-gray-200 pt-4">
        <p>Top category:</p>
        <div className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-gray-400 mr-2"></span>
          <span>{stats.categories[0]?.name || 'N/A'} ({stats.categories[0]?.percent || 0}%)</span>
        </div>
      </div>
    </div>
  );
};

export default CompletedLearningHoursCard;