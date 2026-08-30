import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { MobileDrawer, MobileBottomNav } from './MobileNav'
import CommandPalette from './CommandPalette'
import TradeModal from './TradeModal'
import { ShellContext } from './ShellContext'
import { useTrade } from '../../store/tradeStore'

export default function AppShell({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [tradeModalStock, setTradeModalStock] = useState(null)
  const [tradeModalSide, setTradeModalSide] = useState('BUY')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const openTradeModal = (stock = null, side = 'BUY') => {
    const fallback =
      stock ||
      useTrade.getState().stocks?.[0] || {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 227.14,
        changePercent: 1.42
      }
    setTradeModalStock(fallback)
    setTradeModalSide(side)
  }

  const closeTradeModal = () => {
    setTradeModalStock(null)
  }

  const openCommandPalette = () => {
    setIsCommandOpen(true)
  }

  return (
    <ShellContext.Provider value={{ openTradeModal, openCommandPalette }}>
      <div className="flex h-screen w-screen overflow-hidden bg-[#09090B] text-[#F5F7FA]">
        {/* Desktop Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Mobile Navigation Drawer */}
        <MobileDrawer
          isOpen={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#09090B]">
          {/* Topbar */}
          <Topbar
            onOpenCommand={() => setIsCommandOpen(true)}
            onOpenTrade={() => openTradeModal()}
            onToggleMobileNav={() => setIsMobileDrawerOpen(true)}
          />

          {/* Page Content Scroll Container */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
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

        {/* Global Trade Modal */}
        {tradeModalStock && (
          <TradeModal
            stock={tradeModalStock}
            defaultSide={tradeModalSide}
            isOpen={Boolean(tradeModalStock)}
            onClose={closeTradeModal}
          />
        )}
      </div>
    </ShellContext.Provider>
  )
}
