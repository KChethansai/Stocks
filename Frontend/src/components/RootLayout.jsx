import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AnimatePresence, MotionConfig } from 'motion/react'
import Footer from './Footer'
import Header from './Header'
import AppShell from './layout/AppShell'
import LandingPreloader from './landing/LandingPreloader'
import { useAuth } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

// One-time-per-page-load guard: RootLayout remounts whenever Suspense
// swaps in a route fallback (lazy chunks), which would otherwise reset
// landingReady and replay the preloader. Module scope resets naturally
// on full page load, so every COLD load of / still plays it.
let landingSplashShown = false

export default function RootLayout() {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()
  const motionMode = useUiStore((s) => s.motionMode)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Couple motion preference to CSS (index.css comfort rules read this attr)
  useEffect(() => {
    document.documentElement.dataset.motion = motionMode
  }, [motionMode])

  const textPath = pathname.toLowerCase()
  const isAuthPage = ['/login', '/register'].includes(textPath)
  const isPublicMarketingPage = ['/', '/about', '/features'].includes(textPath)
  const isPublicRoute = isAuthPage || isPublicMarketingPage

  // Landing preloader gate: public marketing shell mounts its content only
  // after the preloader completes + unmounts, so GSAP ScrollTrigger
  // measurements in scenes run against the final layout (never while the
  // overlay covers the viewport). Landing scope only — auth pages and the
  // authenticated AppShell are untouched.
  const [landingReady, setLandingReady] = useState(
    !isPublicMarketingPage || landingSplashShown
  )
  const handleSplashDone = () => {
    landingSplashShown = true
    setLandingReady(true)
  }

  let shell
  // Authenticated experience inside AppShell
  if (isAuthenticated && !isPublicRoute) {
    shell = (
      <AppShell>
        <Outlet />
      </AppShell>
    )
  } else if (isAuthPage) {
    // Auth pages (Login/Register full screen) — landing token scope
    shell = (
      <div data-landing className="min-h-screen bg-bg-primary text-text-primary">
        <Outlet />
      </div>
    )
  } else {
    // Public marketing pages (Home, About, Features) — landing token scope.
    // Content mounts only after the preloader exits (mode="wait" sequences
    // exit-before-enter), so scene ScrollTriggers measure the final layout.
    shell = (
      <div data-landing className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
        {/* No mode="wait": there is never an entering sibling here, so wait
            only risks hanging the exit. Content below mounts independently. */}
        <AnimatePresence>
          {!landingReady && (
            <LandingPreloader key="landing-preloader" onDone={handleSplashDone} />
          )}
        </AnimatePresence>
        {landingReady && (
          <>
            <Header />
            <main className="w-full grow">
              <Outlet />
            </main>
            <Footer />
          </>
        )}
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