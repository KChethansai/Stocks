import { useEffect, useState, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router'
import axios from 'axios'
import { motion, AnimatePresence } from 'motion/react'
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
import { Button } from '../ui/Button'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

const formatAlertTime = (date) => {
  const timestamp = new Date(date).getTime()
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

export default function Topbar({ onOpenCommand, onOpenTrade, onToggleMobileNav }) {
  const { currentUser, logout } = useAuth()
  const { fetchStocks } = useTrade()
  const navigate = useNavigate()
  const [clock, setClock] = useState(new Date())
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [alertsLoading, setAlertsLoading] = useState(false)
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

  useEffect(() => {
    if (!currentUser) {
      setAlerts([])
      setUnreadCount(0)
      return undefined
    }

    let cancelled = false
    const loadAlerts = async () => {
      setAlertsLoading(true)
      try {
        const { data } = await axios.get(`${API_BASE}/ml-api/alerts?includeRead=true`, { withCredentials: true })
        if (!cancelled) {
          setAlerts(data.alerts || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch {
        if (!cancelled) setAlerts([])
      } finally {
        if (!cancelled) setAlertsLoading(false)
      }
    }

    loadAlerts()
    const timer = setInterval(loadAlerts, 30000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [currentUser])

  const handleNotificationOpen = () => {
    setNotificationsOpen((open) => !open)
  }

  const handleMarkAlertRead = async (alert) => {
    if (alert.read) return
    try {
      await axios.patch(`${API_BASE}/ml-api/alerts/${alert._id}/read`, {}, { withCredentials: true })
      setAlerts((items) => items.map((item) => item._id === alert._id ? { ...item, read: true } : item))
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch {
      toast.error('Unable to update notification')
    }
  }

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
          <Button
            onClick={onOpenTrade}
            variant="primary"
            size="sm"
            className="rounded-lg"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Trade</span>
          </Button>

          {/* Notifications Trigger */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleNotificationOpen}
              className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[#151820] transition relative"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-[#3B82F6] text-[9px] leading-4 text-[#09090B] font-bold font-mono ring-2 ring-[#09090B]">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                  className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#151820] p-3 shadow-xl z-50"
                >
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
                  <span className="text-xs font-semibold text-[#F5F7FA]">Market Alerts</span>
                  <span className="text-[10px] text-[#22C55E] font-mono">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</span>
                </div>
                <div className="max-h-80 overflow-y-auto py-2 space-y-1 text-xs">
                  {alertsLoading && <p className="px-2 py-5 text-center text-[11px] text-[#9CA3AF]">Loading alerts…</p>}
                  {!alertsLoading && alerts.length === 0 && <p className="px-2 py-5 text-center text-[11px] text-[#9CA3AF]">No market alerts yet.</p>}
                  {!alertsLoading && alerts.map((alert) => (
                    <button key={alert._id} type="button" onClick={() => handleMarkAlertRead(alert)} className={`w-full rounded-lg border p-2.5 text-left transition ${alert.read ? 'border-white/[0.04] bg-[#111318]/60' : 'border-[#3B82F6]/20 bg-[#111318]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`font-mono font-semibold ${alert.direction === 'UP' ? 'text-[#22C55E]' : alert.direction === 'DOWN' ? 'text-[#EF4444]' : 'text-[#60A5FA]'}`}>{alert.symbol} · {alert.direction}</span>
                        <span className="shrink-0 text-[10px] text-[#667085]">{formatAlertTime(alert.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">{alert.message}</p>
                      <p className="mt-1 text-[10px] font-mono text-[#667085]">Confidence {Math.round((alert.confidence || 0) * 100)}%{!alert.read && ' · Click to mark read'}</p>
                    </button>
                  ))}
                </div>
                </motion.div>
              )}
            </AnimatePresence>
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

            <AnimatePresence>
              {userDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#151820] p-1.5 shadow-2xl z-50"
                >
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
