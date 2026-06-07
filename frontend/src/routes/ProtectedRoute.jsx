import { useAuthContext } from "../contexts/AuthContext";
import { Navigate, useLocation } from "react-router";

function ProtectedRoute({ children }) {
  const { isLoading, isAuthenticated } = useAuthContext();
  const location = useLocation();

  // loading state while checking authentication
  if (isLoading) {
    return (
      <main className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="size-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="sr-only">Loading...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
