import { NavLink, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  TrendingUp,
  Newspaper,
  Bookmark,
  Briefcase,
  BarChart3,
  Crosshair,
  History,
  User,
  LogOut,
  X,
  Wallet
} from 'lucide-react'
import Logo3D from '../Logo3D'
import { useAuth } from '../../store/authStore'
import { fmtMoney } from '../../utils/format'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Markets', path: '/markets', icon: TrendingUp },
  { label: 'News', path: '/news', icon: Newspaper },
  { label: 'Watchlist', path: '/watchlist', icon: Bookmark },
  { label: 'Portfolio', path: '/portfolio', icon: Briefcase },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Forecast accuracy', path: '/accuracy', icon: Crosshair },
  { label: 'Activity', path: '/activity', icon: History },
  { label: 'Profile', path: '/profile', icon: User }
]

export function MobileDrawer({ isOpen, onClose }) {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Signed out successfully')
      navigate('/login')
      onClose()
    } catch {
      toast.error('Logout encountered an error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose}></div>

      {/* Drawer Panel */}
      <div className="relative w-4/5 max-w-xs bg-[#0B0C0E] border-r border-[rgba(255,255,255,0.08)] flex flex-col h-full z-10 p-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2.5">
            <Logo3D size="xs" showText={true} textClassName="text-sm" />
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1 rounded-lg text-[var(--stone)] hover:text-[var(--ivory)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="my-4 p-3 rounded-xl bg-[#111316] border border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between text-xs text-[var(--stone)] mb-1">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-[var(--brass)]" /> Cash balance
            </span>
          </div>
          <p className="text-base font-bold font-mono text-[var(--ivory)]">
            {currentUser?.balance == null ? '—' : fmtMoney(currentUser.balance)}
          </p>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-[var(--brass)]/15 text-[var(--brass)] font-semibold border border-[var(--brass)]/25'
                      : 'text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-[rgba(255,255,255,0.04)]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>

        {/* User Footer */}
        <div className="pt-4 border-t border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--ink-800)] text-[var(--ivory)] border border-[var(--hairline)] flex items-center justify-center text-xs font-bold shrink-0">
                {(currentUser?.username || 'U')[0].toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-[var(--ivory)] truncate">
                  {currentUser?.username || 'Trader'}
                </p>
                <p className="mf-meta truncate">
                  {currentUser?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-[var(--loss)] hover:bg-[var(--loss)]/10 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MobileBottomNav() {
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Markets', path: '/markets', icon: TrendingUp },
    { label: 'Watchlist', path: '/watchlist', icon: Bookmark },
    { label: 'Portfolio', path: '/portfolio', icon: Briefcase },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  ]

  return (
    <nav aria-label="Primary" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0C0E]/95 backdrop-blur-md border-t border-[rgba(255,255,255,0.08)] px-2 pt-1.5 flex items-center justify-around" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}>
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            aria-label={item.label}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[0.65rem] font-medium transition min-h-[44px] min-w-[44px] ${
                isActive ? 'text-[var(--brass)] font-semibold' : 'text-[var(--stone)] hover:text-[var(--ivory)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 mb-0.5" aria-hidden="true" />
                <span>{item.label}</span>
                {isActive && (
                  <span aria-hidden="true" className="absolute top-0 h-[2px] w-6 rounded-full bg-[var(--brass)]" />
                )}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
