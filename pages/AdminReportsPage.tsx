import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';
import { supabase } from '../lib/supabaseClient';
import { exportToExcel, exportToPDF, exportToCSV } from '../lib/exportUtils';
import {
  fetchLearnerDetailedAnalytics,
  fetchLearningHoursAnalytics,
  fetchSkillProgressionAnalytics,
  fetchDepartmentAnalytics,
  fetchAdminUserActivityReport,
  fetchCareerPathProgressAnalytics,
  fetchCourseAnalyticsDetail,
  fetchEngagementMetricsAnalytics
} from '../lib/advancedReportsService';

const AdminReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('learner-details');
  const [data, setData] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);

  const reports = [
    // Advanced Learner Reports
    { id: 'learner-details', label: 'Detailed Learner Analytics', icon: 'person_outline', category: 'Learner Reports' },
    { id: 'learning-hours', label: 'Learning Hours & Engagement', icon: 'schedule', category: 'Learner Reports' },
    { id: 'engagement-metrics', label: 'Engagement Metrics', icon: 'trending_up', category: 'Learner Reports' },
    { id: 'skill-progression', label: 'Skill Progression', icon: 'grade', category: 'Learner Reports' },

    // Career & Paths
    { id: 'career-path-progress', label: 'Career Path Progress', icon: 'trending_up', category: 'Career & Paths' },

    // Department Reports
    { id: 'department-analytics', label: 'Department Analytics', icon: 'domain', category: 'Organization' },
    { id: 'course-details', label: 'Course Analytics', icon: 'class', category: 'Organization' },

    // Admin Reports
    { id: 'admin-activity', label: 'Admin User Activity', icon: 'shield', category: 'Admin Reports' },

    // Legacy Reports
    { id: 'user-completion', label: 'User Completion Report', icon: 'person_check', category: 'Legacy Reports' },
    { id: 'course-inventory', label: 'Course Performance Inventory', icon: 'inventory_2', category: 'Legacy Reports' },
    { id: 'assessment-results', label: 'Assessment Detailed Results', icon: 'fact_check', category: 'Legacy Reports' },
    { id: 'skill-matrix', label: 'Organization Skill Matrix', icon: 'grid_on', category: 'Legacy Reports' },
    { id: 'skill-matrix-live', label: 'Organization Skill Matrix (Live)', icon: 'grid_on', category: 'Legacy Reports' },
    { id: 'compliance', label: 'Compliance & Certificates', icon: 'verified_user', category: 'Legacy Reports' },
  ];

  // Group reports by category
  const reportsByCategory = reports.reduce((acc: any, report) => {
    if (!acc[report.category]) {
      acc[report.category] = [];
    }
    acc[report.category].push(report);
    return acc;
  }, {});

  // Fetch departments for filter
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('department')
        .returns<any[]>();

      const uniqueDepts = [...new Set(profiles?.map(p => p.department).filter(Boolean))] as string[];
      setDepartments(uniqueDepts);
    };

    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [reportType, filterDept]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      let reportData = [];

      if (reportType === 'learner-details') {
        reportData = await fetchLearnerDetailedAnalytics();
      } else if (reportType === 'learning-hours') {
        reportData = await fetchLearningHoursAnalytics();
      } else if (reportType === 'skill-progression') {
        reportData = await fetchSkillProgressionAnalytics();
      } else if (reportType === 'department-analytics') {
        reportData = await fetchDepartmentAnalytics();
      } else if (reportType === 'admin-activity') {
        reportData = await fetchAdminUserActivityReport();
      } else if (reportType === 'career-path-progress') {
        reportData = await fetchCareerPathProgressAnalytics();
      } else if (reportType === 'course-details') {
        reportData = await fetchCourseAnalyticsDetail();
      } else if (reportType === 'engagement-metrics') {
        reportData = await fetchEngagementMetricsAnalytics();
      } else if (reportType === 'user-completion') {
        const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, fullname, email, department, role');
        const { data: enrollments, error: enrollmentsError } = await supabase.from('enrollments').select('userid, completed, courseid');

        console.log('📋 User Completion Report:', {
          profilesError: profilesError?.message,
          profilesCount: profiles?.length || 0,
          enrollmentsError: enrollmentsError?.message,
          enrollmentsCount: enrollments?.length || 0
        });

        reportData = profiles?.map((p: any) => {
          const userEnrolls = enrollments?.filter(e => e.userid === p.id) || [];
          return {
            'Full Name': p.fullname,
            'Email': p.email,
            'Department': p.department || 'N/A',
            'Total Enrolled': userEnrolls.length,
            'Completed': userEnrolls.filter(e => e.completed).length,
            'Progress %': userEnrolls.length > 0 ? Math.round((userEnrolls.filter(e => e.completed).length / userEnrolls.length) * 100) : 0
          };
        }) || [];
      } else if (reportType === 'course-inventory') {
        const { data: courses, error: coursesError } = await supabase.from('courses').select('id, title, description, created_at');
        const { data: enrollments, error: enrollmentsError } = await supabase.from('enrollments').select('courseid, completed');

        console.log('📚 Course Inventory Report:', {
          coursesError: coursesError?.message,
          coursesCount: courses?.length || 0,
          enrollmentsError: enrollmentsError?.message,
          enrollmentsCount: enrollments?.length || 0
        });

        reportData = courses?.map((c: any) => {
          const courseEnrolls = enrollments?.filter(e => e.courseid === c.id) || [];
          return {
            'Course Title': c.title,
            'Description': c.description || 'N/A',
            'Total Enrollments': courseEnrolls.length,
            'Completions': courseEnrolls.filter(e => e.completed).length,
            'Completion Rate %': courseEnrolls.length > 0 ? Math.round((courseEnrolls.filter(e => e.completed).length / courseEnrolls.length) * 100) : 0,
            'Assessments': 0,
            'Created Date': new Date(c.created_at).toLocaleDateString()
          };
        }) || [];
      } else if (reportType === 'assessment-results') {
        const { data: results } = await supabase
          .from('assessment_results')
          .select('id, percentage, passed, completedat, userid, assessmentid');

        // Fetch related data
        const userIds = [...new Set(results?.map(r => r.userid) || [])];
        const assessmentIds = [...new Set(results?.map(r => r.assessmentid) || [])];

        const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, fullname, email, department').in('id', userIds) : { data: [] };
        const { data: assessments } = assessmentIds.length > 0 ? await supabase.from('assessments').select('id, title, courseid').in('id', assessmentIds) : { data: [] };
        const { data: courses } = await supabase.from('courses').select('id, title');

        reportData = results?.map((r: any) => {
          const profile = (profiles || [])?.find(p => p.id === r.userid);
          const assessment = (assessments || [])?.find(a => a.id === r.assessmentid);
          const course = (courses || [])?.find(c => c.id === assessment?.courseid);

          return {
            'Student Name': profile?.fullname || 'Unknown',
            'Email': profile?.email || 'N/A',
            'Department': profile?.department || 'N/A',
            'Course': course?.title || 'Unknown',
            'Assessment': assessment?.title || 'Unknown',
            'Score %': r.percentage,
            'Passed': r.passed ? 'Yes' : 'No',
            'Submitted Date': new Date(r.completedat).toLocaleDateString()
          };
        }) || [];
      } else if (reportType === 'skill-matrix') {
        const { data: skillMatrix } = await supabase.rpc('get_skill_matrix_data');
        reportData = skillMatrix || [];
      } else if (reportType === 'skill-matrix-live') {
        const { data: profiles } = await supabase.from('profiles').select('id, fullname, email, department, role');
        const { data: skills } = await supabase.from('skills').select('id, name');
        const { data: userSkills } = await supabase.from('user_skill_achievements').select('user_id, skill_id');

        const matrix: any = {};

        profiles?.forEach((p: any) => {
          matrix[p.id] = {
            'Full Name': p.fullname,
            'Email': p.email,
            'Department': p.department || 'N/A',
          };
          skills?.forEach((s: any) => {
            matrix[p.id][s.name] = 'Not Acquired';
          });
        });

        userSkills?.forEach((us: any) => {
          const user = profiles?.find((p: any) => p.id === us.user_id);
          const skill = skills?.find((s: any) => s.id === us.skill_id);
          if (user && skill) {
            matrix[user.id][skill.name] = 'Acquired';
          }
        });

        reportData = Object.values(matrix);
      } else if (reportType === 'compliance') {
        const { data: certs } = await supabase
          .from('certificates')
          .select('user_id, course_id, issued_at');
        const { data: profiles } = await supabase.from('profiles').select('id, fullname, department');
        const { data: courses } = await supabase.from('courses').select('id, title');

        reportData = certs?.map((c: any) => {
          const profile = profiles?.find(p => p.id === c.user_id);
          const course = courses?.find(co => co.id === c.course_id);
          return {
            'User': profile?.fullname || 'Unknown',
            'Department': profile?.department || 'N/A',
            'Certificate': course?.title || 'Unknown',
            'Issued Date': new Date(c.issued_at).toLocaleDateString(),
            'Status': 'Valid'
          };
        }) || [];
      }

      // Apply department filter
      if (filterDept !== 'all' && reportData.length > 0 && reportData[0]['Department']) {
        reportData = reportData.filter(row => row['Department'] === filterDept);
      }

      setData(reportData);
      setTotalRecords(reportData.length);
    } catch (error) {
      console.error('Error fetching report:', error);
      setData([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (data.length === 0) return;
    const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}`;
    exportToExcel(data, filename);
  };

  const handleExportPDF = () => {
    if (data.length === 0) return;
    const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}`;
    const title = `${reportType.replace('-', ' ').toUpperCase()} REPORT`;
    exportToPDF(data, filename, title);
  };

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(data, filename);
  };

  return (
    <AdminLayout title="LMS Analytics & Learning Reports">
      <style>{`
        .reports-sidebar {
          padding-right: 12px;
        }
        .reports-sidebar::-webkit-scrollbar {
          width: 1.5px;
        }
        .reports-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }
        .reports-sidebar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .reports-sidebar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Report Sidebar */}
        <div className="reports-sidebar lg:col-span-1 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto lg:sticky lg:top-8 pl-2">
          {Object.entries(reportsByCategory).map(([category, categoryReports]: [string, any]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 py-1">{category}</h4>
              {categoryReports.map((report: any) => (
                <button
                  key={report.id}
                  onClick={() => setReportType(report.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${reportType === report.id
                    ? 'bg-[#4f46e5] text-white shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
                >
                  <span className="material-symbols-rounded text-base">{report.icon}</span>
                  <span className="text-left line-clamp-2">{report.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Report Content */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Report Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {reports.find(r => r.id === reportType)?.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Total Records: {totalRecords}</p>
                </div>
              </div>

              {/* Filters and Export Buttons */}
              <div className="flex flex-wrap gap-3 items-center">
                {departments.length > 0 && (
                  <select
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                    className="px-3 py-2 pr-8 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                )}

                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={handleExportExcel}
                    disabled={data.length === 0}
                    title="Download as Excel"
                    className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-rounded text-sm">download</span>
                    <span className="hidden sm:inline">Excel</span>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={data.length === 0}
                    title="Download as PDF"
                    className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-rounded text-sm">picture_as_pdf</span>
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    disabled={data.length === 0}
                    title="Download as CSV"
                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-rounded text-sm">download</span>
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Report Data Table */}
            <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {data.length > 0 && Object.keys(data[0]).map(header => (
                      <th
                        key={header}
                        className="px-6 py-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-100"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={Object.keys(data[0] || {}).length || 10} className="px-6 py-20 text-center">
                        <Loader size="lg" message="Loading report data..." />
                      </td>
                    </tr>
                  ) : data.length > 0 ? (
                    data.map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                        {Object.values(row).map((val: any, j) => {
                          let displayValue = val;
                          let cellClass = 'px-6 py-4 text-sm text-gray-700';

                          if (typeof val === 'number') {
                            if (val.toString().includes('%') || val > 0 && val <= 100) {
                              cellClass = 'px-6 py-4 text-sm font-semibold text-blue-600';
                            }
                            displayValue = typeof val === 'number' ? val.toFixed(val % 1 !== 0 ? 2 : 0) : val;
                          } else if (val === 'Active' || val === 'Completed') {
                            cellClass = 'px-6 py-4 text-sm font-semibold text-green-600';
                          } else if (val === 'Inactive' || val === 'Failed') {
                            cellClass = 'px-6 py-4 text-sm font-semibold text-red-600';
                          }

                          return (
                            <td key={j} className={cellClass}>
                              {displayValue}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={Object.keys(data[0] || {}).length || 10} className="px-6 py-20 text-center text-gray-400 italic">
                        No data available for this report
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Report Summary */}
            {data.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-600">
                <p>Showing <strong>{data.length}</strong> records • Last updated: {new Date().toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Report Description */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-900">
              <strong>💡 Tip:</strong> These comprehensive learning reports provide detailed analytics on learner progress, engagement, skills, and performance. Use filters to segment data by department and export in multiple formats for analysis.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReportsPage;

