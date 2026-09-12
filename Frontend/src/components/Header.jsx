import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { Menu, X, ArrowRight } from 'lucide-react'
import { useAuth } from '../store/authStore'
import Logo3D from './Logo3D'
import { Button } from './ui/Button'

// Floating chrome (cryptowl reference: fixed, zero bar background/border,
// pointer-events passthrough — blur lives only behind the pills).
export default function Header() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 pt-5">
        {/* Brand */}
        <div className="pointer-events-auto flex items-center gap-8">
          <NavLink to="/" className="flex items-center group" aria-label="MarketForge home">
            <Logo3D size="sm" showText={true} textClassName="text-base" />
          </NavLink>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `px-3 py-2 rounded-full text-[13px] font-semibold transition backdrop-blur-md ${
                  isActive
                    ? 'bg-white/[0.07] text-[#f8fdff] shadow-[0_2px_12px_rgba(0,0,0,0.35)]'
                    : 'text-[#b7c6cf] hover:text-[#f8fdff] hover:bg-white/[0.04]'
                }`
              }
            >
              About
            </NavLink>
            <NavLink
              to="/features"
              className={({ isActive }) =>
                `px-3 py-2 rounded-full text-[13px] font-semibold transition backdrop-blur-md ${
                  isActive
                    ? 'bg-white/[0.07] text-[#f8fdff] shadow-[0_2px_12px_rgba(0,0,0,0.35)]'
                    : 'text-[#b7c6cf] hover:text-[#f8fdff] hover:bg-white/[0.04]'
                }`
              }
            >
              Features
            </NavLink>
          </nav>
        </div>

        {/* Right CTA Actions (reference grammar: pill + text-link pair) */}
        <div className="pointer-events-auto hidden md:flex items-center gap-5">
          {isAuthenticated ? (
            <>
              <NavLink
                to="/profile"
                className="text-[13px] font-bold text-[#b7c6cf] underline decoration-[rgba(150,205,222,0.4)] underline-offset-8 transition hover:text-[#7ce6ff] hover:decoration-[#7ce6ff]"
              >
                Profile
              </NavLink>
              <Button
                onClick={() => navigate('/dashboard')}
                className="rounded-full px-4 py-2"
              >
                <span>Open Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="text-[13px] font-bold text-[#b7c6cf] underline decoration-[rgba(150,205,222,0.4)] underline-offset-8 transition hover:text-[#7ce6ff] hover:decoration-[#7ce6ff]"
              >
                Log In
              </NavLink>
              <NavLink
                to="/register"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1c83d8] hover:bg-[#2eafff] hover:shadow-[0_2px_20px_rgba(46,175,255,0.45)] text-[13px] font-semibold text-white shadow-[0_2px_16px_rgba(0,0,0,0.4)] transition"
              >
                <span>Get $100k Practice</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileMenuOpen}
          className="pointer-events-auto md:hidden p-2 rounded-full border border-[rgba(150,205,222,0.25)] bg-[rgba(12,18,27,0.55)] backdrop-blur-md text-[#b7c6cf] hover:text-[#f8fdff]"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu floating panel */}
      {mobileMenuOpen && (
        <div className="pointer-events-auto md:hidden mx-4 mt-2 rounded-2xl border border-[rgba(150,205,222,0.16)] bg-[rgba(7,9,13,0.92)] backdrop-blur-xl p-4 space-y-3 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-1 text-sm font-medium">
            <NavLink
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-[#b7c6cf] hover:text-white"
            >
              About
            </NavLink>
            <NavLink
              to="/features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-[#b7c6cf] hover:text-white"
            >
              Features
            </NavLink>
          </div>

          <div className="pt-3 border-t border-[rgba(150,205,222,0.12)] flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/dashboard')
                  }}
                  className="w-full py-2.5 rounded-full text-xs font-bold"
                >
                  Open Terminal
                </Button>
                <NavLink
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2 text-center text-xs font-bold text-[#b7c6cf] underline decoration-[rgba(150,205,222,0.4)] underline-offset-8"
                >
                  Profile
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2 rounded-full bg-[#1c83d8] text-center text-xs font-bold text-white"
                >
                  Get $100,000 Practice Account
                </NavLink>
                <NavLink
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2 text-center text-xs font-bold text-[#b7c6cf] underline decoration-[rgba(150,205,222,0.4)] underline-offset-8"
                >
                  Log In
                </NavLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
