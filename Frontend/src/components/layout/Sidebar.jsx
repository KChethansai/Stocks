import { NavLink, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  TrendingUp,
  Newspaper,
  Bookmark,
  Briefcase,
  BarChart3,
  History,
  User,
  Crosshair,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wallet
} from 'lucide-react'
import { useAuth } from '../../store/authStore'
import { fmtMoney } from '../../utils/format'
import toast from 'react-hot-toast'
import Logo3D from '../Logo3D'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Markets', path: '/markets', icon: TrendingUp },
      { label: 'News', path: '/news', icon: Newspaper },
      { label: 'Watchlist', path: '/watchlist', icon: Bookmark },
      { label: 'Portfolio', path: '/portfolio', icon: Briefcase }
    ]
  },
  {
    label: 'Analysis',
    items: [
      { label: 'Analytics', path: '/analytics', icon: BarChart3 },
      { label: 'Forecast accuracy', path: '/accuracy', icon: Crosshair },
      { label: 'Activity', path: '/activity', icon: History }
    ]
  },
  {
    label: 'Account',
    items: [{ label: 'Profile', path: '/profile', icon: User }]
  }
]

export default function Sidebar({ isCollapsed, onToggleCollapse }) {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Signed out successfully')
      navigate('/login')
    } catch {
      toast.error('Logout encountered an error')
    }
  }

  return (
    <aside
      aria-label="Primary"
      className={`hidden md:flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden border-r border-[var(--hairline)] bg-[var(--ink-950)] transition-all duration-300 z-40 shrink-0 select-none ${
        isCollapsed ? 'w-20' : 'w-[260px]'
      }`}
    >
      {/* Brand Header */}
      <div className={`h-[56px] flex items-center justify-between border-b border-[var(--hairline)] ${isCollapsed ? 'px-2' : 'px-5'}`}>
        <NavLink to="/dashboard" className={`flex items-center gap-3 min-w-0 group ${isCollapsed ? 'justify-center' : ''}`}>
          <Logo3D size="xs" showText={false} />
          {!isCollapsed && (
            <div className="truncate">
              <span className="font-bold text-sm text-[var(--ivory)] tracking-tight block">
                MarketForge
              </span>
              <span className="block text-xs text-[var(--stone)]">
                Trading workspace
              </span>
            </div>
          )}
        </NavLink>

        <button
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          className="p-1 rounded text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-white/[0.06] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation Links */}
      <nav className="min-h-0 flex-1 overflow-y-auto py-5 px-3 space-y-5" aria-label="Sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!isCollapsed && (
              <p className="px-3 pb-2 text-xs text-[var(--stone)]">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition duration-150 group ${
                        isActive
                          ? 'text-[var(--ivory)] font-semibold bg-white/[0.06]'
                          : 'text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-white/[0.04]'
                      } ${isCollapsed ? 'justify-center' : ''}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-[var(--brass)]"
                          />
                        )}
                        <Icon className="w-4 h-4 shrink-0" />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Cash balance (quiet row; account actions live in the Topbar menu) */}
      {!isCollapsed && (
        <div className="mx-3 mb-3 p-3.5 rounded-lg border border-[var(--hairline)] bg-[var(--ink-900)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--stone)] mb-1">
            <Wallet className="w-3.5 h-3.5 text-[var(--brass)]" />
            <span className="font-medium">Cash balance</span>
          </div>
          <p className="text-sm font-semibold tabular-nums text-[var(--ivory)]">
            {currentUser?.balance == null ? '—' : fmtMoney(currentUser.balance)}
          </p>
        </div>
      )}

      {/* Collapse-only sign out */}
      {isCollapsed && (
        <div className="p-3 border-t border-[var(--hairline)] flex justify-center">
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            className="p-1.5 rounded text-[var(--stone)] hover:text-[var(--loss)] hover:bg-[var(--loss)]/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  )
}
