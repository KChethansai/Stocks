import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { MotionConfig } from 'motion/react'
import Footer from './Footer'
import Header from './Header'
import AppShell from './layout/AppShell'
import { useAuth } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

export default function RootLayout() {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()
  const motionMode = useUiStore((s) => s.motionMode)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const textPath = pathname.toLowerCase()
  const isAuthPage = ['/login', '/register'].includes(textPath)
  const isPublicMarketingPage = ['/', '/about', '/features'].includes(textPath)
  const isPublicRoute = isAuthPage || isPublicMarketingPage

  let shell
  // Authenticated experience inside AppShell
  if (isAuthenticated && !isPublicRoute) {
    shell = (
      <AppShell>
        <Outlet />
      </AppShell>
    )
  } else if (isAuthPage) {
    // Auth pages (Login/Register full screen)
    shell = (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <Outlet />
      </div>
    )
  } else {
    // Public marketing pages (Home, About, Features)
    shell = (
      <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
        <Header />
        <main className="w-full grow">
          <Outlet />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <MotionConfig
      reducedMotion={motionMode === 'comfort' ? 'always' : 'user'}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {shell}
    </MotionConfig>
  )
}