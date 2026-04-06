import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DarkModeProvider } from './contexts/DarkModeContext';
import useAuthGuard from './hooks/useAuthGuard';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ResetPassword from './pages/ResetPassword';
import DashboardPage from './pages/DashboardPage';
import CatalogPage from './pages/CatalogPage';
import CourseDetailPage from './pages/CourseDetailPage';
import LessonPlayerPage from './pages/LessonPlayerPage';
import QuizPage from './pages/QuizPage';
import AssessmentPage from './pages/AssessmentPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MyLearningPage from './pages/MyLearningPage';
import CalenderPage from './pages/CalenderPage';
import CommunityPage from './pages/CommunityPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AdminPage from './pages/AdminPage';
import AdminCourses from './pages/AdminCourses';
import AdminDashboard from './pages/AdminDashboard';
import ManageCourseAssignments from './pages/ManageCourseAssignments';
import ManageLearningJourneys from './pages/ManageLearningJourneys';
import Users from './pages/Users';
import UserAdminPage from './pages/UserAdminPage';
import UserManagementV2Page from './pages/UserManagementV2Page';
import UsersPage from './pages/UsersPage';
import AddUserPage from './pages/AddUserPage';
import EditUserPage from './pages/EditUserPage';
import SkillManagementPage from './src/pages/admin/SkillManagementPage';

import CertificatePage from './pages/CertificatePage';

import AdminAssessmentsPage from './pages/AdminAssessmentsPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdvancedNotificationsPage from './pages/AdvancedNotificationsPage';
import AcknowledgementsPage from './pages/AcknowledgementsPage';
import CertificateSignatureSettings from './pages/CertificateSignatureSettings';
import OrganizationHierarchyPage from './pages/OrganizationHierarchyPage';
import ConcernManagementPage from './pages/ConcernManagementPage';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isPublic = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/reset-password';
  const isPlayer = location.pathname.includes('/lesson');
  const isStandalone = location.pathname.includes('/quiz') || location.pathname.includes('/assessment') || location.pathname.includes('/certificate');
  const isAdmin = location.pathname.includes('/admin');

  if (isPublic) {
    return <>{children}</>;
  }

  // Admin layout is handled within the admin component itself
  if (isAdmin) {
    return <>{children}</>;
  }

  // Specialized layout for immersive player to maximize screen real estate
  if (isPlayer) {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {children}
      </div>
    );
  }

  // Standalone layout for Quiz/Assessment
  if (isStandalone) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  // Standard Dashboard Layout
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode, roles?: string[] }> = ({ children, roles }) => {
  const isAllowed = useAuthGuard(roles);

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <p className="text-sm text-gray-500 mt-4">Required role: {roles?.join(' or ')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { userRole } = useAuth();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Learner Routes */}
        <Route path="/dashboard" element={<ProtectedRoute roles={['student', 'admin', 'instructor']}><DashboardPage /></ProtectedRoute>} />
        <Route path="/catalog" element={<ProtectedRoute><CatalogPage /></ProtectedRoute>} />
        <Route path="/course/:id" element={<ProtectedRoute><CourseDetailPage /></ProtectedRoute>} />
        <Route path="/lesson/:courseId/:lessonId" element={<ProtectedRoute><LessonPlayerPage /></ProtectedRoute>} />
        <Route path="/quiz/:id" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/assessment/:id" element={<ProtectedRoute><AssessmentPage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/learning" element={<ProtectedRoute><MyLearningPage /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalenderPage /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
        <Route path="/hierarchy" element={<ProtectedRoute><OrganizationHierarchyPage /></ProtectedRoute>} />
        <Route path="/certificate/:certificateId" element={<ProtectedRoute><CertificatePage /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute roles={['admin', 'instructor']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/courses" element={<ProtectedRoute roles={['admin', 'instructor']}><AdminCourses /></ProtectedRoute>} />
        <Route path="/admin/course-assignments" element={<ProtectedRoute roles={['admin', 'instructor']}><ManageCourseAssignments /></ProtectedRoute>} />
        <Route path="/admin/assessments" element={<ProtectedRoute roles={['admin', 'instructor']}><AdminAssessmentsPage /></ProtectedRoute>} />
        <Route path="/admin/learning-journeys" element={<ProtectedRoute roles={['admin', 'instructor']}><ManageLearningJourneys /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin', 'instructor']}><AdminAnalyticsPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute roles={['admin', 'instructor']}><AdminReportsPage /></ProtectedRoute>} />
        <Route path="/admin/concerns" element={<ProtectedRoute roles={['admin', 'instructor']}><ConcernManagementPage /></ProtectedRoute>} />
        <Route path="/admin/notifications" element={<ProtectedRoute roles={['admin', 'instructor']}><AdvancedNotificationsPage /></ProtectedRoute>} />
        <Route path="/admin/acknowledgements" element={<ProtectedRoute roles={['admin', 'instructor']}><AcknowledgementsPage /></ProtectedRoute>} />
        <Route path="/admin/certificate-signatures" element={<ProtectedRoute roles={['admin', 'instructor']}><CertificateSignatureSettings /></ProtectedRoute>} />
        <Route path="/admin/user-management" element={<ProtectedRoute roles={['admin', 'instructor']}><UserAdminPage /></ProtectedRoute>} />
        <Route path="/admin/user-management-v2" element={<ProtectedRoute roles={['admin', 'instructor']}><UserManagementV2Page /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['admin', 'instructor']}><UsersPage /></ProtectedRoute>} />
        <Route path="/admin/users/new" element={<ProtectedRoute roles={['admin', 'instructor']}><AddUserPage /></ProtectedRoute>} />
        <Route path="/admin/users/edit/:id" element={<ProtectedRoute roles={['admin', 'instructor']}><EditUserPage /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin/skills" element={<ProtectedRoute roles={['admin', 'instructor']}><SkillManagementPage /></ProtectedRoute>} />

        {/* Redirect based on role */}
        <Route path="*" element={<Navigate to={userRole === 'admin' || userRole === 'instructor' ? '/admin' : '/dashboard'} replace />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <DarkModeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </DarkModeProvider>
  );
};

export default App;