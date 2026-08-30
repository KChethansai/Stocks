import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import Footer from './Footer'
import Header from './Header'
import AppShell from './layout/AppShell'
import { useAuth } from '../store/authStore'

export default function RootLayout() {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const textPath = pathname.toLowerCase()
  const isAuthPage = ['/login', '/register'].includes(textPath)
  const isPublicMarketingPage = ['/', '/about', '/features'].includes(textPath)
  const isPublicRoute = isAuthPage || isPublicMarketingPage

  // Authenticated experience inside AppShell
  if (isAuthenticated && !isPublicRoute) {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    )
  }

  // Auth pages (Login/Register full screen)
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-[#09090B] text-[#F5F7FA]">
        <Outlet />
      </div>
    )
  }

  // Public marketing pages (Home, About, Features)
  return (
    <div className="flex min-h-screen flex-col bg-[#09090B] text-[#F5F7FA]">
      <Header />
      <main className="w-full grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
