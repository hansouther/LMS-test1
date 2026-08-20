import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthCallback from "@/components/AuthCallback";
import DashboardLayout from "@/components/layout/DashboardLayout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import CalendarPage from "@/pages/public/CalendarPage";
import NewsPage from "@/pages/public/NewsPage";
import NewsDetail from "@/pages/public/NewsDetail";
import CoursesPage from "@/pages/public/CoursesPage";

import StudentDashboard from "@/pages/student/StudentDashboard";
import LearningRoom from "@/pages/student/LearningRoom";
import CourseCatalog from "@/pages/student/CourseCatalog";
import TryoutList from "@/pages/student/TryoutList";
import TryoutEngine from "@/pages/student/TryoutEngine";
import TryoutResult from "@/pages/student/TryoutResult";
import StudentSchedule from "@/pages/student/StudentSchedule";
import CourseLearn from "@/pages/student/CourseLearn";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import ManageNews from "@/pages/admin/ManageNews";
import ManageCalendar from "@/pages/admin/ManageCalendar";
import ManageCourses from "@/pages/admin/ManageCourses";
import ManageSchedule from "@/pages/admin/ManageSchedule";
import ManageTryouts from "@/pages/admin/ManageTryouts";
import TryoutBuilder from "@/pages/admin/TryoutBuilder";
import TryoutResults from "@/pages/admin/TryoutResults";
import ManageBroadcast from "@/pages/admin/ManageBroadcast";
import ManagePartnerships from "@/pages/admin/ManagePartnerships";
import ManageUsers from "@/pages/admin/ManageUsers";
import CourseContent from "@/pages/admin/CourseContent";

import TutorDashboard from "@/pages/tutor/TutorDashboard";
import JobBidding from "@/pages/tutor/JobBidding";
import TutorCalendar from "@/pages/tutor/TutorCalendar";
import ClassManagement from "@/pages/tutor/ClassManagement";
import TutorMaterials from "@/pages/tutor/TutorMaterials";

import ProctorDashboard from "@/pages/proctor/ProctorDashboard";
import LiveMonitoring from "@/pages/proctor/LiveMonitoring";
import Analytics from "@/pages/proctor/Analytics";
import Reports from "@/pages/proctor/Reports";
import ProctorTrainings from "@/pages/proctor/Trainings";
import RegisterProctor from "@/pages/RegisterProctor";
import PendingVerification from "@/pages/PendingVerification";

function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register/proktor" element={<RegisterProctor />} />
      <Route path="/pending" element={<PendingVerification />} />
      <Route path="/kalender" element={<CalendarPage />} />
      <Route path="/berita" element={<NewsPage />} />
      <Route path="/berita/:id" element={<NewsDetail />} />
      <Route path="/kursus" element={<CoursesPage />} />

      {/* Student */}
      <Route element={<ProtectedRoute roles={["student"]} />}>
        <Route path="/student/exam/:id" element={<TryoutEngine />} />
        <Route element={<DashboardLayout />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/learning" element={<LearningRoom />} />
          <Route path="/student/courses" element={<CourseCatalog />} />
          <Route path="/student/courses/:id/learn" element={<CourseLearn />} />
          <Route path="/student/tryouts" element={<TryoutList />} />
          <Route path="/student/results/:attemptId" element={<TryoutResult />} />
          <Route path="/student/schedule" element={<StudentSchedule />} />
        </Route>
      </Route>

      {/* Admin */}
      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/news" element={<ManageNews />} />
          <Route path="/admin/calendar" element={<ManageCalendar />} />
          <Route path="/admin/courses" element={<ManageCourses />} />
          <Route path="/admin/courses/:id/content" element={<CourseContent />} />
          <Route path="/admin/schedule" element={<ManageSchedule />} />
          <Route path="/admin/tryouts" element={<ManageTryouts />} />
          <Route path="/admin/tryouts/:id/builder" element={<TryoutBuilder />} />
          <Route path="/admin/tryouts/:id/results" element={<TryoutResults />} />
          <Route path="/admin/broadcasts" element={<ManageBroadcast />} />
          <Route path="/admin/partnerships" element={<ManagePartnerships />} />
          <Route path="/admin/users" element={<ManageUsers />} />
        </Route>
      </Route>

      {/* Tutor */}
      <Route element={<ProtectedRoute roles={["tutor"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/tutor" element={<TutorDashboard />} />
          <Route path="/tutor/bidding" element={<JobBidding />} />
          <Route path="/tutor/calendar" element={<TutorCalendar />} />
          <Route path="/tutor/classes" element={<ClassManagement />} />
          <Route path="/tutor/materials" element={<TutorMaterials />} />
        </Route>
      </Route>

      {/* Proctor */}
      <Route element={<ProtectedRoute roles={["proctor"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/proctor" element={<ProctorDashboard />} />
          <Route path="/proctor/monitoring" element={<LiveMonitoring />} />
          <Route path="/proctor/analytics" element={<Analytics />} />
          <Route path="/proctor/trainings" element={<ProctorTrainings />} />
          <Route path="/proctor/reports" element={<Reports />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
