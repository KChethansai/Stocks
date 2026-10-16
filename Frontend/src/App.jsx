import { useEffect, Suspense } from 'react'
import { lazyWithRetry } from './lib/lazyWithRetry'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './store/authStore'
import { setupSessionExpiry } from './lib/session'
import RootLayout from './components/RootLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Logo3D from './components/Logo3D'
import ErrorBoundary from './components/ErrorBoundary'
import RouteError from './components/RouteError'

// Marketing routes ship with the initial bundle: RootLayout's landing
// preloader covers cold paint, and a lazy Home/About/Features would make
// Suspense unmount the whole tree (restarting the preloader) on first load.
import HomeNew from './components/landing-new/HomeNew'
import About from './components/About'
import Features from './components/Features'
import NotFound from './components/NotFound'

// Lazy load route components
const Login = lazyWithRetry(() => import('./components/Login'))
const Register = lazyWithRetry(() => import('./components/Register'))
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'))
const Market = lazyWithRetry(() => import('./components/Market'))
const News = lazyWithRetry(() => import('./components/News'))
const Watchlist = lazyWithRetry(() => import('./components/Watchlist'))
const Portfolio = lazyWithRetry(() => import('./components/Portfolio'))
const Transactions = lazyWithRetry(() => import('./components/Transactions'))
const Analytics = lazyWithRetry(() => import('./components/Analytics'))
const Profile = lazyWithRetry(() => import('./components/Profile'))
const Accuracy = lazyWithRetry(() => import('./components/ml/AccuracyPanel'))

// Role protection guard
const protect = (element) => (
  <ProtectedRoute allowedRoles={['USER']}>{element}</ProtectedRoute>
)

const PUBLIC_TITLES = {
  '/': 'Practice with real prices. Risk nothing.',
  '/login': 'Sign in',
  '/register': 'Create account',
  '/about': 'About',
  '/features': 'Features'
}

// Router definition
const routerObj = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomeNew />, handle: { title: PUBLIC_TITLES['/'] } },
      { path: 'login', element: <Login />, handle: { title: PUBLIC_TITLES['/login'] }, errorElement: <RouteError /> },
      { path: 'register', element: <Register />, handle: { title: PUBLIC_TITLES['/register'] }, errorElement: <RouteError /> },
      { path: 'about', element: <About />, handle: { title: PUBLIC_TITLES['/about'] } },
      { path: 'features', element: <Features />, handle: { title: PUBLIC_TITLES['/features'] } },
      { path: 'dashboard', element: protect(<Dashboard />), errorElement: <RouteError /> },
      { path: 'markets', element: protect(<Market />), errorElement: <RouteError /> },
      { path: 'news', element: protect(<News />), errorElement: <RouteError /> },
      { path: 'watchlist', element: protect(<Watchlist />), errorElement: <RouteError /> },
      { path: 'portfolio', element: protect(<Portfolio />), errorElement: <RouteError /> },
      { path: 'activity', element: protect(<Transactions />), errorElement: <RouteError /> },
      { path: 'analytics', element: protect(<Analytics />), errorElement: <RouteError /> },
      { path: 'accuracy', element: protect(<Accuracy />), errorElement: <RouteError /> },
      { path: 'profile', element: protect(<Profile />), errorElement: <RouteError /> },
      { path: '*', element: <NotFound />, handle: { title: 'Page not found' } }
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

  // Global session-expiry handling (see lib/session for the contract).
  useEffect(() => setupSessionExpiry(), [])

  return (
    <ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#181B1F',
            color: '#ECE9E2',
            border: '1px solid rgba(236, 233, 226, 0.14)',
            borderRadius: '12px',
            fontSize: '13px'
          }
        }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0B0C0E] flex flex-col items-center justify-center gap-4 text-xs text-[var(--brass)]">
            <Logo3D size="lg" />
            <div className="flex items-center gap-2 text-[var(--stone)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brass)]"></span>
              <span>Loading MarketForge…</span>
            </div>
          </div>
        }
      >
        <RouterProvider router={routerObj} />
      </Suspense>
    </ErrorBoundary>
  )
}
