import { useEffect, useState } from 'react'
import { Star, Bell, CheckCheck, Eye } from 'lucide-react'
import { Section, SectionHead, LReveal, Illustrative } from './ui'
import { useTrade } from '../../store/tradeStore'
import { fmtPct } from '../../utils/format'

const SYMBOLS = ['NVDA', 'TSLA']

const INBOX = [
  { rule: 'NVDA above $220', meta: 'triggered 09:41 · acknowledged', done: true },
  { rule: 'TSLA below $290', meta: 'watching', done: false },
]

function fmtPrice(p) {
  const n = Number(p)
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—'
}

// D10 (integrity pass): the watchlist rows show genuine quotes from the public
// /stocks endpoint (single request, shared store, no polling) — never
// hardcoded prices. The alert inbox stays a workflow illustration (rule
// definitions, no market values) under an explicit sample caption.
export default function S07Alerts() {
  const stocks = useTrade((s) => s.stocks)
  const fetchStocks = useTrade((s) => s.fetchStocks)
  const [quotesState, setQuotesState] = useState('loading')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let on = true
    setQuotesState('loading')
    fetchStocks?.().then((res) => {
      if (!on) return
      setQuotesState(res?.success ? 'ready' : 'unavailable')
    }).catch(() => {
      if (on) setQuotesState('unavailable')
    })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])

  const rows = SYMBOLS.map((sym) => (stocks || []).find((s) => s.symbol === sym)).filter(Boolean)
  const ready = quotesState === 'ready' && rows.length > 0
  const anyStale = rows.some((r) => r.stale || !r.lastVerifiedAt)
  const times = rows.map((r) => r.lastVerifiedAt && new Date(r.lastVerifiedAt).getTime()).filter(Boolean)
  const asOf = times.length
    ? new Date(Math.max(...times)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Watchlists & alerts"
          title="Set a price. Get told once."
          lede="Threshold alerts are checked about every five minutes, fire once, and land in a persistent inbox — never a toast avalanche."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8" caption="Watchlist shows genuine quotes; inbox preview is illustrative — sign in for your live alerts.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-4">
              <p className="mf-label flex items-center gap-2 text-[var(--stone-muted)]">
                Watchlist
                <span className="rounded-full border border-[var(--gain)]/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--gain)]">Quotes</span>
              </p>
              {quotesState === 'loading' ? (
                <div className="mt-3 space-y-3" aria-busy="true" aria-label="Loading watchlist quotes">
                  {SYMBOLS.map((sym) => (
                    <div key={sym} className="h-[44px] rounded-lg bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : !ready ? (
                <div className="mt-3 rounded-lg border border-white/8 bg-[#0B0C0E] p-4 text-center">
                  <p className="text-xs text-[var(--stone)]">Watchlist quotes unavailable.</p>
                  <button type="button" onClick={() => setNonce((n) => n + 1)} className="mt-2 min-h-[44px] px-4 rounded-lg border border-white/10 text-xs font-semibold text-[var(--ivory)] hover:border-[var(--brass)]/50">
                    Retry
                  </button>
                </div>
              ) : (
                <ul className="mt-3 space-y-3" aria-live="polite">
                  {rows.map((row) => {
                    const up = Number(row.changePercent || 0) >= 0
                    return (
                      <li key={row.symbol} className="flex min-h-[44px] items-center gap-3">
                        <Star size={16} className="shrink-0 text-[var(--brass)]" aria-hidden="true" />
                        <span className="text-sm font-bold text-[var(--ivory)]">{row.symbol}</span>
                        <span className="text-sm text-[var(--stone)] tabular-nums">{fmtPrice(row.price)}</span>
                        <span
                          className={`ml-auto text-sm font-semibold tabular-nums ${up ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}
                        >
                          <span aria-hidden="true">{up ? '▲' : '▼'}</span> {fmtPct(row.changePercent)}
                          <span className="sr-only">{up ? 'up' : 'down'}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {ready && (
                <p className="mf-meta mt-2">
                  Genuine quotes · as of {asOf || '—'}{anyStale ? ' · some stale' : ''}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-4">
              <p className="mf-label flex items-center gap-2 text-[var(--stone-muted)]">
                <Bell size={16} className="text-[var(--brass)]" aria-hidden="true" />
                Alert inbox
                <span className="rounded-full border border-[var(--brass)]/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--brass)]">Sample</span>
              </p>
              <ul className="mt-3 space-y-3">
                {INBOX.map((item) => (
                  <li
                    key={item.rule}
                    aria-label={`Sample rule: ${item.rule}`}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] px-3 py-2"
                  >
                    {item.done ? (
                      <CheckCheck size={16} className="shrink-0 text-[var(--gain)]" aria-hidden="true" />
                    ) : (
                      <Eye size={16} className="shrink-0 text-[var(--stone)]" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ivory)]">{item.rule}</p>
                      <p className="mf-meta">{item.meta}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mf-meta mt-3">
            The inbox persists every alert — toasts only summarize, so nothing scrolls away.
          </p>
        </Illustrative>
      </LReveal>
    </Section>
  )
}
