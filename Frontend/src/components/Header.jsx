import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../store/authStore'
import Logo3D from './Logo3D'
import { Button } from './ui/Button'

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] ${
    isActive ? 'text-[var(--ivory)]' : 'text-[var(--stone)] hover:text-[var(--ivory)]'
  }`

export default function Header() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors ${
        scrolled
          ? 'border-b border-[var(--hairline)] bg-[var(--ink-950)]/90 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="flex items-center" aria-label="MarketForge home">
            <Logo3D size="sm" showText={true} textClassName="text-base" />
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <NavLink to="/about" className={linkClass}>
              About
            </NavLink>
            <NavLink to="/features" className={linkClass}>
              Features
            </NavLink>
            <a href="/#how" className="rounded-md px-3 py-2 text-sm font-medium text-[var(--stone)] transition hover:text-[var(--ivory)]">
              How it works
            </a>
          </nav>
        </div>

        <div className="hidden items-center gap-5 md:flex">
          {isAuthenticated ? (
            <>
              <NavLink to="/profile" className={linkClass}>
                Profile
              </NavLink>
              <Button onClick={() => navigate('/dashboard')} size="sm">
                Open dashboard
              </Button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                Sign in
              </NavLink>
              <Button onClick={() => navigate('/register')} size="sm">
                Open practice account
              </Button>
            </>
          )}
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileMenuOpen}
          className="rounded-lg p-2 text-[var(--stone)] transition hover:text-[var(--ivory)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] md:hidden"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-[var(--hairline)] bg-[var(--ink-950)]/95 px-4 py-4 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1 text-sm font-medium">
            <NavLink to="/about" onClick={() => setMobileMenuOpen(false)} className={linkClass}>
              About
            </NavLink>
            <NavLink to="/features" onClick={() => setMobileMenuOpen(false)} className={linkClass}>
              Features
            </NavLink>
            <a href="/#how" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-[var(--stone)] transition hover:text-[var(--ivory)]">
              How it works
            </a>
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-[var(--hairline)] pt-3">
            {isAuthenticated ? (
              <Button
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/dashboard')
                }}
                className="w-full"
              >
                Open dashboard
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/register')
                  }}
                  className="w-full"
                >
                  Open practice account
                </Button>
                <NavLink
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 text-center text-xs font-medium text-[var(--stone)]"
                >
                  Sign in
                </NavLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
