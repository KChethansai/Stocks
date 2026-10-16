import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { MobileDrawer, MobileBottomNav } from './MobileNav'
import CommandPalette from './CommandPalette'
import TradeModal from './TradeModal'
import { ShellContext } from './ShellContext'
import { useTrade } from '../../store/tradeStore'

const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/markets': 'Markets',
  '/news': 'News',
  '/watchlist': 'Watchlist',
  '/portfolio': 'Portfolio',
  '/activity': 'Activity',
  '/analytics': 'Analytics',
  '/accuracy': 'Forecast accuracy',
  '/profile': 'Profile'
}

export default function AppShell({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('mf-sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [tradeModalStock, setTradeModalStock] = useState(null)
  const [tradeModalSide, setTradeModalSide] = useState('BUY')
  const [tradeOpen, setTradeOpen] = useState(false)
  const mainRef = useRef(null)
  const { pathname } = useLocation()

  // Per-route document titles.
  useEffect(() => {
    const title = ROUTE_TITLES[pathname] || 'MarketForge'
    document.title = `${title} — MarketForge`
  }, [pathname])

  // Route-change focus: move focus to the page h1 so keyboard and screen
  // reader users land on the new page heading. Programmatic heading focus
  // carries no visible ring (sighted users already see the new page; the
  // announcement is for screen readers) — real tab stops keep their rings.
  useEffect(() => {
    const h1 = mainRef.current?.querySelector('h1')
    if (h1) {
      if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1')
      h1.style.outline = 'none'
      h1.focus({ preventScroll: true })
    } else {
      mainRef.current?.focus({ preventScroll: true })
    }
  }, [pathname])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandOpen((prev) => !prev)
        return
      }
      if (e.key === '/' && !typing && !e.metaKey && e.ctrlKey === false && !e.altKey) {
        e.preventDefault()
        setIsCommandOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      try {
        localStorage.setItem('mf-sidebar-collapsed', prev ? '0' : '1')
      } catch {
        // private mode — collapse simply won't persist
      }
      return !prev
    })
  }

  const openTradeModal = (stock = null, side = 'BUY') => {
    // No forced symbol: a null stock opens the symbol selector inside the
    // modal. A provided stock must be an explicit user choice (row button,
    // command palette, chart header) — it is passed through untouched.
    setTradeModalStock(stock || null)
    setTradeModalSide(side)
    setTradeOpen(true)
  }

  const closeTradeModal = () => {
    setTradeOpen(false)
    setTradeModalStock(null)
  }

  const openCommandPalette = () => {
    setIsCommandOpen(true)
  }

  return (
    <ShellContext.Provider value={{ openTradeModal, openCommandPalette }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--ivory)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#0B0C0E]"
      >
        Skip to content
      </a>
      <div className="flex h-screen w-screen overflow-hidden bg-[#0B0C0E] text-[var(--ivory)]">
        {/* Desktop Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleCollapse}
        />

        {/* Mobile Navigation Drawer */}
        <MobileDrawer
          isOpen={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0B0C0E]">
          {/* Topbar */}
          <Topbar
            onOpenCommand={() => setIsCommandOpen(true)}
            onOpenTrade={() => openTradeModal()}
            onToggleMobileNav={() => setIsMobileDrawerOpen(true)}
          />

          {/* Page Content Scroll Container */}
          <main ref={mainRef} id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-20 md:pb-8 focus:outline-none">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={isCommandOpen}
          onClose={() => setIsCommandOpen(false)}
          onOpenTrade={(stock) => openTradeModal(stock, 'BUY')}
        />

        {/* Global Trade Sheet */}
        {tradeOpen && (
          <TradeModal
            stock={tradeModalStock}
            defaultSide={tradeModalSide}
            isOpen={tradeOpen}
            onClose={closeTradeModal}
          />
        )}
      </div>
    </ShellContext.Provider>
  )
}
