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
import { mergeAlertsWithConfirmed } from '../../utils/alertMerge'
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
  const { fetchStocks, stocks } = useTrade()
  const navigate = useNavigate()
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  // Locally-confirmed reads: the 30 s poll replaces the list wholesale, so
  // without this a confirmed read could flip back to unread on the next poll.
  // Pruned on every poll to rows that still exist server-side.
  const confirmedReads = useRef(new Set())
  const pendingReads = useRef(new Set())
  const accountId = currentUser?._id || currentUser?.id || null
  const activeAccount = useRef(accountId)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false)
      }
    }
    // D8: Escape closes open menus and returns focus to the trigger.
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return
      if (notificationsOpen) {
        setNotificationsOpen(false)
        notifRef.current?.querySelector('button')?.focus()
      } else if (userDropdownOpen) {
        setUserDropdownOpen(false)
        dropdownRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [notificationsOpen, userDropdownOpen])

  // Phase 0: market status stays unknown until a verified provider/calendar
  // ships. Show truthful quote timestamps instead of a guessed open/closed
  // pill. Verified Yahoo rows carry lastVerifiedAt; legacy rows are unverified.
  const verifiedTimes = (stocks || []).map((s) => s.lastVerifiedAt ? new Date(s.lastVerifiedAt).getTime() : 0).filter(Boolean)
  const latestVerifiedAt = verifiedTimes.length ? Math.max(...verifiedTimes) : 0
  const anyStale = (stocks || []).some((s) => s.stale || !s.lastVerifiedAt)

  useEffect(() => {
    activeAccount.current = accountId
    confirmedReads.current = new Set()
    pendingReads.current = new Set()
    setMarkingAllRead(false)
    setAlerts([])
    setUnreadCount(0)
    if (!accountId) {
      return undefined
    }

    let cancelled = false
    const loadAlerts = async () => {
      setAlertsLoading(true)
      try {
        const { data } = await axios.get(`${API_BASE}/ml-api/alerts?includeRead=true`, { withCredentials: true })
        if (!cancelled) {
          const merged = mergeAlertsWithConfirmed(data.alerts || [], confirmedReads.current, data.unreadCount)
          confirmedReads.current = merged.liveConfirmedIds
          setAlerts(merged.alerts)
          // Global unread count includes events outside the latest-50 window.
          setUnreadCount(merged.unreadCount)
        }
      } catch {
        // Keep the last confirmed inbox on transient poll failure.
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
  }, [accountId])

  const handleNotificationOpen = () => {
    setNotificationsOpen((open) => !open)
  }

  const handleMarkAlertRead = async (alert) => {
    if (alert.read) return
    const id = String(alert._id)
    if (pendingReads.current.has(id)) return
    const owner = accountId
    pendingReads.current.add(id)
    // Confirm locally first so the next poll cannot resurrect the row; the
    // server PATCH below is the durable write (ownership-enforced).
    confirmedReads.current = new Set(confirmedReads.current).add(id)
    setAlerts((items) => items.map((item) => String(item._id) === id ? { ...item, read: true } : item))
    setUnreadCount((count) => Math.max(0, count - 1))
    try {
      await axios.patch(`${API_BASE}/ml-api/alerts/${alert._id}/read`, {}, { withCredentials: true })
    } catch {
      if (activeAccount.current !== owner) return
      confirmedReads.current = new Set([...confirmedReads.current].filter((x) => x !== id))
      setAlerts((items) => items.map((item) => String(item._id) === id ? { ...item, read: false } : item))
      setUnreadCount((count) => count + 1)
      toast.error('Unable to update notification')
    } finally {
      if (activeAccount.current === owner) pendingReads.current.delete(id)
    }
  }

  const handleMarkAllRead = async () => {
    const unread = alerts.filter((a) => !a.read && !pendingReads.current.has(String(a._id)))
    if (!unread.length || markingAllRead) return
    const owner = accountId
    setMarkingAllRead(true)
    unread.forEach((a) => pendingReads.current.add(String(a._id)))
    try {
      const results = await Promise.allSettled(
        unread.map((alert) =>
          axios.patch(`${API_BASE}/ml-api/alerts/${alert._id}/read`, {}, { withCredentials: true })
        )
      )
      if (activeAccount.current !== owner) return
      const ids = new Set(unread.filter((_, i) => results[i].status === 'fulfilled').map((a) => String(a._id)))
      confirmedReads.current = new Set([...confirmedReads.current, ...ids])
      setAlerts((items) => items.map((item) => (ids.has(String(item._id)) ? { ...item, read: true } : item)))
      setUnreadCount((count) => Math.max(0, count - ids.size))
      if (ids.size !== unread.length) toast.error('Some notifications could not be marked read. Retry the remaining alerts.')
    } catch {
      toast.error('Unable to mark all notifications read')
    } finally {
      if (activeAccount.current === owner) {
        unread.forEach((a) => pendingReads.current.delete(String(a._id)))
        setMarkingAllRead(false)
      }
    }
  }

  const handleManualRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    const result = await fetchStocks()
    if (result?.success && result?.stale) {
      // Distinguish "the provider is unreachable" (transient, prices are
      // still the last genuine close) from "this data is not usable".
      toast(
        result.providerUnavailableAt
          ? 'Data provider unreachable — showing the last verified close, with its as-of time.'
          : `Some quotes are not usable${result.usableCount != null ? ` (${result.usableCount}/${result.totalCount} verified)` : ''} — each shows its as-of time.`,
        { icon: '⚠' }
      )
    } else if (result?.success) {
      toast.success('Market data refreshed')
    } else {
      toast.error(result?.message || 'Market data refresh failed')
    }
    setTimeout(() => setRefreshing(false), 600)
  }

  const quoteLabel = latestVerifiedAt
    ? `Quotes as of ${new Date(latestVerifiedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}${anyStale ? ' · some stale' : ''}`
    : 'Quotes unavailable'

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
    <header className="sticky top-0 z-30 h-[56px] w-full border-b border-[rgba(255,255,255,0.08)] bg-[#0B0C0E]/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 sm:px-6 h-full">
        {/* Left: Mobile Menu & Command Palette Search Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileNav}
            className="md:hidden p-1.5 rounded-lg text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-[#181B1F] transition"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search Trigger Button */}
          <button
            onClick={onOpenCommand}
            aria-label="Search markets, symbols, and commands"
            className="flex items-center gap-2.5 text-[var(--stone)] hover:text-[var(--ivory)] transition-colors group bg-[#111316] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)] rounded-lg px-3 py-1.5 max-[479px]:px-2 max-[479px]:min-w-[44px] max-[479px]:min-h-[44px] max-[479px]:justify-center focus:outline-none focus:border-[var(--brass)] cursor-pointer"
          >
            <Search className="w-4 h-4 text-[var(--stone)] group-hover:text-[var(--ivory)] transition-colors" aria-hidden="true" />
            <span className="text-xs text-[var(--stone)] font-normal hidden sm:inline whitespace-nowrap">
              Search markets, symbols, commands...
            </span>
            <span className="text-xs text-[var(--stone)] font-normal hidden min-[480px]:inline sm:hidden whitespace-nowrap">
              Search...
            </span>
            <div className="hidden xl:flex items-center gap-1 ml-2 opacity-60">
              <kbd className="border border-[rgba(255,255,255,0.12)] bg-[#181B1F] rounded px-1 text-[10px] font-mono text-[var(--stone)]">
                ⌘
              </kbd>
              <kbd className="border border-[rgba(255,255,255,0.12)] bg-[#181B1F] rounded px-1 text-[10px] font-mono text-[var(--stone)]">
                K
              </kbd>
            </div>
          </button>
        </div>

        {/* Right Section: Market Status, Cash, Trade CTA, Notifications, Profile */}
        <div className="flex items-center gap-1.5 min-[480px]:gap-2 sm:gap-4 shrink-0 min-w-0">
          {/* Quote status + refresh (D8): one merged button on lg+ — the pill
              carries the timestamp label, the trailing icon is the manual
              refresh. Never a title-only control. */}
          <button
            type="button"
            onClick={handleManualRefresh}
            aria-label={`Refresh market prices. ${quoteLabel}`}
            aria-disabled={refreshing}
            title="Market status unknown until a verified exchange calendar ships — click to refresh"
            className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111316] shrink-0 max-w-[220px] text-[var(--stone)] hover:text-[var(--ivory)] hover:border-[rgba(255,255,255,0.16)] transition focus:outline-none focus:border-[var(--brass)] cursor-pointer"
          >
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--stone-muted)] shrink-0" aria-hidden="true"></span>
            <span className="text-xs font-medium whitespace-nowrap truncate">
              {quoteLabel}
            </span>
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin text-[var(--brass)]' : ''}`} aria-hidden="true" />
          </button>

          {/* Standalone refresh 480px–lg (D8): exactly one refresh affordance
              per viewport — merged-in-pill on lg+, this icon on 480–lg, and
              the palette "Refresh prices" action (touch-reachable via the
              search trigger) below 480px where every pixel is needed. */}
          <button
            type="button"
            onClick={handleManualRefresh}
            aria-label="Refresh market prices"
            className="hidden min-[480px]:inline-flex lg:hidden p-2 min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-[#181B1F] transition focus:outline-none focus:border-[var(--brass)]"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[var(--brass)]' : ''}`} aria-hidden="true" />
          </button>

          {/* Available Cash Chip (D8): always visible in compact form — below
              lg the sidebar is absent and the drawer closed, so this is the
              only balance on small phones. Same store field as sidebar card. */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 max-[479px]:px-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111316] shrink-0 max-w-[68px] min-[480px]:max-w-[92px] sm:max-w-[132px]"
            title={currentUser?.balance == null ? 'Balance unavailable' : `Available cash: ${formatCurrency(currentUser.balance)}`}
          >
            <Wallet className="w-3.5 h-3.5 text-[var(--brass)] shrink-0 max-[479px]:hidden" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-[var(--ivory)] tabular-nums truncate">
              {currentUser?.balance == null ? '—' : formatCurrency(currentUser.balance)}
            </span>
          </div>

          {/* Trade CTA Button (label always visible; icon hides <480px) */}
          <Button
            onClick={onOpenTrade}
            variant="primary"
            size="sm"
            className="rounded-lg max-[479px]:[&_svg]:hidden max-[479px]:px-3 shrink-0 min-h-[44px]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Trade</span>
          </Button>

          {/* Notifications Trigger */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleNotificationOpen}
              className="p-1.5 rounded-lg text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-[#181B1F] transition relative min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
              aria-label={unreadCount > 0 ? `${unreadCount} unread alerts. Open notifications` : 'Notifications'}
              aria-expanded={notificationsOpen}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--brass)] text-[10px] leading-4 text-[#0B0C0E] font-bold font-mono ring-2 ring-[#0B0C0E]">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                  className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#181B1F] p-3 shadow-xl z-50"
                >
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
                  <span className="text-xs font-semibold text-[var(--ivory)]">Market Alerts</span>
                  <span className="mf-badge text-[var(--gain)] font-mono">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</span>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead}
                    className="mt-2 w-full rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1.5 text-[11px] font-mono text-[var(--stone)] transition hover:text-[var(--ivory)] disabled:opacity-40"
                  >
                    {markingAllRead ? 'Marking read…' : 'Mark displayed alerts read'}
                  </button>
                )}
                <div className="max-h-80 overflow-y-auto py-2 space-y-1 text-xs">
                  {alertsLoading && <p className="px-2 py-5 text-center mf-meta">Loading alerts…</p>}
                  {!alertsLoading && alerts.length === 0 && <p className="px-2 py-5 text-center mf-meta">No market alerts yet.</p>}
                  {!alertsLoading && alerts.map((alert) => (
                    <button key={alert._id} type="button" onClick={() => handleMarkAlertRead(alert)} className={`w-full rounded-lg border p-2.5 text-left transition ${alert.read ? 'border-white/[0.04] bg-[#111316]/60' : 'border-[var(--brass)]/20 bg-[#111316]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`font-mono font-semibold ${alert.direction === 'UP' ? 'text-[var(--gain)]' : alert.direction === 'DOWN' ? 'text-[var(--loss)]' : 'text-[var(--stone-muted)]'}`}>{alert.symbol} · {alert.direction}</span>
                        <span className="shrink-0 mf-meta font-mono">{formatAlertTime(alert.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--stone)]">{alert.message}</p>
                      <p className="mt-1 mf-meta font-mono">Confidence {Math.round((alert.confidence || 0) * 100)}%{!alert.read && ' · Click to mark read'}</p>
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
              aria-label={currentUser?.username ? `Account menu for ${currentUser.username}` : 'Account menu'}
              aria-expanded={userDropdownOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[rgba(201,169,110,.5)] transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--ink-800)] border border-[var(--hairline)] flex items-center justify-center font-bold text-xs text-[var(--ivory)]">
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
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#181B1F] p-1.5 shadow-2xl z-50"
                >
                <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.08)] mb-1">
                  <p className="text-xs font-semibold text-[var(--ivory)]">
                    {currentUser?.username || 'Trader'}
                  </p>
                  <p className="mf-meta truncate font-mono">
                    {currentUser?.email || 'trader@marketforge.app'}
                  </p>
                </div>

                <NavLink
                  to="/profile"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-[#111316] rounded-lg transition"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Profile &amp; Settings</span>
                </NavLink>
                <NavLink
                  to="/activity"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-[#111316] rounded-lg transition"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Activity Ledger</span>
                </NavLink>

                <div className="my-1 border-t border-[rgba(255,255,255,0.08)]"></div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--loss)] hover:bg-[var(--loss)]/10 rounded-lg transition text-left cursor-pointer"
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
