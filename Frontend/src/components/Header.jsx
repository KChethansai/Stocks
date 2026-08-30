import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { Menu, X, ArrowRight } from 'lucide-react'
import { useAuth } from '../store/authStore'
import Logo3D from './Logo3D'
import { Button } from './ui/Button'

export default function Header() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#09090B]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center group">
            <Logo3D size="sm" showText={true} textClassName="text-base" />
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-[rgba(255,255,255,0.08)] text-[#F5F7FA]'
                    : 'text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[rgba(255,255,255,0.04)]'
                }`
              }
            >
              About
            </NavLink>
            <NavLink
              to="/features"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-[rgba(255,255,255,0.08)] text-[#F5F7FA]'
                    : 'text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[rgba(255,255,255,0.04)]'
                }`
              }
            >
              Features
            </NavLink>
          </nav>
        </div>

        {/* Right CTA Actions */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Button
              onClick={() => navigate('/dashboard')}
              className="rounded-xl px-4 py-2"
            >
              <span>Open Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <>
              <NavLink
                to="/login"
                className="px-3.5 py-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111318] hover:bg-[#151820] text-xs font-semibold text-[#F5F7FA] transition"
              >
                Log In
              </NavLink>
              <NavLink
                to="/register"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-xs font-semibold text-white shadow-sm transition"
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
          className="md:hidden p-2 text-[#9CA3AF] hover:text-[#F5F7FA]"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu modal */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[rgba(255,255,255,0.08)] bg-[#09090B] p-4 space-y-3">
          <div className="flex flex-col gap-1 text-sm font-medium">
            <NavLink
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-[#9CA3AF] hover:text-white"
            >
              About
            </NavLink>
            <NavLink
              to="/features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-[#9CA3AF] hover:text-white"
            >
              Features
            </NavLink>
          </div>

          <div className="pt-3 border-t border-[rgba(255,255,255,0.08)] flex flex-col gap-2">
            {isAuthenticated ? (
              <Button
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/dashboard')
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold"
              >
                Open Terminal
              </Button>
            ) : (
              <>
                <NavLink
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2 rounded-xl border border-[rgba(255,255,255,0.12)] text-center text-xs font-semibold text-[#F5F7FA]"
                >
                  Log In
                </NavLink>
                <NavLink
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2 rounded-xl bg-[#3B82F6] text-center text-xs font-bold text-white"
                >
                  Get $100,000 Practice Account
                </NavLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
