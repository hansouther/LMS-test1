import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, roleHome } from "@/context/AuthContext";
import FullScreenLoader from "@/components/FullScreenLoader";

export default function ProtectedRoute({ roles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === null) return <FullScreenLoader label="Memverifikasi sesi..." />;
  if (user === false) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return <Outlet />;
}
