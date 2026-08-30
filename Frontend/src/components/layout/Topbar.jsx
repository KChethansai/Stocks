import { useEffect, useState, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router'
import {
  Search,
  PlusCircle,
  Bell,
  Menu,
  User,
  History,
  LogOut,
  RefreshCw,
  Wallet
} from 'lucide-react'
import { useAuth } from '../../store/authStore'
import { useTrade } from '../../store/tradeStore'
import { formatCurrency } from '../../utils/marketAnalytics'
import toast from 'react-hot-toast'

export default function Topbar({ onOpenCommand, onOpenTrade, onToggleMobileNav }) {
  const { currentUser, logout } = useAuth()
  const { fetchStocks } = useTrade()
  const navigate = useNavigate()
  const [clock, setClock] = useState(new Date())
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isMarketOpen = clock.getHours() >= 9 && clock.getHours() < 16

  const handleManualRefresh = async () => {
    setRefreshing(true)
    await fetchStocks()
    toast.success('Live market data refreshed')
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleLogout = async () => {
    setUserDropdownOpen(false)
    const res = await logout()
    if (res.success) {
      toast.success(res.message || 'Logged out')
      navigate('/login')
    } else {
      toast.error(res.message || 'Logout failed')
    }
  }

  return (
    <header className="sticky top-0 z-30 h-[56px] w-full border-b border-[rgba(255,255,255,0.08)] bg-[#09090B]/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 sm:px-6 h-full">
        {/* Left: Mobile Menu & Command Palette Search Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileNav}
            className="md:hidden p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[#151820] transition"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search Trigger Button */}
          <button
            onClick={onOpenCommand}
            className="flex items-center gap-2.5 text-[#9CA3AF] hover:text-[#F5F7FA] transition-colors group bg-[#111318] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#3B82F6] cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#F5F7FA] transition-colors" />
            <span className="text-xs text-[#9CA3AF] font-normal hidden sm:inline">
              Search markets, symbols, commands...
            </span>
            <span className="text-xs text-[#9CA3AF] font-normal sm:hidden">
              Search...
            </span>
            <div className="flex items-center gap-1 ml-2 opacity-60">
              <kbd className="border border-[rgba(255,255,255,0.12)] bg-[#151820] rounded px-1 text-[10px] font-mono text-[#9CA3AF]">
                ⌘
              </kbd>
              <kbd className="border border-[rgba(255,255,255,0.12)] bg-[#151820] rounded px-1 text-[10px] font-mono text-[#9CA3AF]">
                K
              </kbd>
            </div>
          </button>
        </div>

        {/* Right Section: Market Status, Cash, Trade CTA, Notifications, Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Market Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111318]">
            <span className="relative flex h-2 w-2">
              {isMarketOpen ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
              )}
            </span>
            <span className="text-[11px] font-medium text-[#9CA3AF]">
              {isMarketOpen ? 'Market Open' : 'US Markets Live'}
            </span>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={handleManualRefresh}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[#151820] transition hidden sm:flex"
            title="Refresh market prices"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#3B82F6]' : ''}`} />
          </button>

          {/* Available Cash Chip */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111318]">
            <Wallet className="w-3.5 h-3.5 text-[#3B82F6]" />
            <div className="flex flex-col text-right">
              <span className="font-mono text-xs font-semibold text-[#F5F7FA]">
                {formatCurrency(currentUser?.balance ?? 100000)}
              </span>
            </div>
          </div>

          {/* Trade CTA Button */}
          <button
            onClick={onOpenTrade}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-sm transition active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Trade</span>
          </button>

          {/* Notifications Trigger */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[#151820] transition relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#3B82F6] rounded-full ring-2 ring-[#09090B]"></span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#151820] p-3 shadow-xl z-50 animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
                  <span className="text-xs font-semibold text-[#F5F7FA]">Market Alerts</span>
                  <span className="text-[10px] text-[#22C55E] font-mono">Live Feeds</span>
                </div>
                <div className="py-2 space-y-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#111318] border border-[rgba(255,255,255,0.04)]">
                    <p className="font-medium text-[#F5F7FA]">Paper Trading Active</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      Starting capital $100,000 ready to deploy.
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#111318] border border-[rgba(255,255,255,0.04)]">
                    <p className="font-medium text-[#F5F7FA]">Market Volatility</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      NVDA &amp; TSLA leading tech sector volume today.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#3B82F6]/50 transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#1c1b1d] border border-[rgba(255,255,255,0.12)] flex items-center justify-center font-bold text-xs text-[#3B82F6]">
                {currentUser?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#151820] p-1.5 shadow-2xl z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.08)] mb-1">
                  <p className="text-xs font-semibold text-[#F5F7FA]">
                    {currentUser?.username || 'Trader'}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF] truncate font-mono">
                    {currentUser?.email || 'trader@marketforge.app'}
                  </p>
                </div>

                <NavLink
                  to="/profile"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[#111318] rounded-lg transition"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Profile &amp; Settings</span>
                </NavLink>
                <NavLink
                  to="/activity"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[#111318] rounded-lg transition"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Activity Ledger</span>
                </NavLink>

                <div className="my-1 border-t border-[rgba(255,255,255,0.08)]"></div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition text-left cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
