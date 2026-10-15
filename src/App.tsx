import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'

// Layouts
import { PublicLayout } from '@/components/layout/PublicLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'

// Public Pages
import { LandingPage } from '@/pages/public/LandingPage'
import { EventsPage } from '@/pages/public/EventsPage'
import { EventDetailPage } from '@/pages/public/EventDetailPage'
import { CertificateVerifyPage } from '@/pages/public/CertificateVerifyPage'
import { LeaderboardPage } from '@/pages/public/LeaderboardPage'
import { LoginPage } from '@/pages/public/LoginPage'
import { AuthCallbackPage } from '@/pages/public/AuthCallbackPage'

// Student Pages
import { StudentDashboard } from '@/pages/student/StudentDashboard'
import { MyRegistrationsPage } from '@/pages/student/MyRegistrationsPage'
import { TeamManagementPage } from '@/pages/student/TeamManagementPage'
import { AttendanceStatusPage } from '@/pages/student/AttendanceStatusPage'
import { MyCertificatesPage } from '@/pages/student/MyCertificatesPage'
import { ProfilePage } from '@/pages/student/ProfilePage'

// Organizer Pages
import { OrganizerDashboard } from '@/pages/organizer/OrganizerDashboard'
import { OrganizerEventsPage } from '@/pages/organizer/OrganizerEventsPage'
import { CreateEventPage } from '@/pages/organizer/CreateEventPage'
import { EditEventPage } from '@/pages/organizer/EditEventPage'
import { EventRegistrationsPage } from '@/pages/organizer/EventRegistrationsPage'
import { QRAttendancePage } from '@/pages/organizer/QRAttendancePage'
import { AttendanceReportsPage } from '@/pages/organizer/AttendanceReportsPage'
import { EventResultsPage } from '@/pages/organizer/EventResultsPage'
import { CertificateManagerPage } from '@/pages/organizer/CertificateManagerPage'

// Admin Pages
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { EventApprovalQueue } from '@/pages/admin/EventApprovalQueue'
import { UserRoleManagement } from '@/pages/admin/UserRoleManagement'
import { CategoryManagement } from '@/pages/admin/CategoryManagement'
import { CertificateMonitoringPage } from '@/pages/admin/CertificateMonitoringPage'
import { NotificationLogsPage } from '@/pages/admin/NotificationLogsPage'
import { AuditLogsPage } from '@/pages/admin/AuditLogsPage'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* PUBLIC ROUTES */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/verify-certificate" element={<CertificateVerifyPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
            </Route>

            {/* STUDENT PROTECTED ROUTES */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['student', 'organizer', 'admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/registrations" element={<MyRegistrationsPage />} />
              <Route path="/student/teams" element={<TeamManagementPage />} />
              <Route path="/student/attendance" element={<AttendanceStatusPage />} />
              <Route path="/student/certificates" element={<MyCertificatesPage />} />
              <Route path="/student/profile" element={<ProfilePage />} />
            </Route>

            {/* ORGANIZER PROTECTED ROUTES */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/organizer" element={<OrganizerDashboard />} />
              <Route path="/organizer/events" element={<OrganizerEventsPage />} />
              <Route path="/organizer/events/new" element={<CreateEventPage />} />
              <Route path="/organizer/events/:id/edit" element={<EditEventPage />} />
              <Route path="/organizer/events/:id/registrations" element={<EventRegistrationsPage />} />
              <Route path="/organizer/attendance" element={<QRAttendancePage />} />
              <Route path="/organizer/attendance-reports" element={<AttendanceReportsPage />} />
              <Route path="/organizer/results" element={<EventResultsPage />} />
              <Route path="/organizer/certificates" element={<CertificateManagerPage />} />
            </Route>

            {/* ADMIN PROTECTED ROUTES */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/approvals" element={<EventApprovalQueue />} />
              <Route path="/admin/users" element={<UserRoleManagement />} />
              <Route path="/admin/categories" element={<CategoryManagement />} />
              <Route path="/admin/certificates" element={<CertificateMonitoringPage />} />
              <Route path="/admin/notifications" element={<NotificationLogsPage />} />
              <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
