import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * ProtectedRoute
 *
 * Usage:
 *   <ProtectedRoute>                        — any authenticated user
 *   <ProtectedRoute role="support">         — support person only
 *   <ProtectedRoute feature="ocd">          — feature must be enabled for user
 *   <ProtectedRoute role="user" feature="ocd.erp-tracker">
 *
 * Redirect logic:
 *   - Not authenticated                    → /login-user
 *   - User with no disorders selected      → /onboarding/disorders (first-run)
 *   - Support person visiting /            → /support-dashboard
 *   - Role mismatch                        → their correct home
 *   - Feature not in user's enabled set    → / (safe fallback, no error screen)
 */
export default function ProtectedRoute({ children, role, feature }) {
  const { isAuthenticated, isLoading, user, role: userRole, hasFeature } = useAuth();
  const location = useLocation();

  // Still hydrating from localStorage – render nothing to avoid flash
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-muted-foreground text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  // Not logged in → go to login
  if (!isAuthenticated) {
    return <Navigate to="/login-user" state={{ from: location }} replace />;
  }

  // Role-specific guard
  if (role && userRole !== role) {
    if (userRole === "support" || userRole === "admin") return <Navigate to="/support-dashboard" replace />;
    if (userRole === "guardian") return <Navigate to="/guardian-dashboard" replace />;
    if (userRole === "user") {
      const profile = user?.selectedProfile;
      return <Navigate to={profile ? `/${profile}` : "/"} replace />;
    }
  }

  const isOnboardingRoute = location.pathname === "/onboarding/disorders";

  // Require onboarding for users until completed.
  // For demo users this is reset on each demo login; for real users it persists.
  if (
    userRole === "user" &&
    !isOnboardingRoute &&
    !user?.onboardingCompleted
  ) {
    return <Navigate to="/onboarding/disorders" replace />;
  }

  // Feature gate: if a feature key is required and not enabled, redirect home
  // Neutral redirect — no error message, never exposes what disorder the user
  // lacks.  The UI never says "you don't have X disorder".
  if (feature && userRole === "user" && !hasFeature(feature)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
