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
  X,
  Wallet
} from 'lucide-react'
import Logo3D from '../Logo3D'
import { useAuth } from '../../store/authStore'
import { formatCurrency } from '../../utils/marketAnalytics'
import toast from 'react-hot-toast'

export function MobileDrawer({ isOpen, onClose }) {
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
      <div className="relative w-4/5 max-w-xs bg-[#09090B] border-r border-[rgba(255,255,255,0.08)] flex flex-col h-full z-10 p-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2.5">
            <Logo3D size="xs" showText={true} textClassName="text-sm" />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#F5F7FA]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="my-4 p-3 rounded-xl bg-[#111318] border border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-1">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-[#3B82F6]" /> Virtual Balance
            </span>
            <span className="text-[0.65rem] font-mono text-[#22C55E]">Active</span>
          </div>
          <p className="text-base font-bold font-mono text-[#F5F7FA]">
            {formatCurrency(currentUser?.balance || 0)}
          </p>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-[#3B82F6]/15 text-[#3B82F6] font-semibold border border-[#3B82F6]/25'
                      : 'text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[rgba(255,255,255,0.04)]'
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
              <div className="w-8 h-8 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] flex items-center justify-center text-xs font-bold shrink-0">
                {(currentUser?.username || 'U')[0].toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-[#F5F7FA] truncate">
                  {currentUser?.username || 'Trader'}
                </p>
                <p className="text-[0.65rem] text-[#667085] truncate">
                  {currentUser?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition"
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090B]/95 backdrop-blur-md border-t border-[rgba(255,255,255,0.08)] px-2 py-1.5 flex items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[0.65rem] font-medium transition ${
                isActive ? 'text-[#3B82F6] font-semibold' : 'text-[#9CA3AF] hover:text-[#F5F7FA]'
              }`
            }
          >
            <Icon className="w-4 h-4 mb-0.5" />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
