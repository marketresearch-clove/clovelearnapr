
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CourseDetailModal from '../components/CourseDetailModal';
import { useAuth } from '../contexts/AuthContext';
import { courseAssignmentService } from '../lib/courseAssignmentService';
import { careerPathService } from '../lib/careerPathService';
import { userSkillAchievementService } from '../lib/userSkillAchievementService';
import { learningJourneyService, UserJourneyAssignment, UserJourneyModuleProgress } from '../lib/learningJourneyService';
import { supabase } from '../lib/supabaseClient';
import { skillService } from '../lib/skillService';
import { courseCompletionService } from '../lib/courseCompletionService';
import { externalAssessmentService, ExternalAssessment, UserExternalAssessment, ExternalAssessmentResult } from '../lib/externalAssessmentService';
import { EFSET_BADGES, getEFSETBadge } from '../lib/efsetHelper';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';
import Loader from '../components/Loader';

const MyLearningPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'journey' | 'career' | 'assigned' | 'assessments' | 'certificates' | 'acquired'>('journey');
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<UserExternalAssessment | null>(null);
  const [assessmentRefreshKey, setAssessmentRefreshKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as any;
    if (tab && ['journey', 'career', 'assigned', 'assessments', 'certificates', 'acquired'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  return (
    <div className="min-h-screen font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">My Learning</h1>
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'journey' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('journey')}
          >
            Learning Journey
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'career' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('career')}
          >
            Career Path
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'assigned' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('assigned')}
          >
            Assigned Courses
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'assessments' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('assessments')}
          >
            Assessments
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'acquired' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('acquired')}
          >
            Acquired Skills
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'certificates' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('certificates')}
          >
            <span className="material-symbols-rounded text-lg">workspace_premium</span>
            My Certificates
          </button>
        </div>
      </header>

      <main>
        {activeTab === 'journey' ? (
          <LearningJourneyTab onSkillClick={() => setShowSkillModal(true)} onCourseClick={() => setShowCourseModal(true)} />
        ) : activeTab === 'career' ? (
          <CareerPathTab setActiveTab={setActiveTab} />
        ) : activeTab === 'assigned' ? (
          <AssignedCoursesTab setActiveTab={setActiveTab} />
        ) : activeTab === 'assessments' ? (
          <AssessmentsTab
            key={assessmentRefreshKey}
            onSelectAssessment={(a) => {
              setSelectedAssessment(a);
              setShowAssessmentModal(true);
            }}
          />
        ) : activeTab === 'acquired' ? (
          <AcquiredSkillsTab />
        ) : (
          <MyCertificatesTab />
        )}
      </main>

      {/* Skill Modal */}
      {showSkillModal && (
        <SkillDetailModal onClose={() => setShowSkillModal(false)} />
      )}

      {/* Course Detail Modal */}
      {showCourseModal && (
        <CourseDetailModal onClose={() => setShowCourseModal(false)} />
      )}

      {/* Assessment Detail Modal */}
      {showAssessmentModal && selectedAssessment && (
        <AssessmentLaunchModal
          assignment={selectedAssessment}
          onClose={() => {
            setShowAssessmentModal(false);
            setSelectedAssessment(null);
          }}
          onRefresh={() => {
            setAssessmentRefreshKey(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
};

const LearningJourneyTab: React.FC<{ onSkillClick: () => void; onCourseClick: () => void; }> = ({ onSkillClick, onCourseClick }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<any[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadJourneys();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedJourneyId) {
      loadModules(selectedJourneyId);
    }
  }, [selectedJourneyId]);

  const loadJourneys = async () => {
    try {
      setLoading(true);
      const userJourneys = await learningJourneyService.getUserJourneys(user!.id);
      setJourneys(userJourneys);
      if (userJourneys.length > 0) {
        setSelectedJourneyId(userJourneys[0].id);
      }
    } catch (error) {
      console.error('Error loading journeys:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async (assignmentId: string) => {
    try {
      const progress = await learningJourneyService.getUserJourneyProgress(assignmentId);

      // Check for completed courses and update status if needed
      const updatedProgress = await Promise.all(progress.map(async (item, index) => {
        let currentStatus = item.status;

        // Auto-complete course if enrolled and 100% progress
        if (item.module.type === 'Course' && item.module.course_id && currentStatus !== 'completed') {
          const { data: enrollment } = await supabase
            .from('enrollments')
            .select('completed, progress')
            .eq('userid', user!.id)
            .eq('courseid', item.module.course_id)
            .maybeSingle();

          const isCompleted = enrollment?.completed || (enrollment?.progress || 0) >= 100;

          if (isCompleted) {
            if (!enrollment?.completed) {
              courseCompletionService.markCourseAsCompleted(user!.id, item.module.course_id)
                .catch(err => console.error('Error auto-completing course in journey:', err));
            }
            await learningJourneyService.updateModuleStatus(item.id, 'completed');
            currentStatus = 'completed';
          }
        }

        // Auto-unlock if date passed or previous completed
        if (currentStatus === 'locked') {
          const now = new Date();
          const unlockDate = item.unlock_date ? new Date(item.unlock_date) : null;

          const prevModuleCompleted = index === 0 || progress[index - 1].status === 'completed';
          const datePassed = !unlockDate || unlockDate <= now;

          if (prevModuleCompleted && datePassed) {
            await learningJourneyService.updateModuleStatus(item.id, 'unlocked');
            currentStatus = 'unlocked';
          }
        }

        return { ...item, status: currentStatus };
      }));

      setModules(updatedProgress);

      // Calculate and update journey progress locally
      const totalModules = updatedProgress.length;
      const completedModules = updatedProgress.filter(m => m.status === 'completed').length;
      const newProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

      // Recalculate and update journey status in database
      try {
        await learningJourneyService.recalculateAssignmentProgress(assignmentId);
      } catch (err) {
        console.error('Error recalculating assignment progress:', err);
      }

      // Reload journeys to reflect updated status
      await loadJourneys();

    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const handleStartJourney = async (journeyAssignmentId: string) => {
    try {
      await learningJourneyService.startJourney(journeyAssignmentId);
      // Reload the journeys to reflect the updated status
      await loadJourneys();
      // Also reload modules to update the timeline view
      if (selectedJourneyId === journeyAssignmentId) {
        await loadModules(journeyAssignmentId);
      }
    } catch (error) {
      console.error('Error starting journey:', error);
      alert('Failed to start the learning journey. Please try again.');
    }
  };

  const handleModuleClick = async (item: any) => {
    if (item.status === 'locked') {
      alert('This module is currently locked.');
      return;
    }

    if (item.module.type === 'Course' && item.module.course_id) {
      navigate(`/course/${item.module.course_id}`);
    } else {
      // For other types, maybe mark as complete or show details
      // For now, let's just toggle completion for demo purposes if it's not a course
      if (item.status !== 'completed') {
        const confirmComplete = window.confirm(`Mark "${item.module.title}" as completed?`);
        if (confirmComplete) {
          await learningJourneyService.updateModuleStatus(item.id, 'completed');
          loadModules(selectedJourneyId!);
        }
      }
    }
  };

  const selectedJourney = journeys.find(j => j.id === selectedJourneyId);

  if (loading) {
    return <Loader size="md" message="Loading learning journey..." containerPadding="py-8" />;
  }

  if (journeys.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-center">
          <span className="material-symbols-rounded text-6xl text-slate-400 block mb-4">map</span>
          <h3 className="font-semibold text-slate-800 mb-2 text-lg">No Learning Journeys Assigned</h3>
          <p className="text-sm text-slate-500">You haven't been assigned any learning journeys yet.</p>
        </div>
      </div>
    );
  }

  // Calculate progress bar width
  const moduleWidth = 256; // w-64
  const gapWidth = 48; // gap-12
  const totalItemWidth = moduleWidth + gapWidth;

  const completedCount = modules.filter(m => m.status === 'completed').length;
  const totalModules = modules.length;

  // Line starts at center of first module (128px from left of first module)
  // Total line width should span from first to last module center
  const totalLineWidth = Math.max(0, (totalModules - 1) * totalItemWidth);

  // Filled width: connect completed modules. 
  // If 1 completed, 0 filled (unless we want to show progress to next).
  // Let's say we fill up to the current active module.
  // If module 1 is done, we fill to module 2.
  const filledWidth = Math.min(totalLineWidth, completedCount * totalItemWidth);

  return (
    <div className="flex flex-col lg:flex-row h-full bg-gray-50 rounded-md overflow-hidden border border-gray-200">
      {/* Sidebar / Journey Selector */}
      <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 p-4 lg:p-6 flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto custom-scrollbar">
        {journeys.map(assignment => (
          <div
            key={assignment.id}
            onClick={() => setSelectedJourneyId(assignment.id)}
            className={`p-4 rounded-md border-2 cursor-pointer transition-all flex-shrink-0 w-64 lg:w-full ${selectedJourneyId === assignment.id
              ? 'border-orange-400 bg-orange-50'
              : 'border-gray-200 hover:border-orange-200'
              }`}
          >
            <h3 className="font-bold text-gray-800 mb-2 truncate">{assignment.journey.title}</h3>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${assignment.progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{assignment.progress}%</span>
            </div>
            <div className="flex gap-2 mb-3">
              <span className="text-[9px] px-2 py-1 rounded-full border bg-blue-50 border-blue-200 text-blue-700 font-semibold">
                {assignment.status === 'completed' ? 'Completed' : assignment.status === 'in_progress' ? 'In Progress' : 'Not Started'}
              </span>
            </div>
            {assignment.status === 'not_started' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartJourney(assignment.id);
                }}
                className="w-full mb-3 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded transition-colors"
              >
                Start Journey
              </button>
            )}
            <div className="flex gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${assignment.journey.type === 'Standard' ? 'bg-gray-800 text-white' : 'bg-white border-gray-300 text-gray-600'}`}>Standard</span>
              {assignment.journey.type === 'Drip' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border bg-gray-800 text-white`}>Drip</span>
              )}
              {assignment.journey.type === 'Flexible' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border bg-gray-800 text-white`}>Flexible</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-8 overflow-hidden flex flex-col">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-800 mb-6 lg:mb-8">{selectedJourney?.journey.title}</h1>

        <div className="relative flex-1 overflow-x-auto custom-scrollbar">
          <div className="min-w-[1000px] lg:min-w-[1200px] relative pt-10 px-6 lg:px-10 pb-10">

            {/* Progress Bar Line */}
            {/* Top calculation: pt-10 (40px) + dot center (12px) - line half height (2px) = 50px */}
            {/* Left calculation: px-6 (24px) or px-10 (40px) + half module width (128px) = 152px or 168px */}
            <div
              className="absolute top-[50px] left-[152px] lg:left-[168px] h-1 bg-gray-200 z-0"
              style={{ width: `${totalLineWidth}px` }}
            >
              <div
                className="h-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${filledWidth}px` }}
              ></div>
            </div>

            {/* Modules Timeline */}
            <div className="flex gap-12 relative z-10">
              {modules.map((item, index) => (
                <div key={item.id} className="flex flex-col items-center w-64 flex-shrink-0 group">
                  {/* Milestone Dot */}
                  <div className={`w-6 h-6 rounded-full border-4 mb-6 relative z-10 transition-colors ${item.status === 'completed' ? 'bg-indigo-500 border-indigo-500' :
                    item.status === 'unlocked' ? 'bg-white border-indigo-500' :
                      'bg-white border-gray-300'
                    }`}>
                    {item.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="material-symbols-rounded text-white text-[10px]">check</span>
                      </div>
                    )}
                  </div>

                  {/* Date Flag - Show unlock date on timeline */}
                  <div className="mb-4 relative w-full">
                    {item.unlock_date ? (
                      <>
                        <div className="bg-indigo-500 text-white font-bold py-1 px-4 rounded-t text-center w-20 mx-auto text-xs">
                          {new Date(item.unlock_date).toLocaleString('default', { month: 'short' })}
                        </div>
                        <div className="bg-white border border-gray-200 font-bold py-1 px-4 rounded-b text-center w-20 mx-auto shadow-sm text-sm">
                          {new Date(item.unlock_date).getDate()}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-blue-500 text-white font-bold py-1 px-4 rounded-t text-center w-20 mx-auto text-xs">
                          Assigned
                        </div>
                        <div className="bg-white border border-gray-200 font-bold py-1 px-4 rounded-b text-center w-20 mx-auto shadow-sm text-sm">
                          {new Date(item.assigned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Module Card */}
                  <div
                    onClick={() => handleModuleClick(item)}
                    className={`w-full bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow border relative group-hover:-translate-y-1 transition-transform duration-300 cursor-pointer ${item.status === 'locked' ? 'border-gray-200 opacity-75 cursor-not-allowed' : 'border-indigo-100'
                      }`}>
                    <div className="p-4 h-full flex flex-col">
                      <h4 className="font-bold text-gray-800 mb-2 line-clamp-2 h-12 text-sm">{item.module.title}</h4>

                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[10px] px-2 py-1 rounded bg-yellow-100 text-yellow-800 font-medium`}>
                          {item.module.type}
                        </span>
                        {item.module.duration && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <span className="material-symbols-rounded text-xs">schedule</span>
                            {item.module.duration} min
                          </span>
                        )}
                      </div>

                      <div className="relative rounded-md overflow-hidden aspect-video bg-gray-200 mb-2">
                        {item.module.image_url && (
                          <img src={item.module.image_url} alt={item.module.title} className="w-full h-full object-cover opacity-80" />
                        )}

                        {/* Lock Overlay */}
                        {item.status === 'locked' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="bg-white px-3 py-1 rounded-full flex items-center gap-1 text-xs font-bold text-gray-700 shadow-sm">
                              <span className="material-symbols-rounded text-xs">lock</span> Locked
                            </div>
                          </div>
                        )}

                        {/* Completed Overlay */}
                        {item.status === 'completed' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="bg-green-100 px-3 py-1 rounded-full flex items-center gap-1 text-xs font-bold text-green-700 shadow-sm">
                              <span className="material-symbols-rounded text-xs">check_circle</span> Completed
                            </div>
                          </div>
                        )}
                      </div>

                      {item.module.provider && (
                        <div className="mt-auto pt-2 flex justify-center">
                          <span className="text-gray-400 font-bold text-xs opacity-80">{item.module.provider}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const CareerPathTab: React.FC<{ setActiveTab: (tab: any) => void }> = ({ setActiveTab }) => {
  const { user } = useAuth();
  const [careerPaths, setCareerPaths] = useState<any[]>([]);
  const [skillProgress, setSkillProgress] = useState<Map<string, any[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const [selectedSkillForView, setSelectedSkillForView] = useState<any | null>(null);
  const [showSkillDetailsModal, setShowSkillDetailsModal] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user?.id) {
      loadCareerPaths();
    }
  }, [user?.id]);

  const loadCareerPaths = async () => {
    try {
      setLoading(true);

      // Clean up expired skills first as they affect readiness
      if (user?.id) {
        await skillService.checkAndDeleteExpiredSkillAssignments(user.id);
      }

      const paths = await careerPathService.getUserCareerPaths(user!.id);

      if (!paths || paths.length === 0) {
        setCareerPaths([]);
        setLoading(false);
        return;
      }

      const progressMap = new Map<string, any[]>();

      // Update readiness and fetch skill progress for each path in parallel
      await Promise.all(paths.map(async (path) => {
        try {
          // CRITICAL: Always recalculate readiness fresh to pick up newly completed courses
          const updatedReadiness = await careerPathService.updateCareerReadiness(user!.id, path.career_path_id);
          console.log(`Career path ${path.career_path_id} readiness updated to:`, updatedReadiness?.readiness_percentage, '%');

          // Fetch latest skill progress with course completion evidence
          const skills = await userSkillAchievementService.getSkillProgressForCareerPath(user!.id, path.career_path_id);
          progressMap.set(path.career_path_id, skills);

          // Log which skills are meeting requirements
          const metRequirements = skills.filter((s: any) => s.is_requirement_met).length;
          console.log(`Skills meeting requirements: ${metRequirements}/${skills.length}`, skills.map((s: any) => ({ name: s.skill_name, achieved: s.percentage_achieved, met: s.is_requirement_met })));
        } catch (err) {
          console.error(`Error updating path ${path.career_path_id}:`, err);
          progressMap.set(path.career_path_id, []);
        }
      }));

      // Fetch fresh career paths with updated readiness
      const updatedPaths = await careerPathService.getUserCareerPaths(user!.id);
      setCareerPaths(updatedPaths);
      setSkillProgress(progressMap);
    } catch (error) {
      console.error('Error loading career paths:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader size="lg" message="Loading career paths..." containerPadding="py-8" />;
  }

  if (careerPaths.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <span className="material-symbols-rounded text-6xl text-slate-400 block mb-4">trending_up</span>
          <h3 className="font-semibold text-slate-800 mb-2 text-lg">No Career Paths Assigned</h3>
          <p className="text-sm text-slate-500">Contact your administrator to assign you a career progression path.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {careerPaths.map((careerPath, idx) => (
        <div key={idx} className="flex flex-col lg:flex-row gap-8">
          {/* Left Column: Progress Info */}
          <div className="lg:w-1/3">
            <div className="bg-[#F8F9FF] rounded-[40px] p-10 border border-slate-100 shadow-sm sticky top-24 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Next Role</p>
              <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">{careerPath.target_role_name}</h3>

              <div className="mb-10">
                <span className={`inline-block px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${careerPath.status === 'Ready for Promotion' ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'
                  }`}>
                  {careerPath.status}
                </span>
              </div>

              <div className="mb-8">
                <div className="text-[64px] font-black text-orange-500 leading-none mb-2">
                  {careerPath.readiness_percentage}%
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Role Ready</p>
              </div>

              <div className="w-full bg-slate-200/50 rounded-full h-2 mb-10 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                  style={{ width: `${careerPath.readiness_percentage}%` }}
                />
              </div>

              <div className="flex flex-col items-center mb-10">
                <span className="material-symbols-rounded text-primary-500 text-3xl mb-4">trending_up</span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Current Role</p>
                <p className="text-lg font-bold text-slate-900">{careerPath.source_role_name}</p>
              </div>

              <div className="space-y-6">
                {careerPath.target_date && (
                  <div className="py-3 px-6 bg-white rounded-2xl border border-slate-100 inline-block">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Date</p>
                    <p className="text-sm font-bold text-slate-700">
                      {new Date(careerPath.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}

                {careerPath.status === 'Ready for Promotion' && (
                  <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex gap-3 items-start animate-pulse text-left">
                    <span className="material-symbols-rounded text-green-600 mt-0.5">verified</span>
                    <div>
                      <p className="text-xs font-bold text-green-800">Ready for Promotion!</p>
                      <p className="text-[10px] text-green-600 mt-0.5">You have met the required skill thresholds for this role transition.</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setActiveTab('journey')}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 group"
                >
                  Continue Learning
                  <span className="material-symbols-rounded group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Skill Progress */}
          <div className="lg:w-2/3 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Required Skills Progress</h4>
              <span className="text-[10px] font-bold text-slate-400">{skillProgress.get(careerPath.career_path_id)?.length || 0} Skills Total</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {skillProgress.get(careerPath.career_path_id)?.map((skill, sIdx) => (
                <div key={sIdx} className={`rounded-2xl p-6 border shadow-sm hover:shadow-md transition-all group ${skill.is_requirement_met
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-slate-200'
                  }`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="font-bold text-slate-900">{skill.skill_name}</h5>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase">{skill.skill_family}</span>
                        {skill.is_requirement_met && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                            <span className="material-symbols-rounded text-xs">check_circle</span>
                            Requirement Met
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Target: {skill.required_level}</span>
                            <span className="text-[10px] font-bold text-primary-600">{skill.percentage_achieved}% Match</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${skill.percentage_achieved >= 100 ? 'bg-green-500' :
                                skill.percentage_achieved >= 30 ? 'bg-primary-500' :
                                  'bg-slate-300'
                                }`}
                              style={{ width: `${skill.percentage_achieved}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Evidence: Show course completion info (toggleable) */}
                      {skill.evidence_course && (evidenceOpen[skill.skill_id || skill.skillId || skill.skill_name]) && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-slate-100">
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Evidence of Completion</p>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{skill.evidence_course}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Level: <strong>{skill.evidence_level_achieved}</strong> • {skill.evidence_percentage}%
                              </p>
                              {skill.evidence_completion_date && (
                                <p className="text-[9px] text-slate-400 mt-1">
                                  ✓ Completed {new Date(skill.evidence_completion_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 md:border-l md:pl-6 border-slate-100">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Your Level</p>
                        <p className={`text-sm font-black ${skill.user_achieved_level === 'Advanced' ? 'text-indigo-600' :
                          skill.user_achieved_level === 'Intermediate' ? 'text-blue-600' :
                            skill.user_achieved_level === 'Beginner' ? 'text-green-600' :
                              'text-slate-400'
                          }`}>
                          {skill.user_achieved_level || 'None'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const key = skill.skill_id || skill.skillId || skill.skill_name || String(Math.random());
                          setEvidenceOpen(prev => ({ ...prev, [key]: !prev[key] }));
                        }}
                        className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-50/80 hover:text-primary-600 transition-all border border-transparent hover:border-primary-100"
                        title="Show / hide evidence"
                      >
                        <span className="material-symbols-rounded">visibility</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedSkillForView(skill);
                          setShowSkillDetailsModal(true);
                        }}
                        className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-primary-50 hover:text-primary-600 transition-all border border-transparent hover:border-primary-100"
                        title="View details"
                      >
                        <span className="material-symbols-rounded">analytics</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Skill Details Modal (User View) */}
      {showSkillDetailsModal && selectedSkillForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative animate-slide-up">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedSkillForView.skill_name || selectedSkillForView.skillName}
                    </h2>
                    <span className="text-xs bg-primary-50 text-primary-600 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                      {selectedSkillForView.skill_family || selectedSkillForView.skillFamily}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-gray-400">Skill Progression & Scoring Logic</p>
                </div>
                <button
                  onClick={() => setShowSkillDetailsModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="material-symbols-rounded text-slate-500">close</span>
                </button>
              </div>

              {/* Scoring Logic Table */}
              <div className="bg-slate-50 dark:bg-gray-900/50 rounded-2xl p-6 border border-slate-100 dark:border-gray-700 mb-8">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-rounded text-sm">analytics</span>
                  Achievement Thresholds
                </h3>
                <div className={`grid gap-4 ${selectedSkillForView.required_level === 'Advanced' ? 'grid-cols-3' :
                  selectedSkillForView.required_level === 'Intermediate' ? 'grid-cols-2' :
                    'grid-cols-1'
                  }`}>
                  {/* Beginner Card */}
                  <div className={`p-4 rounded-lg border-2 transition-all ${selectedSkillForView.user_achieved_level === 'Beginner' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-transparent bg-white dark:bg-gray-800'
                    }`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Beginner</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedSkillForView.required_level === 'Advanced' ? '30%' :
                        selectedSkillForView.required_level === 'Intermediate' ? '40%' : '100%'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Min required: {selectedSkillForView.min_score_beginner || 20}%</p>
                  </div>

                  {/* Intermediate Card */}
                  {['Intermediate', 'Advanced'].includes(selectedSkillForView.required_level) && (
                    <div className={`p-4 rounded-xl border-2 transition-all ${selectedSkillForView.user_achieved_level === 'Intermediate' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-white dark:bg-gray-800'
                      }`}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Intermediate</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {selectedSkillForView.required_level === 'Advanced' ? '60%' : '100%'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Min required: {selectedSkillForView.min_score_intermediate || 50}%</p>
                    </div>
                  )}

                  {/* Advanced Card */}
                  {selectedSkillForView.required_level === 'Advanced' && (
                    <div className={`p-4 rounded-xl border-2 transition-all ${selectedSkillForView.user_achieved_level === 'Advanced' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-transparent bg-white dark:bg-gray-800'
                      }`}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Advanced</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">100%</p>
                      <p className="text-[10px] text-slate-500 mt-1">Min required: {selectedSkillForView.min_score_advanced || 70}%</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-xs text-primary-700 dark:text-primary-300 flex gap-2">
                  <span className="material-symbols-rounded text-sm">info</span>
                  <span>Your current achievement of <b>{selectedSkillForView.user_achieved_level || 'None'}</b> matches <b>{selectedSkillForView.percentage_achieved}%</b> of the <b>{selectedSkillForView.required_level}</b> target.</span>
                </div>
              </div>

              {/* Specific Achievements */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-rounded text-sm">verified</span>
                  Your Learning Evidence
                </h3>
                <div className="space-y-3">
                  {selectedSkillForView.completed_courses && selectedSkillForView.completed_courses.length > 0 ? (
                    selectedSkillForView.completed_courses.map((course: any, cIdx: number) => (
                      <div key={cIdx} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${course.course_title === 'Manually Assigned' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            <span className="material-symbols-rounded text-xl">
                              {course.course_title === 'Manually Assigned' ? 'admin_panel_settings' : 'school'}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{course.course_title || 'Skill Achievement'}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Level: {course.course_level}</span>
                              {course.course_title !== 'Manually Assigned' && (
                                <span className="text-[10px] bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 px-1.5 rounded font-bold">Score: {Math.round(course.percentage_achieved)}%</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {course.course_title === 'Manually Assigned' ? '100%' :
                              userSkillAchievementService.calculateSkillPercentage(
                                course.course_level,
                                selectedSkillForView.required_level,
                                course.percentage_achieved,
                                selectedSkillForView.min_score_beginner,
                                selectedSkillForView.min_score_intermediate,
                                selectedSkillForView.min_score_advanced
                              )}%
                          </p>
                          <p className="text-[10px] text-slate-400">{course.completed_at ? new Date(course.completed_at).toLocaleDateString() : 'Active'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 bg-slate-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-slate-300 dark:border-gray-700">
                      <p className="text-slate-500 text-sm">No courses completed for this skill yet.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => setShowSkillDetailsModal(false)}
                  className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-2xl hover:bg-black dark:hover:bg-primary-700 transition-all shadow-lg"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SkillGroup: React.FC<{ title: string; count: number; score: number; items: any[] }> = ({ title, count, score, items }) => {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
      <div className="p-4 flex items-center justify-between bg-indigo-50/30">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded">{count} Skills</span>
        </div>
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={score > 50 ? "#3b82f6" : score > 30 ? "#a855f7" : "#ef4444"} strokeWidth="4" strokeDasharray={`${score}, 100`} />
          </svg>
          <span className="absolute text-xs font-bold text-slate-700">{score}</span>
        </div>
      </div>

      {items.length > 0 && (
        <div className="border-t border-slate-200">
          {/* Header */}
          <div className="flex justify-between px-6 py-2 text-xs font-bold text-slate-500">
            <span>Skill Name</span>
            <span>Skill Readiness Score</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className={`flex justify-between items-center px-6 py-3 border-t border-slate-100 ${item.bg}`}>
              <span className="text-sm font-medium text-slate-800">{item.name}</span>
              {item.action ? (
                <button className="text-xs font-bold text-indigo-700 underline hover:text-indigo-900">{item.action}</button>
              ) : (
                <span className="text-sm font-bold text-slate-700">{item.score}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SkillDetailModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden relative animate-slide-up">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 z-10">
          <span className="material-symbols-rounded text-slate-500">close</span>
        </button>

        <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
          {/* Main Content */}
          <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Negotiation skill</h2>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Skill Score */}
              <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-4 text-white relative overflow-hidden h-32">
                <h3 className="font-bold relative z-10">Skill score</h3>
                <div className="absolute bottom-2 left-4 text-xs font-bold opacity-80 z-10">13 (Beginning)</div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-4xl font-bold z-10">63</div>
                <div className="absolute bottom-4 right-4 text-xs font-bold opacity-80 z-10 text-right">100<br />(Target)</div>
                {/* Decorative Chart Line */}
                <svg className="absolute bottom-0 left-0 w-full h-16 text-white/30" preserveAspectRatio="none" viewBox="0 0 100 50">
                  <path d="M0,50 L20,40 L40,45 L60,20 L80,30 L100,0 L100,50 Z" fill="currentColor" />
                </svg>
              </div>

              {/* Completion */}
              <div className="bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl p-4 text-white relative overflow-hidden h-32 flex flex-col justify-between">
                <h3 className="font-bold">Completion</h3>
                <div className="text-4xl font-bold">70 / 100 %</div>
                <div className="w-full bg-white/30 h-1.5 rounded-full mt-2">
                  <div className="bg-white h-1.5 rounded-full w-[70%]"></div>
                </div>
              </div>

              {/* Learning Hours */}
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-4 text-white relative overflow-hidden h-32 flex flex-col justify-between">
                <h3 className="font-bold">Learning hours</h3>
                <div className="text-2xl font-bold">1.2 mins / 3 hrs</div>
                <div className="w-full bg-white/30 h-1.5 rounded-full mt-2">
                  <div className="bg-white h-1.5 rounded-full w-[1%]"></div>
                </div>
              </div>
            </div>

            {/* Mandatory Section */}
            <div className="mb-8">
              <h3 className="font-bold text-slate-800 text-lg mb-4 border-b-2 border-primary-600 inline-block pb-1">Mandatory</h3>
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-40 h-24 rounded-lg bg-slate-100 flex-shrink-0 relative overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" className="w-full h-full object-cover" alt="" />
                  <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">5 mins</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 text-sm mb-1">5 Stages For A Successful Negotiation</h4>
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block">General Negotiation Skills</span>
                  <p className="text-xs text-slate-500 line-clamp-2">Join this course and become better at negotiation by learning about the 5 stages of a successful negotiation.</p>
                  <div className="w-full bg-slate-100 h-1 rounded-full mt-3">
                    <div className="bg-indigo-600 h-1 rounded-full w-[20%]"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 text-lg border-b-2 border-indigo-600 inline-block pb-1">Top 5 Recommended</h3>
                <button className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-indigo-700">Discover more</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="h-24 bg-slate-100 relative">
                      <img src={`https://picsum.photos/300/200?random=${i + 10}`} className="w-full h-full object-cover" alt="" />
                      <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">10 mins</span>
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-slate-800 text-xs mb-1 line-clamp-1">Negotiation Skills {i}</h4>
                      <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded mb-2 inline-block">General Skills</span>
                      <p className="text-[10px] text-slate-400 line-clamp-3">Course Overview: This video explains the steps in negotiation and some tips on how to effectively negotiate.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Navigation / Background Graphic */}
          <div className="hidden lg:block w-24 bg-slate-900 relative">
            <button className="absolute right-full top-1/2 -translate-y-1/2 mr-4 bg-white rounded-full p-2 shadow-lg hover:bg-slate-50 text-slate-400">
              <span className="material-symbols-rounded">chevron_left</span>
            </button>
            <button className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full p-3 shadow-lg hover:bg-primary-500 text-white z-20">
              <span className="material-symbols-rounded">chevron_right</span>
            </button>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <button className="bg-slate-800 text-white text-xs px-4 py-2 rounded">Explore more</button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-900 p-4 flex justify-between items-center lg:hidden">
          <button className="text-white px-6 py-2 rounded border border-white/20">Back</button>
          <button className="bg-indigo-600 text-white px-6 py-2 rounded font-bold">Next</button>
        </div>
      </div>
    </div>
  );
};

const AssignedCoursesTab: React.FC<{ setActiveTab: (tab: any) => void }> = ({ setActiveTab }) => {
  const { user } = useAuth();
  const [assignedCourses, setAssignedCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      loadAssignedCourses();
    }
  }, [user?.id]);

  const loadAssignedCourses = async () => {
    // ... existing logic ...
    setLoading(true);
    setError(null);
    try {
      const assignments = await courseAssignmentService.getAssignmentsForUser(user!.id);

      let courseIds = assignments.map((a: any) => a.courseid);

      if (courseIds.length === 0) {
        setAssignedCourses([]);
        setLoading(false);
        return;
      }

      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
            id,
            title,
            instructorname,
            thumbnail,
            category,
            averagerating,
            duration,
            level,
            totalstudents,
            description,
            status,
            certificate_enabled
            `)
        .in('id', courseIds);

      if (coursesError) throw coursesError;

      let progressMap = new Map<string, number>();
      const { data: lessonProgressData } = await supabase
        .from('lesson_progress')
        .select('courseid, completed')
        .eq('userid', user!.id)
        .in('courseid', courseIds);

      const completedLessonsByCourse: Record<string, number> = {};
      if (lessonProgressData) {
        lessonProgressData.forEach((progress: any) => {
          if (progress.completed) {
            if (!completedLessonsByCourse[progress.courseid]) {
              completedLessonsByCourse[progress.courseid] = 0;
            }
            completedLessonsByCourse[progress.courseid]++;
          }
        });
      }

      const { data: lessonCountsData } = await supabase
        .from('lessons')
        .select('courseid, id')
        .in('courseid', courseIds);

      const lessonsByCourse: Record<string, string[]> = {};
      if (lessonCountsData) {
        lessonCountsData.forEach((lesson: any) => {
          if (!lessonsByCourse[lesson.courseid]) {
            lessonsByCourse[lesson.courseid] = [];
          }
          lessonsByCourse[lesson.courseid].push(lesson.id);
        });
      }

      courseIds.forEach((courseId: string) => {
        const totalLessons = lessonsByCourse[courseId]?.length || 0;
        const completedLessons = completedLessonsByCourse[courseId] || 0;
        const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        progressMap.set(courseId, progressPercentage);
      });

      const mappedCourses = coursesData.map((course: any) => ({
        ...course,
        progress: progressMap.get(course.id) || 0,
        assignment: assignments.find((a: any) => a.courseid === course.id),
      }));

      setAssignedCourses(mappedCourses);

    } catch (err) {
      console.error('Error loading assigned courses:', err);
      setError('Failed to load assigned courses.');
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = (courseId: string) => {
    setSelectedCourseId(courseId);
    setShowDetailModal(true);
  };

  if (loading) {
    return <Loader size="lg" message="Loading assigned courses..." containerPadding="py-8" />;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {assignedCourses.length > 0 ? (
        assignedCourses.map((course) => (
          <div
            key={course.id}
            className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate(`/course/${course.id}`)}
          >
            <div className="w-full md:w-1/3 lg:w-1/4 xl:w-1/5 relative">
              <div className="aspect-video rounded-lg overflow-hidden bg-slate-100">
                <img src={course.thumbnail || 'https://picsum.photos/400/225'} alt={course.title} className="w-full h-full object-cover" />
              </div>
              {course.progress === 100 && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                  <span className="material-symbols-rounded text-xs">check_circle</span>
                  Completed
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-2">
                <div>
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">{course.category}</span>
                  <h3 className="font-bold text-lg text-slate-900 mt-1 line-clamp-2">{course.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">by {course.instructorname}</p>
                </div>
                <div className="mt-2 sm:mt-0 flex-shrink-0 sm:ml-4">
                  {course.assignment?.duedate && (
                    <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                      Due: {new Date(course.assignment.duedate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-slate-600">Progress</span>
                  <span className="text-xs font-semibold text-slate-700">{course.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${course.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {course.progress === 100 ? (
                  course.certificate_enabled ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab('certificates');
                      }}
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-rounded text-base">workspace_premium</span>
                      View Certificate
                    </button>
                  ) : (
                    <div className="w-full sm:w-auto bg-green-50 border border-green-300 text-green-700 px-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                      <span className="material-symbols-rounded text-base">check_circle</span>
                      Completed
                    </div>
                  )
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/lesson/${course.id}`);
                    }}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-rounded text-base">play_arrow</span>
                    {course.progress > 0 ? 'Continue Learning' : 'Start Course'}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowDetails(course.id);
                  }}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-rounded text-base">info</span>
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <span className="material-symbols-rounded text-5xl text-slate-400 block mb-4">assignment_turned_in</span>
          <h3 className="font-semibold text-slate-800 mb-1">No Courses Assigned</h3>
          <p className="text-sm text-slate-500">You currently have no courses assigned to you.</p>
        </div>
      )}

      {showDetailModal && (
        <CourseDetailModal
          onClose={() => setShowDetailModal(false)}
          courseId={selectedCourseId}
        />
      )}
    </div>
  );
};

const MyCertificatesTab: React.FC = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadCertificates();
    }
  }, [user?.id]);

  const loadCertificates = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('certificates')
        .select(`
            id,
            issued_at,
            course_id,
            user_id
            `)
        .eq('user_id', user!.id)
        .order('issued_at', { ascending: false });

      if (fetchError) throw fetchError;

      const certificatesWithData = await Promise.all((data || []).map(async (cert) => {
        const { data: course } = await supabase
          .from('courses')
          .select('id, title')
          .eq('id', cert.course_id)
          .single();

        return {
          ...cert,
          course_title: course?.title || 'Unknown Course'
        };
      }));

      setCertificates(certificatesWithData);
    } catch (err) {
      console.error('Error loading certificates:', err);
      setError('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCertificate = (certificateId: string, courseName: string) => {
    window.location.href = `${window.location.origin}/certificate/${certificateId}`;
  };

  if (loading) {
    return <Loader size="lg" message="Loading acquired skills..." containerPadding="py-8" />;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:scale-105"
            >
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="material-symbols-rounded text-5xl drop-shadow">workspace_premium</span>
                  <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">Completed</span>
                </div>
                <h3 className="font-bold text-xl mb-1">Certificate of Completion</h3>
                <p className="text-sm text-white/90 line-clamp-2">{cert.course_title || 'Course'}</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Date Issued</p>
                  <p className="font-semibold text-slate-700">
                    {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Certificate ID</p>
                  <p className="font-mono text-xs text-slate-600 break-all bg-slate-100 p-2 rounded">{cert.id}</p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => handleDownloadCertificate(cert.id, cert.course_title)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-rounded text-base">download</span>
                    Download
                  </button>
                  <button
                    onClick={() => {
                      window.open(`${window.location.origin}/certificate/${cert.id}`, '_blank');
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-rounded text-base">preview</span>
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <span className="material-symbols-rounded text-6xl text-slate-400 block mb-4">workspace_premium</span>
          <h3 className="font-semibold text-slate-800 mb-2 text-lg">No Certificates Yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Complete courses and pass their quizzes to earn certificates. Your certificates will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

const AcquiredSkillsTab: React.FC = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [assignedSkills, setAssignedSkills] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadSkillsData();
    }
  }, [user?.id]);

  const loadSkillsData = async () => {
    try {
      setLoading(true);

      // Clean up expired skills first
      if (user?.id) {
        await skillService.checkAndDeleteExpiredSkillAssignments(user.id);
      }

      // Load Achievements
      const { data: achievementsData, error: achError } = await supabase
        .from('user_skill_achievements')
        .select('*')
        .eq('user_id', user!.id)
        .order('completed_at', { ascending: false });

      if (achError) throw achError;
      // Deduplicate achievements by skill (keep most recent per skill)
      const unique = [];
      const seen = new Set();
      (achievementsData || []).forEach((a: any) => {
        const key = a.skill_id || (a.skill_name || '').toLowerCase() || a.id;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(a);
        }
      });
      setAchievements(unique);

      // Load Badges
      const earnedBadges = await userSkillAchievementService.getUserBadges(user!.id);
      setBadges(earnedBadges || []);

      // Load Assigned Skills
      const { data: assignedData, error: assError } = await supabase
        .from('skill_assignments')
        .select(`
            *,
            skills (
            name,
            family,
            skill_course_mappings (
            courses (title)
            )
            )
            `)
        .eq('userid', user!.id)
        .eq('hidden', false);

      if (assError) throw assError;
      // Filter out assigned skills that are already represented in achievements to avoid duplicates
      const assigned = assignedData || [];
      const filteredAssigned = assigned.filter((asgn: any) => {
        const skillKey = (asgn.skillid || '').toString();
        return !((achievementsData || []).some((a: any) => (a.skill_id || '').toString() === skillKey));
      });
      setAssignedSkills(filteredAssigned);

    } catch (error) {
      console.error('Error loading skills data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader size="md" message="Loading skills..." containerPadding="py-8" />;
  }

  const noSkills = achievements.length === 0 && assignedSkills.length === 0 && badges.length === 0;

  if (noSkills) {
    return (
      <div className="flex items-center justify-center p-12 bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-center">
          <span className="material-symbols-rounded text-6xl text-slate-400 block mb-4">school</span>
          <h3 className="font-semibold text-slate-800 mb-2 text-lg">No Skills Yet</h3>
          <p className="text-sm text-slate-500">Complete courses to earn skills or have them assigned to you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12">
      {/* Skill Family Badges Section */}
      {badges.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-rounded text-primary-600">workspace_premium</span>
            <h2 className="text-xl font-bold text-slate-900">Skill Family Badges</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {badges.map((badge) => (
              <div key={badge.id} className="flex flex-col items-center text-center group">
                <div className="relative mb-3">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center shadow-sm border-2 group-hover:scale-110 transition-transform duration-300"
                    style={{
                      backgroundColor: badge.isEFSET ? `${badge.color}15` : 'rgba(79, 70, 229, 0.05)',
                      borderColor: badge.isEFSET ? badge.color : 'rgb(79, 70, 229)',
                      color: badge.isEFSET ? badge.color : 'rgb(79, 70, 229)'
                    }}
                  >
                    {badge.isEFSET ? (
                      <span className="material-symbols-rounded text-4xl">{badge.icon}</span>
                    ) : badge.icon && (FaIcons as any)[badge.icon] ? (
                      React.createElement((FaIcons as any)[badge.icon], { size: 40 })
                    ) : badge.icon && (MdIcons as any)[badge.icon] ? (
                      React.createElement((MdIcons as any)[badge.icon], { size: 40 })
                    ) : (
                      <span className="material-symbols-rounded text-4xl">workspace_premium</span>
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 rounded-full p-1 border-2 border-white ${badge.isEFSET ? 'bg-blue-500' : 'bg-green-500'}`}>
                    <span className="material-symbols-rounded text-white text-[10px]">
                      {badge.isEFSET ? 'verified' : 'check'}
                    </span>
                  </div>
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-primary-600 transition-colors">{badge.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                  {badge.isEFSET ? 'EFSET Verified' : 'Certified Master'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Achievements Section */}
      {achievements.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-rounded text-primary-600">verified</span>
            <h2 className="text-xl font-bold text-slate-900">Skill Achievements</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements.map((achievement) => (
              <div key={achievement.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{achievement.skill_name}</h3>
                    <div className="flex gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${achievement.course_level === 'Advanced' ? 'bg-indigo-100 text-indigo-700' :
                        achievement.course_level === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                        {achievement.course_level}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-50 pt-4 mt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Earned from</p>
                  <p className="text-sm font-semibold text-slate-700 line-clamp-1" title={achievement.course_title}>
                    {achievement.course_title}
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(achievement.completed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="material-symbols-rounded text-green-500 text-lg">check_circle</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Assigned Skills Section */}
      {assignedSkills.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-rounded text-primary-600">assignment_ind</span>
            <h2 className="text-xl font-bold text-slate-900">Assigned Skills</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedSkills.map((assignment) => {
              const expiryDate = assignment.expiry_date ? new Date(assignment.expiry_date) : null;
              const isExpiringSoon = expiryDate ? (expiryDate.getTime() - new Date().getTime()) < (30 * 24 * 60 * 60 * 1000) : false;
              const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000)) : null;

              return (
                <div key={assignment.id} className={`bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all border-l-4 ${isExpiringSoon ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{assignment.skills?.name || 'Skill'}</h3>
                      <p className="text-xs text-slate-500 mt-1">{assignment.skills?.family || 'General'}</p>
                    </div>
                    <span className={`material-symbols-rounded ${isExpiringSoon ? 'text-amber-500' : 'text-blue-500'}`}>
                      {isExpiringSoon ? 'running_with_errors' : 'push_pin'}
                    </span>
                  </div>

                  <div className="border-t border-slate-50 pt-4 mt-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Source Course</p>
                    <p className="text-sm font-semibold text-slate-700 line-clamp-1">
                      {assignment.skills?.skill_course_mappings?.[0]?.courses?.title || 'Admin Assignment'}
                    </p>

                    {expiryDate && (
                      <div className={`mt-3 flex items-center gap-1.5 text-xs font-bold ${isExpiringSoon ? 'text-amber-600' : 'text-slate-500'}`}>
                        <span className="material-symbols-rounded text-sm">schedule</span>
                        {daysLeft !== null && daysLeft > 0 ? (
                          <span>Expires in {daysLeft} days</span>
                        ) : (
                          <span>Expires today</span>
                        )}
                        <span className="text-[10px] opacity-75">({expiryDate.toLocaleDateString()})</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4">
                      <span className="text-[10px] text-slate-400 font-medium italic">
                        Assigned on {new Date(assignment.assignedat || assignment.createdat).toLocaleDateString()}
                      </span>
                      <span className={`material-symbols-rounded ${isExpiringSoon ? 'text-amber-500' : 'text-blue-500'} text-lg`}>verified_user</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

const AssessmentsTab: React.FC<{ onSelectAssessment: (a: UserExternalAssessment) => void }> = ({ onSelectAssessment }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<UserExternalAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadAssessments();
    }
  }, [user?.id]);

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const data = await externalAssessmentService.getUserAssignments(user!.id);
      setAssignments(data);
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader size="md" message="Loading assessments..." containerPadding="py-8" />;

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <span className="material-symbols-rounded text-6xl text-slate-300 mb-4">quiz</span>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Assessments Found</h3>
        <p className="text-slate-500 text-center max-w-md">
          You haven't been assigned any external assessments yet. Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {assignments.map((assignment) => (
        <AssessmentCard
          key={assignment.id}
          assignment={assignment}
          onClick={() => onSelectAssessment(assignment)}
        />
      ))}
    </div>
  );
};

const AssessmentCard: React.FC<{ assignment: UserExternalAssessment; onClick: () => void }> = ({ assignment, onClick }) => {
  const assessment = assignment.assessment!;
  const latestResult = assignment.results?.[0];

  const getStatusColor = () => {
    if (latestResult?.verified) return 'bg-green-100 text-green-700 border-green-200';
    if (latestResult) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (assignment.status === 'started') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getStatusLabel = () => {
    if (latestResult?.verified) return 'Verified';
    if (latestResult) return 'Pending Verification';
    if (assignment.status === 'started') return 'In Progress';
    return 'Not Started';
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          <span className="material-symbols-rounded">assignment</span>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor()}`}>
          {getStatusLabel()}
        </span>
      </div>

      <h3 className="font-bold text-lg text-slate-900 mb-1 group-hover:text-primary-600 transition-colors">
        {assessment.title}
      </h3>
      <p className="text-sm text-slate-500 line-clamp-2 mb-4">
        {assessment.description}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-slate-400 text-sm">schedule</span>
          <span className="text-xs text-slate-500 font-medium">{assessment.duration} mins</span>
        </div>
        <div className="flex items-center gap-1 text-primary-600 font-bold text-xs uppercase tracking-wider">
          {latestResult?.verification_status === 'approved' ? 'View Result' : assignment.status === 'assigned' ? 'Start Test' : 'Continue'}
          <span className="material-symbols-rounded text-sm">chevron_right</span>
        </div>
      </div>
    </div>
  );
};

const AssessmentLaunchModal: React.FC<{
  assignment: UserExternalAssessment;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ assignment, onClose, onRefresh }) => {
  const { user } = useAuth();
  const assessment = assignment.assessment!;
  const latestResult = assignment.results?.[0];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');

  const handleStart = async () => {
    try {
      await externalAssessmentService.startAssessment(assignment.id, assessment.duration);
      window.open(assessment.external_url, '_blank');
      onRefresh();
    } catch (error) {
      console.error('Error starting assessment:', error);
      alert('Failed to start assessment. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!score) return;

    try {
      setIsSubmitting(true);

      let cefrLevel = undefined;
      if (assessment.provider === 'EFSET') {
        const badge = getEFSETBadge(parseFloat(score));
        if (badge) cefrLevel = badge.cefrLevel;
      }

      await externalAssessmentService.submitResult({
        assignment_id: assignment.id,
        user_id: user!.id,
        assessment_id: assessment.id,
        score: parseFloat(score),
        cefr_level: cefrLevel,
        certificate_url: certificateUrl || undefined
      });
      alert('Result submitted successfully! An administrator will verify it soon.');
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error submitting result:', error);
      alert('Failed to submit result. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl bg-primary-50 text-primary-600">
              <span className="material-symbols-rounded text-3xl">quiz</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <span className="material-symbols-rounded text-slate-400">close</span>
            </button>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">{assessment.title}</h2>
          <p className="text-slate-500 mb-8">{assessment.description}</p>

          {!latestResult ? (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-rounded text-primary-600">info</span>
                  Instructions
                </h3>
                <ul className="space-y-3 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <span className="text-primary-600 font-bold">•</span>
                    This is an external assessment hosted on {new URL(assessment.external_url).hostname}.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary-600 font-bold">•</span>
                    Estimated time to complete: {assessment.duration} minutes.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary-600 font-bold">•</span>
                    After completing the test, please come back here to submit your score and certificate URL.
                  </li>
                </ul>
              </div>

              {assessment.provider === 'EFSET' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="material-symbols-rounded text-sm">leaderboard</span>
                      EFSET Score Mapping
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-slate-200">
                    <div className="bg-white p-2 text-[10px] font-bold text-slate-400 uppercase">CEFR Level</div>
                    <div className="bg-white p-2 text-[10px] font-bold text-slate-400 uppercase">EFSET Score</div>
                    {EFSET_BADGES.map((b) => (
                      <React.Fragment key={b.id}>
                        <div className="bg-white p-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }}></div>
                          <span className="text-xs font-bold text-slate-700">{b.name}</span>
                        </div>
                        <div className="bg-white p-2 text-xs text-slate-500 font-medium">
                          {b.scoreRange[0]} - {b.scoreRange[1]}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {assignment.status === 'assigned' ? (
                <button
                  onClick={handleStart}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  Start External Assessment
                  <span className="material-symbols-rounded">open_in_new</span>
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="font-bold text-slate-900">Submit Your Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Score / Level</label>
                      <input
                        type="text"
                        placeholder="e.g. 75"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Certificate URL (Optional)</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        value={certificateUrl}
                        onChange={(e) => setCertificateUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Results for Verification'}
                    <span className="material-symbols-rounded">check_circle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(assessment.external_url, '_blank')}
                    className="w-full py-3 text-slate-500 font-bold hover:text-primary-600 transition-colors"
                  >
                    Open Test URL Again
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-green-50 rounded-2xl p-8 border border-green-100 text-center">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-rounded text-4xl">{latestResult.verification_status === 'approved' ? 'verified' : 'pending_actions'}</span>
              </div>
              <h3 className="text-xl font-bold text-green-900 mb-2">
                {latestResult.verification_status === 'approved' ? 'Assessment Verified!' : 'Result Submitted'}
              </h3>
              <p className="text-green-700 mb-6">
                {latestResult.verification_status === 'approved'
                  ? `Your result (${latestResult.score}) has been verified and added to your profile.`
                  : 'Your result is currently being reviewed by an administrator.'}
              </p>
              {latestResult.certificate_url && (
                <a
                  href={latestResult.certificate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-green-200 text-green-700 rounded-xl font-bold hover:bg-green-100 transition-all"
                >
                  View Certificate
                  <span className="material-symbols-rounded text-sm">open_in_new</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyLearningPage;