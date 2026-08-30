import { useEffect, Suspense, lazy } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './store/authStore'
import RootLayout from './components/RootLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Logo3D from './components/Logo3D'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy load route components
const Home = lazy(() => import('./components/Home'))
const Login = lazy(() => import('./components/Login'))
const Register = lazy(() => import('./components/Register'))
const About = lazy(() => import('./components/About'))
const Features = lazy(() => import('./components/Features'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const Market = lazy(() => import('./components/Market'))
const Watchlist = lazy(() => import('./components/Watchlist'))
const Portfolio = lazy(() => import('./components/Portfolio'))
const Transactions = lazy(() => import('./components/Transactions'))
const Analytics = lazy(() => import('./components/Analytics'))
const Profile = lazy(() => import('./components/Profile'))
const Accuracy = lazy(() => import('./components/ml/AccuracyPanel'))

// Role protection guard
const protect = (element) => (
  <ProtectedRoute allowedRoles={['USER']}>{element}</ProtectedRoute>
)

// Router definition
const routerObj = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'about', element: <About /> },
      { path: 'features', element: <Features /> },
      { path: 'dashboard', element: protect(<Dashboard />) },
      { path: 'markets', element: protect(<Market />) },
      { path: 'watchlist', element: protect(<Watchlist />) },
      { path: 'portfolio', element: protect(<Portfolio />) },
      { path: 'activity', element: protect(<Transactions />) },
      { path: 'analytics', element: protect(<Analytics />) },
      { path: 'accuracy', element: protect(<Accuracy />) },
      { path: 'profile', element: protect(<Profile />) },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])

export default function App() {
  const { fetchProfile } = useAuth()

  // Restore session on mount
  useEffect(() => {
    if (typeof fetchProfile === 'function') {
      fetchProfile()
    }
  }, [fetchProfile])

  return (
    <ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#151820',
            color: '#F5F7FA',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            fontSize: '13px'
          }
        }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4 text-xs text-[#3B82F6] font-mono">
            <Logo3D size="lg" />
            <div className="flex items-center gap-2 animate-pulse text-[#9CA3AF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></span>
              <span>Loading MarketForge...</span>
            </div>
          </div>
        }
      >
        <RouterProvider router={routerObj} />
      </Suspense>
    </ErrorBoundary>
  )
}
