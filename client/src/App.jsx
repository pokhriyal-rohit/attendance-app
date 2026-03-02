import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import OAuthCallback from "./pages/OAuthCallback";
import StudentDashboard from "./pages/StudentDashboard";
import StudentAttendanceAnalytics from "./pages/StudentAttendanceAnalytics";
import TeacherDashboard from "./pages/TeacherDashboard";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import RoomStatus from "./pages/RoomStatus";
import ProtectedRoute from "./components/ProtectedRoute";
import { clearAuthSession, getAuthSession, isSessionExpired } from "./utils/auth";

function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionVersion, setSessionVersion] = useState(0);
  const session = useMemo(() => getAuthSession(), [sessionVersion, location.pathname]);
  const role = session?.user?.role || null;

  const logout = () => {
    clearAuthSession();
    setSessionVersion((v) => v + 1);
    navigate("/");
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            to="/"
            className={`rounded-md px-3 py-1.5 ${
              location.pathname === "/"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Login
          </Link>
          {role === "student" && (
            <>
              <Link
                to="/student"
                className={`rounded-md px-3 py-1.5 ${
                  location.pathname === "/student"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Student Dashboard
              </Link>
              <Link
                to="/student/analytics"
                className={`rounded-md px-3 py-1.5 ${
                  location.pathname.startsWith("/student/analytics")
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Student Analytics
              </Link>
            </>
          )}
          {role === "teacher" && (
            <>
              <Link
                to="/teacher"
                className={`rounded-md px-3 py-1.5 ${
                  location.pathname === "/teacher"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Teacher Dashboard
              </Link>
            </>
          )}
          {session?.user && (
            <Link
              to="/rooms/status"
              className={`rounded-md px-3 py-1.5 ${
                location.pathname.startsWith("/rooms/status")
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Room Status
            </Link>
          )}
          {(role === "teacher" || role === "admin") && (
            <Link
              to="/analytics"
              className={`rounded-md px-3 py-1.5 ${
                location.pathname.startsWith("/analytics")
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Analytics
            </Link>
          )}
          {role === "admin" && (
            <Link
              to="/admin"
              className={`rounded-md px-3 py-1.5 ${
                location.pathname.startsWith("/admin")
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Admin Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {session?.user && (
            <p className="text-xs text-slate-600">
              {session.user.name} ({session.user.role})
            </p>
          )}
          {session?.user && (
            <button
              type="button"
              onClick={logout}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkExpiry = () => {
      const session = getAuthSession();
      if (session && isSessionExpired(session)) {
        clearAuthSession();
        navigate("/");
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 30 * 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/analytics"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentAttendanceAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={["teacher"]}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rooms/status"
          element={
            <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
              <RoomStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute allowedRoles={["teacher", "admin"]}>
              <AnalyticsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
