import { Link, Navigate } from 'react-router'
import { useAuth } from '../store/authStore'
import { ShellSkeleton } from './ui/Skeleton'

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, currentUser, initializing } = useAuth()

  // Shell skeleton while the session restores — layout mirrors the app.
  if (initializing) {
    return <ShellSkeleton />
  }

  // Redirect to login if not authenticated.
  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Explicit denied state instead of a silent redirect.
  if (allowedRoles && !allowedRoles.includes(currentUser?.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ink-950)] px-4">
        <div className="w-full max-w-sm rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] p-6 text-center">
          <h1 className="text-base font-semibold text-[var(--ivory)]">Access denied</h1>
          <p className="mt-2 text-[13px] text-[var(--stone)]">
            Your account does not have access to this section.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-block rounded-lg bg-[var(--ivory)] px-4 py-2 text-xs font-semibold text-[#0B0C0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Render children if authorized.
  return children
}

export default ProtectedRoute
