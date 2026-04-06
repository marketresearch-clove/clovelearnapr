import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { calendarService, CalendarEvent } from '../lib/calendarService';
import { enrollmentService } from '../lib/enrollmentService';
import { courseService } from '../lib/courseService';
import { lessonService } from '../lib/lessonService';

const CalenderPage: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDate, setActiveDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  // Goal Setting State
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [timeSlot, setTimeSlot] = useState('09:00');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchEvents();
      fetchEnrolledCourses();
      fetchCompletedLessons();
    }
  }, [user?.id, currentDate]);

  const fetchCompletedLessons = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('lesson_progress')
        .select('lessonid')
        .eq('userid', user.id)
        .eq('completed', true);

      if (data) {
        setCompletedLessons(new Set(data.map(l => l.lessonid)));
      }
    } catch (error) {
      console.error('Error fetching completed lessons:', error);
    }
  };

  useEffect(() => {
    // Filter events for active date
    const activeDateStr = activeDate.toDateString();
    const filtered = events.filter(e => new Date(e.startDate).toDateString() === activeDateStr);
    setDayEvents(filtered);
  }, [activeDate, events]);

  const fetchEvents = async () => {
    if (!user?.id) return;
    // Fetch events for current month view (plus some buffer)
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();
    const data = await calendarService.getEvents(user.id, start, end);
    setEvents(data);
  };

  const fetchEnrolledCourses = async () => {
    if (!user?.id) return;
    const enrollments = await enrollmentService.getUserEnrollments(user.id);
    // Fetch course details for each enrollment
    const courses = await Promise.all(enrollments.map(async (e: any) => {
      const course = await courseService.getCourseById(e.courseid);
      return { ...course, enrollment: e };
    }));
    setEnrolledCourses(courses.filter(c => c));
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    setActiveDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  };

  const handleGenerateSchedule = async () => {
    if (!user?.id || !selectedCourseId) return;
    setIsGenerating(true);
    try {
      // 1. Get Lessons
      const lessons = await lessonService.getLessonsByCourseId(selectedCourseId);
      if (!lessons || lessons.length === 0) {
        alert('No lessons found for this course.');
        setIsGenerating(false);
        return;
      }

      // 2. Get Course Title
      const course = enrolledCourses.find(c => c.id === selectedCourseId);
      const courseTitle = course?.title || 'Course';

      // 3. Generate Events
      let currentLessonIndex = 0;
      // Start from tomorrow or today if time hasn't passed? Let's start tomorrow to be safe
      let scheduleDate = new Date();
      scheduleDate.setDate(scheduleDate.getDate() + 1);
      scheduleDate.setHours(0, 0, 0, 0);

      const newEvents = [];

      // Limit to 60 days to prevent infinite loops or huge schedules
      let daysCount = 0;
      while (currentLessonIndex < lessons.length && daysCount < 60) {
        // Check if day is selected
        if (selectedDays.includes(scheduleDate.getDay())) {
          let minutesScheduled = 0;
          const lessonsForToday = [];

          while (minutesScheduled < dailyMinutes && currentLessonIndex < lessons.length) {
            const lesson = lessons[currentLessonIndex];
            // Default duration 30 mins if not specified
            const duration = lesson.duration || 30;

            // If adding this lesson exceeds daily limit significantly (e.g. > 15 mins over), stop
            // Unless it's the first lesson of the day
            if (minutesScheduled + duration > dailyMinutes + 15 && lessonsForToday.length > 0) {
              break;
            }

            lessonsForToday.push(lesson);
            minutesScheduled += duration;
            currentLessonIndex++;
          }

          if (lessonsForToday.length > 0) {
            // Create Event
            const [hours, minutes] = timeSlot.split(':').map(Number);
            const startDateTime = new Date(scheduleDate);
            startDateTime.setHours(hours, minutes, 0, 0);

            const endDateTime = new Date(startDateTime.getTime() + minutesScheduled * 60000);

            newEvents.push({
              userId: user.id,
              courseId: selectedCourseId,
              lessonId: lessonsForToday[0].id, // Link to first lesson
              title: `Study: ${courseTitle}`,
              description: `Covering: ${lessonsForToday.map(l => l.title).join(', ')}`,
              eventType: 'class',
              startDate: startDateTime.toISOString(),
              endDate: endDateTime.toISOString(),
              isAllDay: false
            });
          }
        }
        // Next day
        scheduleDate.setDate(scheduleDate.getDate() + 1);
        daysCount++;
      }

      // 4. Save Events
      // Ideally batch insert, but supabase client might not support it easily in the service wrapper
      // Let's do Promise.all
      await Promise.all(newEvents.map(e => calendarService.createEvent(e as any)));

      // 5. Refresh
      await fetchEvents();
      setShowGoalModal(false);
      alert('Study schedule generated successfully!');

    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate schedule.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleDaySelection = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const daysOfWeek = [
    { label: 'S', name: 'Sunday' },
    { label: 'M', name: 'Monday' },
    { label: 'T', name: 'Tuesday' },
    { label: 'W', name: 'Wednesday' },
    { label: 'T', name: 'Thursday' },
    { label: 'F', name: 'Friday' },
    { label: 'S', name: 'Saturday' },
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayOfMonth = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="h-12 w-full"></div>);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
    const isActive = activeDate.toDateString() === dayDate.toDateString();
    const dayDateStr = dayDate.toDateString();
    const hasEvent = events.some(e => new Date(e.startDate).toDateString() === dayDateStr);

    calendarDays.push(
      <button key={i} onClick={() => handleDateClick(i)} className={`h-12 w-full text-sm font-medium leading-normal relative ${isActive ? 'text-white' : 'text-gray-800'}`}>
        <div className={`flex size-full items-center justify-center rounded-full ${isActive ? 'bg-[#4f46e5]' : ''}`}>
          {i}
        </div>
        {hasEvent && !isActive && (
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[#4f46e5] rounded-full"></div>
        )}
      </button>
    );
  }

  return (
    <div className="w-full relative">
      {/* Goal Setting Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Set New Study Goal</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4f46e5] focus:border-[#4f46e5]"
                >
                  <option value="">-- Select a course --</option>
                  {enrolledCourses.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Learning Time (minutes)</label>
                <input
                  type="number"
                  value={dailyMinutes}
                  onChange={(e) => setDailyMinutes(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4f46e5] focus:border-[#4f46e5]"
                  min="15"
                  step="15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Study Days</label>
                <div className="flex flex-wrap gap-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleDaySelection(idx)}
                      className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${selectedDays.includes(idx)
                        ? 'bg-[#4f46e5] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time Slot</label>
                <input
                  type="time"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#4f46e5] focus:border-[#4f46e5]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateSchedule}
                disabled={isGenerating || !selectedCourseId}
                className="flex-1 px-4 py-2 text-white bg-[#4f46e5] rounded hover:bg-[#4338ca] font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Schedule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <p className="text-gray-900 text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">My Learning Calendar</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-grow bg-white p-4 sm:p-6 rounded-md border border-gray-200">
          <div className="flex min-w-72 flex-1 flex-col gap-0.5">
            <div className="flex items-center p-1 justify-between">
              <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <span className="material-symbols-outlined text-gray-600">arrow_back_ios</span>
              </button>
              <p className="text-gray-900 text-base font-bold leading-tight flex-1 text-center">
                {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
              </p>
              <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <span className="material-symbols-outlined text-gray-600">arrow_forward_ios</span>
              </button>
            </div>
            <div className="grid grid-cols-7">
              {daysOfWeek.map((day, idx) => (
                <p key={day.name} className="text-gray-600 text-[13px] font-bold leading-normal tracking-[0.015em] flex h-12 w-full items-center justify-center pb-0.5">{day.label}</p>
              ))}
              {calendarDays}
            </div>
          </div>
        </div>
        <aside className="w-full lg:w-96 flex-shrink-0 bg-white p-4 sm:p-6 rounded-md border border-gray-200">
          <div className="flex flex-col gap-6 h-full">
            <h2 className="text-gray-900 text-[22px] font-bold leading-tight tracking-[-0.015em]">
              {activeDate.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <div className="flex flex-col gap-4">
              <h3 className="text-gray-900 text-lg font-bold leading-tight tracking-[-0.015em]">Daily Goals</h3>
              <div className="flex flex-col gap-3">
                {dayEvents.length > 0 ? (
                  dayEvents.map(event => {
                    const isCompleted = event.lessonId && completedLessons.has(event.lessonId);
                    return (
                      <div key={event.id} className={`flex items-start gap-3 p-3 rounded ${isCompleted ? 'bg-green-50 border border-green-100' : 'bg-[#4f46e5]/10'}`}>
                        <span className={`material-symbols-outlined text-xl mt-0.5 ${isCompleted ? 'text-green-600' : 'text-[#4f46e5]'}`}>
                          {isCompleted ? 'check_circle' : 'event'}
                        </span>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isCompleted ? 'text-green-800' : 'text-gray-900'}`}>
                            {event.title}
                          </p>
                          {event.description && (
                            <p className={`text-xs mt-1 ${isCompleted ? 'text-green-600' : 'text-gray-600'}`}>{event.description}</p>
                          )}
                          <p className={`text-xs mt-1 font-medium ${isCompleted ? 'text-green-600' : 'text-[#4f46e5]'}`}>
                            {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {event.endDate && new Date(event.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-sm italic">No goals set for this day.</p>
                )}
              </div>
              <button
                onClick={() => setShowGoalModal(true)}
                className="mt-2 flex max-w-full cursor-pointer items-center justify-center overflow-hidden rounded h-10 bg-[#4f46e5]/10 text-[#4f46e5] gap-2 text-sm font-bold leading-normal tracking-[0.015em] min-w-0 px-4 hover:bg-[#4f46e5]/20 transition-colors"
              >
                <span className="material-symbols-outlined">add_circle</span>
                <span>Set a New Goal</span>
              </button>
            </div>
            <div className="border-t border-gray-200"></div>
            <div className="flex flex-col gap-4">
              <h3 className="text-gray-900 text-lg font-bold leading-tight tracking-[-0.015em]">Scheduled Modules</h3>
              <div className="flex flex-col gap-4">
                {dayEvents.filter(e => e.courseId).length > 0 ? (
                  dayEvents.filter(e => e.courseId).map(event => {
                    const isCompleted = event.lessonId && completedLessons.has(event.lessonId);
                    return (
                      <Link key={event.id} to={`/course/${event.courseId}`} className="flex gap-4 items-start p-2 rounded hover:bg-gray-50 transition-colors">
                        <div className={`flex-shrink-0 size-10 rounded flex items-center justify-center ${isCompleted ? 'bg-green-100' : 'bg-[#F8B400]/20'}`}>
                          <span className={`material-symbols-outlined ${isCompleted ? 'text-green-600' : 'text-[#F8B400]'}`}>
                            {isCompleted ? 'check_circle' : 'smart_display'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{event.title}</p>
                          <p className="text-gray-600 text-sm">{event.description?.split(':')[1] || 'Scheduled Session'}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-sm italic">No modules scheduled.</p>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200"></div>
            <div className="flex flex-col gap-4">
              <h3 className="text-gray-900 text-lg font-bold leading-tight tracking-[-0.015em]">Upcoming Modules</h3>
              <div className="flex flex-col gap-4">
                {events
                  .filter(e => e.courseId && new Date(e.startDate) > new Date() && new Date(e.startDate).toDateString() !== activeDate.toDateString())
                  .slice(0, 3)
                  .map(event => (
                    <Link key={event.id} to={`/course/${event.courseId}`} className="flex gap-4 items-start p-2 rounded hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0 size-10 rounded bg-blue-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-600">calendar_month</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 font-semibold text-sm">{event.title}</p>
                        <p className="text-gray-500 text-xs mt-1">
                          {new Date(event.startDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </Link>
                  ))}
                {events.filter(e => e.courseId && new Date(e.startDate) > new Date()).length === 0 && (
                  <p className="text-gray-500 text-sm italic">No upcoming modules.</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CalenderPage;