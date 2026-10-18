import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Search, Download, ChevronLeft, ChevronRight, AlertTriangle, RotateCw } from 'lucide-react'
import { useTrade } from '../store/tradeStore'
import { formatCurrency } from '../utils/marketAnalytics'
import { exportToCSV } from '../utils/csvExport'
import { ShinyText } from './reactbits/ShinyText'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import { Select } from './ui/Select'
import Reveal from './ui/Reveal'

// A real paginated ledger.
//
// The old page fetched the newest 100 rows and rendered all of them, labelled
// "latest 100 of 136" — so 36 records were unreachable and the group counts
// described a window rather than the history. Filters and ordering now run in
// the database over the full collection, and this page renders exactly one page
// of them.
//
// Three different counts appear, and they are deliberately labelled apart:
//   accountTotal  every record on the account (summary cards)
//   total         records matching the CURRENT filters (the "of N" label)
//   page rows     what is actually on screen (the table)
const PAGE_SIZES = [10, 25, 50]

const dayKey = (iso) => {
  if (!iso) return 'undated'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'undated' : d.toDateString()
}

export default function Transactions() {
  const { ledgerPage, ledgerLoading, ledgerError, fetchLedgerPage, fetchLedgerExport, fetchOrders } = useTrade()

  // Page + filters live in the URL so the view survives navigation and can be
  // shared or reloaded without losing the reader's place.
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const rawSize = Number(params.get('pageSize')) || 10
  const pageSize = PAGE_SIZES.includes(rawSize) ? rawSize : 10
  const side = ['BUY', 'SELL'].includes(params.get('side')) ? params.get('side') : ''
  const [queryInput, setQueryInput] = useState(params.get('q') || '')
  const q = params.get('q') || ''

  const [exporting, setExporting] = useState(false)
  const [exportScope, setExportScope] = useState('page')

  const patchParams = useCallback(
    (patch, { resetPage = false } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === '' || v == null) next.delete(k)
            else next.set(k, String(v))
          }
          // Any filter change invalidates the current page: page 9 of a set
          // that now has 2 pages is an empty table, not "no results".
          if (resetPage) next.delete('page')
          return next
        },
        { replace: true }
      )
    },
    [setParams]
  )

  useEffect(() => {
    fetchLedgerPage({ page, pageSize, side, q })
  }, [fetchLedgerPage, page, pageSize, side, q])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // The server clamps an out-of-range page and says so; reflect the clamp in
  // the URL instead of leaving a page number that does not exist.
  useEffect(() => {
    if (ledgerPage?.clamped && ledgerPage.page !== page) {
      patchParams({ page: ledgerPage.page })
    }
  }, [ledgerPage, page, patchParams])

  // Memoised so the grouping useMemo below does not see a fresh `[]` on every
  // render while `ledgerPage` is null (which recomputes it each time).
  const rows = useMemo(() => ledgerPage?.transactions || [], [ledgerPage])
  const total = ledgerPage?.total ?? 0
  const totalPages = ledgerPage?.totalPages ?? 1
  const safePage = ledgerPage?.page ?? page
  const from = ledgerPage?.from ?? 0
  const to = ledgerPage?.to ?? 0
  const accountTotals = ledgerPage?.accountTotals

  // Summary statistics come from the server's account-wide counts, never from
  // this page's rows. Counting page rows here is exactly the "all-history stats
  // from one page" mistake this refactor exists to remove.
  const stats = useMemo(
    () => ({
      total: accountTotals?.total ?? null,
      buys: accountTotals?.buys ?? null,
      sells: accountTotals?.sells ?? null
    }),
    [accountTotals]
  )

  // Today/Earlier grouping applied coherently WITHIN the current page: the
  // group counts describe this page's rows, and the header appears once.
  const groups = useMemo(() => {
    const now = new Date()
    const today = now.toDateString()
    const yesterdayDate = new Date(now)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = yesterdayDate.toDateString()

    const out = { Today: [], Yesterday: [], Earlier: [] }
    for (const tx of rows) {
      const key = dayKey(tx.createdAt)
      if (key === today) out.Today.push(tx)
      else if (key === yesterday) out.Yesterday.push(tx)
      else out.Earlier.push(tx)
    }
    return out
  }, [rows])

  const filtersActive = Boolean(side || q)

  const handleExport = useCallback(async () => {
    setExporting(true)
    const res = await fetchLedgerExport({ scope: exportScope, page: safePage, pageSize, side, q })
    setExporting(false)
    if (!res.success) return
    const headers = ['Order ID', 'Date & Time', 'Action', 'Symbol', 'Shares', 'Execution Price', 'Total Value']
    const rowsOut = (res.rows || []).map((item) => [
      item._id,
      item.createdAt ? new Date(item.createdAt).toISOString() : '',
      item.type,
      item.symbol || '',
      item.quantity ?? '',
      item.price != null ? Number(item.price).toFixed(2) : '',
      item.total != null ? Number(item.total).toFixed(2) : ''
    ])
    // The scope is in the filename and in the toast, because "Export CSV" must
    // never mean something different from what the reader thinks it means.
    const scopeTag = exportScope === 'page' ? `page-${safePage}-of-${totalPages}` : 'all-matching'
    exportToCSV(headers, rowsOut, `marketforge_activity_${scopeTag}.csv`)
    return res
  }, [exportScope, fetchLedgerExport, pageSize, q, safePage, side, totalPages])

  const fmtTime = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d)
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <Reveal className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mf-h1 mb-3">
            <ShinyText>Activity Ledger</ShinyText>
          </h1>
          {/* Account-wide counts, explicitly labelled as such. */}
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            <div className="flex flex-col px-3 py-2 bg-[#111316] border border-white/8 rounded-lg">
              <span className="mf-label">All trades</span>
              <span className="text-lg font-bold text-[var(--ivory)] tabular-nums">
                {stats.total ?? '—'}
              </span>
            </div>
            <div className="flex flex-col px-3 py-2 bg-[#111316] border border-white/8 rounded-lg">
              <span className="mf-label">Buys</span>
              <span className="text-lg font-bold text-[var(--gain)] tabular-nums">
                {stats.buys ?? '—'}
              </span>
            </div>
            <div className="flex flex-col px-3 py-2 bg-[#111316] border border-white/8 rounded-lg">
              <span className="mf-label">Sells</span>
              <span className="text-lg font-bold text-[var(--loss)] tabular-nums">
                {stats.sells ?? '—'}
              </span>
            </div>
            {filtersActive && (
              <div className="flex flex-col px-3 py-2 bg-[#111316] border border-white/8 rounded-lg">
                <span className="mf-label">Matching filters</span>
                <span className="text-lg font-bold text-[var(--brass)] tabular-nums">{total}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    patchParams({ q: queryInput.trim() }, { resetPage: true })
                  }
                }}
                // Deliberately NOT committed on blur. Blur fires before the
                // click handler of a pagination button, so committing here ran
                // `resetPage` and deleted `page` immediately before the click
                // set `page: safePage + 1` — the filter reset silently did not
                // hold. Search commits on Enter, or on the next control's
                // change; the input keeps its own draft state meanwhile.
                placeholder="Search symbol or action..."
                aria-label="Search the ledger"
                className="w-full bg-[#111316] border border-[rgba(255,255,255,0.08)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[var(--ivory)] focus:outline-none focus:border-[var(--brass)] transition placeholder-[var(--stone-muted)] min-h-[34px]"
              />
            </div>
            <button
              type="button"
              onClick={() => patchParams({ q: queryInput.trim() }, { resetPage: true })}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-[11px] font-mono text-[var(--stone)] hover:text-[var(--ivory)] hover:border-[var(--brass)]/40 min-h-[34px]"
              title="Apply the search text and return to the first page"
            >
              Search
            </button>
            <SegmentedControl
              value={side || 'ALL'}
              // Changing the side also applies any pending search text, so the
              // two filters can never disagree about what is on screen.
              onChange={(v) =>
                patchParams(
                  { side: v === 'ALL' ? '' : v, q: queryInput.trim() },
                  { resetPage: true }
                )
              }
              ariaLabel="Transaction filter"
              options={[
                { value: 'ALL', label: 'ALL' },
                { value: 'BUY', label: 'BUY' },
                { value: 'SELL', label: 'SELL' }
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(pageSize)}
              onChange={(v) => patchParams({ pageSize: v }, { resetPage: true })}
              ariaLabel="Rows per page"
              className="w-32"
              // Short labels so the closed control never truncates to "10 per pa…"; the
              // accessible name comes from ariaLabel, not the visible text.
              options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} rows` }))}
            />
            <Select
              value={exportScope}
              onChange={setExportScope}
              ariaLabel={`CSV export scope: ${exportScope === 'page' ? 'this page' : 'all matching records'}`}
              className="w-36"
              options={[
                { value: 'page', label: 'This page' },
                { value: 'all', label: 'All matching' }
              ]}
            />
            <Button
              variant="secondary"
              size="md"
              onClick={handleExport}
              disabled={exporting || rows.length === 0}
              className="rounded-lg"
              title={
                exportScope === 'page'
                  ? `Exports the ${rows.length} rows on screen (page ${safePage} of ${totalPages})`
                  : `Exports every record matching the current filters (${total})`
              }
            >
              <Download className="w-3.5 h-3.5 text-[var(--stone)]" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </Button>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setQueryInput('')
                  patchParams({ side: '', q: '' }, { resetPage: true })
                }}
                className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-[11px] font-mono text-[var(--stone)] hover:text-[var(--ivory)] min-h-[34px]"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {ledgerError && (
        <div role="alert" className="rounded-xl border border-[var(--loss)]/30 bg-[rgba(217,102,122,0.08)] p-4 flex items-center justify-between gap-3">
          <p className="text-xs font-mono text-[var(--loss)] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {ledgerError}
          </p>
          <button
            type="button"
            onClick={() => fetchLedgerPage({ page, pageSize, side, q })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-xs font-mono text-[var(--stone)] hover:text-[var(--ivory)]"
          >
            <RotateCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* One table header for the page, above the groups. Repeating it per group
          duplicated the header row and made the group counts read as table
          totals. */}
      <Reveal as="section" delay={0.03} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-mono font-semibold text-[var(--stone)]">
            {ledgerLoading && !rows.length ? 'Loading ledger...' : `${rows.length} row${rows.length === 1 ? '' : 's'} on this page`}
          </h2>
          <span className="mf-meta font-mono tabular-nums" aria-live="polite">
            {total === 0 ? 'No matching records' : `Showing ${from}–${to} of ${total}`}
          </span>
        </div>

        <div className="hidden md:grid grid-cols-[110px_72px_88px_1fr_1fr_120px] gap-4 px-4 py-2 text-[10px] font-mono uppercase text-text-muted tracking-wider" aria-hidden="true">
          <div>Time</div>
          <div>Action</div>
          <div>Symbol</div>
          <div className="text-right">Shares</div>
          <div className="text-right">Price</div>
          <div className="text-right">Total Value</div>
        </div>

        {ledgerLoading && rows.length === 0 ? (
          <div className="space-y-1.5" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-[#111316] border border-[rgba(255,255,255,0.04)] animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-text-muted bg-[#111316] rounded-xl border border-[rgba(255,255,255,0.06)]">
            {filtersActive
              ? 'No trades match these filters.'
              : 'No executed trades recorded in the activity ledger yet.'}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groups)
              .filter(([, list]) => list.length > 0)
              .map(([groupKey, list]) => (
                <div key={groupKey} className="space-y-2">
                  <h3 className="text-[11px] font-mono font-semibold text-[var(--stone)] flex items-center justify-between gap-3">
                    <span>{groupKey}</span>
                    <span className="mf-meta font-mono">
                      {list.length} on this page
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {list.map((tx) => {
                      const isBuy = tx.type === 'BUY'
                      return (
                        <div
                          key={tx._id}
                          className="grid grid-cols-2 md:grid-cols-[110px_72px_88px_1fr_1fr_120px] gap-y-1 gap-x-4 px-4 py-2.5 bg-[#111316] hover:bg-[#181B1F] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.1)] transition rounded-xl items-center font-mono text-xs"
                        >
                          <div className="text-[var(--stone)] text-[11px]">{fmtTime(tx.createdAt)}</div>
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                isBuy
                                  ? 'bg-[rgba(79,178,134,.12)] text-[var(--gain)]'
                                  : 'bg-[rgba(217,102,122,.12)] text-[var(--loss)]'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </div>
                          <div className="font-bold text-[var(--ivory)] text-sm">{tx.symbol || '—'}</div>
                          <div className="text-[var(--stone)] md:text-right">{tx.quantity ?? '—'}</div>
                          <div className="text-[var(--stone)] md:text-right">
                            {tx.price != null ? `$${Number(tx.price).toFixed(2)}` : '—'}
                          </div>
                          <div className="font-semibold text-[var(--ivory)] md:text-right">
                            {tx.total != null ? formatCurrency(tx.total) : '—'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}

        {total > 0 && (
          <nav
            aria-label="Ledger pagination"
            className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[rgba(255,255,255,0.06)]"
          >
            <span className="mf-meta font-mono tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => patchParams({ page: safePage - 1 })}
                disabled={safePage <= 1 || ledgerLoading}
                aria-label="Previous page"
                className="inline-flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-mono text-[var(--stone)] disabled:opacity-40 hover:text-[var(--ivory)] hover:border-[var(--brass)]/40 min-h-[34px]"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button
                type="button"
                onClick={() => patchParams({ page: safePage + 1 })}
                disabled={safePage >= totalPages || ledgerLoading}
                aria-label="Next page"
                className="inline-flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-mono text-[var(--stone)] disabled:opacity-40 hover:text-[var(--ivory)] hover:border-[var(--brass)]/40 min-h-[34px]"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </nav>
        )}
      </Reveal>
    </div>
  )
}