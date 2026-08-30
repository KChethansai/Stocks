import { Navigate } from 'react-router'
import { useAuth } from '../store/authStore'

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, currentUser, initializing } = useAuth()

  //show loading while initializing
  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090B] px-4 font-mono text-xs text-[#3B82F6]">
        <p className="flex items-center gap-2">Loading...</p>
      </div>
    )
  }

  //redirect to login if not authenticated
  if (!isAuthenticated) return <Navigate to="/login" replace />

  //check user roles
  if (allowedRoles && !allowedRoles.includes(currentUser?.role)) {
    return <Navigate to="/markets" replace />
  }

  //render children if authorized
  return children
}

export default ProtectedRoute
