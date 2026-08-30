import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  Download
} from 'lucide-react'
import { useTrade } from '../store/tradeStore'
import { formatCurrency } from '../utils/marketAnalytics'
import { exportToCSV } from '../utils/csvExport'
import { NumberTicker } from './magicui/NumberTicker'
import { ShinyText } from './reactbits/ShinyText'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'

export default function Transactions() {
  const { transactions, fetchTransactions, fetchOrders } = useTrade()
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState('ALL') // 'ALL' | 'BUY' | 'SELL'

  useEffect(() => {
    fetchTransactions()
    fetchOrders()
  }, [fetchTransactions, fetchOrders])

  // Summary statistics
  const stats = useMemo(() => {
    const buys = transactions.filter((t) => t.type === 'BUY').length
    const sells = transactions.filter((t) => t.type === 'SELL').length
    const totalTrades = transactions.length
    return { buys, sells, totalTrades }
  }, [transactions])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = filterType === 'ALL' || t.type === filterType
      const q = query.toLowerCase().trim()
      const matchesQuery =
        !q ||
        t.symbol?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q)
      return matchesType && matchesQuery
    })
  }, [transactions, filterType, query])

  // Group transactions by date: Today, Yesterday, Earlier
  const groupedTransactions = useMemo(() => {
    const now = new Date()
    const todayStr = now.toDateString()

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toDateString()

    const groups = {
      Today: [],
      Yesterday: [],
      Earlier: []
    }

    filteredTransactions.forEach((tx) => {
      const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date(0)
      const dateStr = txDate.toDateString()
      if (dateStr === todayStr) {
        groups.Today.push(tx)
      } else if (dateStr === yesterdayStr) {
        groups.Yesterday.push(tx)
      } else {
        groups.Earlier.push(tx)
      }
    })

    return groups
  }, [filteredTransactions])

  const handleExportCSV = useCallback(() => {
    const headers = ['Order ID', 'Date & Time', 'Action', 'Symbol', 'Shares', 'Execution Price', 'Total Value', 'Status']
    const rows = transactions.map((item) => [
      item._id,
      new Date(item.createdAt).toLocaleString(),
      item.type,
      item.symbol,
      item.quantity,
      Number(item.price).toFixed(2),
      Number(item.total).toFixed(2),
      'Completed'
    ])
    exportToCSV(headers, rows, 'marketforge_activity_ledger.csv')
  }, [transactions])

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header Summary */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#F5F7FA] mb-4">
            <ShinyText>Activity Ledger</ShinyText>
          </h1>
          <div className="flex flex-wrap gap-8 text-xs font-mono">
            <div className="flex flex-col p-3 bg-[#111318] border border-white/8 rounded-xl">
              <span className="text-[10px] text-[#667085] uppercase tracking-wider">
                Total Trades
              </span>
              <span className="text-xl font-bold text-[#F5F7FA]">
                <NumberTicker value={stats.totalTrades} decimalPlaces={0} />
              </span>
            </div>

            <div className="flex flex-col p-3 bg-[#111318] border border-white/8 rounded-xl">
              <span className="text-[10px] text-[#667085] uppercase tracking-wider">
                Buys
              </span>
              <span className="text-xl font-bold text-[#22C55E]">
                <NumberTicker value={stats.buys} decimalPlaces={0} />
              </span>
            </div>

            <div className="flex flex-col p-3 bg-[#111318] border border-white/8 rounded-xl">
              <span className="text-[10px] text-[#667085] uppercase tracking-wider">
                Sells
              </span>
              <span className="text-xl font-bold text-[#EF4444]">
                <NumberTicker value={stats.sells} decimalPlaces={0} />
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or action..."
              className="w-full bg-[#111318] border border-[rgba(255,255,255,0.08)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6] transition placeholder-[#667085]"
            />
          </div>

          <SegmentedControl
            value={filterType}
            onChange={setFilterType}
            ariaLabel="Transaction filter"
            options={['ALL', 'BUY', 'SELL'].map((t) => ({ value: t, label: t }))}
          />

          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            className="rounded-lg"
          >
            <Download className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Ledger Sections by Time Group */}
      <div className="space-y-8">
        {['Today', 'Yesterday', 'Earlier'].map((groupKey) => {
          const list = groupedTransactions[groupKey] || []
          if (list.length === 0) return null

          return (
            <section key={groupKey} className="space-y-3">
              <h3 className="text-xs font-mono font-semibold text-[#9CA3AF] border-b border-[rgba(255,255,255,0.08)] pb-2 flex items-center justify-between">
                <span>{groupKey}</span>
                <span className="text-[10px] text-[#667085]">{list.length} transactions</span>
              </h3>

              {/* Table Header (Hidden on Mobile) */}
              <div className="hidden md:grid grid-cols-[120px_80px_100px_1fr_1fr_120px_100px] gap-4 px-4 py-2 text-[10px] font-mono uppercase text-[#667085] tracking-wider">
                <div>Time</div>
                <div>Action</div>
                <div>Symbol</div>
                <div className="text-right">Shares</div>
                <div className="text-right">Price</div>
                <div className="text-right">Total Value</div>
                <div className="text-right">Status</div>
              </div>

              {/* Ledger Rows */}
              <div className="space-y-1.5">
                {list.map((tx, idx) => {
                  const isBuy = tx.type === 'BUY'
                  const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date(0)
                  const timeStr = txDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })
                  const dateStr = txDate.toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric'
                  })

                  return (
                    <div
                      key={tx._id || idx}
                      className="grid grid-cols-2 md:grid-cols-[120px_80px_100px_1fr_1fr_120px_100px] gap-y-2 gap-x-4 px-4 py-3 bg-[#111318] hover:bg-[#151820] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.1)] transition rounded-xl items-center font-mono text-xs"
                    >
                      <div className="text-[#9CA3AF] text-[11px]">
                        {groupKey === 'Earlier' ? `${dateStr} ` : ''}{timeStr}
                      </div>

                      <div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                            isBuy
                              ? 'bg-[#22C55E]/10 text-[#22C55E]'
                              : 'bg-[#EF4444]/10 text-[#EF4444]'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </div>

                      <div className="font-bold text-[#F5F7FA] text-sm">
                        {tx.symbol || '-'}
                      </div>

                      <div className="text-[#9CA3AF] md:text-right">
                        {tx.quantity} shares
                      </div>

                      <div className="text-[#9CA3AF] md:text-right">
                        ${Number(tx.price || 0).toFixed(2)}
                      </div>

                      <div className="font-semibold text-[#F5F7FA] md:text-right">
                        {formatCurrency(tx.total || 0)}
                      </div>

                      <div className="md:text-right">
                        <span className="text-[#22C55E] flex items-center md:justify-end gap-1.5 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
                          Completed
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center text-xs font-mono text-[#667085] bg-[#111318] rounded-xl border border-[rgba(255,255,255,0.06)]">
            No executed trades recorded in activity ledger yet.
          </div>
        )}
      </div>
    </div>
  )
}
