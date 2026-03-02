import { Navigate, useLocation } from "react-router-dom";
import { clearAuthSession, getAuthSession, isSessionExpired } from "../utils/auth";

export default function ProtectedRoute({ allowedRoles, children }) {
  const location = useLocation();
  const session = getAuthSession();

  if (!session || isSessionExpired(session)) {
    clearAuthSession();
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(session.user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
