import { NavLink, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  TrendingUp,
  Bookmark,
  Briefcase,
  BarChart3,
  History,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wallet
} from 'lucide-react'
import { useAuth } from '../../store/authStore'
import { formatCurrency } from '../../utils/marketAnalytics'
import toast from 'react-hot-toast'
import Logo3D from '../Logo3D'

export default function Sidebar({ isCollapsed, onToggleCollapse }) {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Markets', path: '/markets', icon: TrendingUp },
    { label: 'Watchlist', path: '/watchlist', icon: Bookmark },
    { label: 'Portfolio', path: '/portfolio', icon: Briefcase },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Activity', path: '/activity', icon: History },
    { label: 'Profile', path: '/profile', icon: User }
  ]

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
      className={`hidden md:flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden border-r border-[rgba(255,255,255,0.08)] bg-[#06090F] transition-all duration-300 z-40 shrink-0 select-none ${
        isCollapsed ? 'w-20' : 'w-[260px]'
      }`}
    >
      {/* Brand Header */}
      <div className={`h-[56px] flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] ${isCollapsed ? 'px-2' : 'px-5'}`}>
        <NavLink to="/dashboard" className={`flex items-center gap-3 min-w-0 group ${isCollapsed ? 'justify-center' : ''}`}>
          <Logo3D size="xs" showText={false} />
          {!isCollapsed && (
            <div className="truncate">
              <span className="font-bold text-sm text-[#E8EEF7] tracking-tight block">
                MarketForge
              </span>
              <span className="text-[10px] text-[#5C6B7E] uppercase tracking-wider block font-mono">
                Trading Workspace
              </span>
            </div>
          )}
        </NavLink>

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded text-[#8B97A8] hover:text-[#E8EEF7] hover:bg-[rgba(255,255,255,0.06)] transition"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation Links */}
      <div className="min-h-0 flex-1 overflow-y-auto py-5 px-3 space-y-1">
        {!isCollapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#5C6B7E]">
            Workspace
          </p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition duration-150 group relative ${
                  isActive
                    ? 'bg-[#162235] text-[#3B82F6] font-semibold border-r-2 border-[#3B82F6]'
                    : 'text-[#8B97A8] hover:text-[#E8EEF7] hover:bg-[#0F1724]'
                } ${isCollapsed ? 'justify-center' : ''}`
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}

      </div>

      {/* Capital Summary Card */}
      {!isCollapsed && (
        <div className="mx-3 mb-3 p-3.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0F1724]">
          <div className="flex items-center justify-between text-[11px] text-[#8B97A8] mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Wallet className="w-3.5 h-3.5 text-[#3B82F6]" />
              Virtual Capital
            </span>
            <span className="text-[10px] font-mono text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded font-medium">
              Live
            </span>
          </div>
          <p className="font-mono text-sm font-semibold text-[#E8EEF7]">
            {formatCurrency(currentUser?.balance ?? 100000)}
          </p>
        </div>
      )}

      {/* User Footer Profile */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#1c1b1d] border border-[rgba(255,255,255,0.08)] flex items-center justify-center font-bold text-xs text-[#3B82F6] shrink-0">
            {currentUser?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className="truncate min-w-0">
              <p className="text-xs font-medium text-[#E8EEF7] truncate">
                {currentUser?.username || 'Trader'}
              </p>
              <p className="text-[10px] text-[#5C6B7E] truncate font-mono">
                {currentUser?.email || 'trader@marketforge.app'}
              </p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={handleLogout}
            className="p-1.5 rounded text-[#8B97A8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition ml-1"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  )
}