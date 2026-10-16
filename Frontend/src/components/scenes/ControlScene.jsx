import { useState } from 'react'
import { motion } from 'motion/react'
import { Search, ClipboardCheck, ReceiptText, LineChart } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DURATIONS, EASING } from '../../lib/motion'
import { useTrade } from '../../store/tradeStore'
import { QuantityStepper } from '../ui/QuantityStepper'
import { fmtMoney, fmtPct, fmtQty } from '../../utils/format'

const STEPS = [
  {
    n: 1,
    title: 'Find the stock',
    body: 'Search 30 US stocks by symbol, company, or sector. Every quote shows its source and age.',
    icon: Search,
  },
  {
    n: 2,
    title: 'Review the order',
    body: 'Pick a side and quantity. The ticket shows estimated cost against your buying power before anything executes.',
    icon: ClipboardCheck,
  },
  {
    n: 3,
    title: 'Get a fill receipt',
    body: 'Orders execute atomically against verified quotes. The receipt shows the server fill price, quantity, total, and order id.',
    icon: ReceiptText,
  },
  {
    n: 4,
    title: 'Track the position',
    body: 'Holdings, average cost, and profit and loss update with live prices. Every trade lands in the activity ledger with CSV export.',
    icon: LineChart,
  },
]

export default function ControlScene() {
  const isComfort = useReducedMotion()
  const stocks = useTrade((s) => s.stocks)
  const [qty, setQty] = useState(10)
  const [active, setActive] = useState(0)

  const sample = (stocks || []).find((s) => s.symbol === 'AAPL') ||
    (stocks || [])[0] || { symbol: 'AAPL', name: 'Apple Inc.', price: 227.14, changePercent: 1.42 }
  const price = Number(sample.price || 0)
  const buyingPower = 100000
  const estimated = price * qty

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mf-scene">
        <div className="mf-scene-frame">
          <motion.div
            className="mx-auto mb-16 max-w-2xl text-center"
            initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: isComfort ? 0 : DURATIONS.content, ease: EASING.contentReveal }}
          >
            <h2
              className="font-display leading-[1.05] tracking-[-0.02em] text-[var(--ivory)]"
              style={{ fontSize: 'clamp(1.75rem, 1.375rem + 2vw, 2.75rem)' }}
            >
              How a trade works
            </h2>
            <p className="mt-4 leading-relaxed text-[var(--stone)]">
              Four steps, built from the actual order ticket. Select a step to preview it.
            </p>
          </motion.div>

          <div className="grid items-start gap-6 lg:grid-cols-12">
            {/* Sequence (numbered because it is a real sequence) */}
            <ol className="flex flex-col gap-2 lg:col-span-5">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                const selected = i === active
                return (
                  <li key={s.n}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] ${
                        selected
                          ? 'border-[var(--brass)]/40 bg-white/[0.04]'
                          : 'border-[var(--hairline)] hover:border-[var(--hairline-hover)]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          selected ? 'bg-[var(--brass)] text-[#0B0C0E]' : 'bg-white/[0.06] text-[var(--stone)]'
                        }`}
                      >
                        {s.n}
                      </span>
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ivory)]">
                          <Icon className="h-4 w-4 text-[var(--brass)]" aria-hidden="true" />
                          {s.title}
                        </span>
                        <span className="mt-1 block text-[13px] leading-5 text-[var(--stone)]">{s.body}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>

            {/* Live preview built from the real ticket pieces (illustrative) */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] p-5 sm:p-6">
                <p className="mb-3 text-xs text-[var(--stone-muted)]">
                  Illustrative preview — buying power and receipts in your account come from your
                  real balance and server fills.
                </p>
                {active === 0 && (
                  <div>
                    <p className="text-[13px] text-[var(--stone)]">Step 1 — Find the stock</p>
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--hairline)] bg-[var(--ink-950)] px-4 py-3">
                      <div>
                        <p className="text-base font-semibold tracking-wide text-[var(--ivory)]">{sample.symbol}</p>
                        <p className="text-xs text-[var(--stone)]">{sample.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold tabular-nums text-[var(--ivory)]">{fmtMoney(price)}</p>
                        <p className={`text-xs tabular-nums ${Number(sample.changePercent || 0) >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                          {fmtPct(sample.changePercent)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[var(--stone-muted)]">
                      {sample.lastVerifiedAt ? 'Verified Yahoo Finance quote' : 'Quote source shown before you trade'} · Unverified or stale quotes never fill.
                    </p>
                  </div>
                )}
                {active === 1 && (
                  <div>
                    <p className="text-[13px] text-[var(--stone)]">Step 2 — Review the order</p>
                    <div className="mt-3">
                      <QuantityStepper value={qty} onChange={setQty} min={1} max={Math.max(1, Math.floor(buyingPower / (price || 1)))} />
                    </div>
                    <dl className="mt-4 space-y-2 rounded-lg border border-[var(--hairline)] bg-[var(--ink-950)] p-4 text-[13px]">
                      <div className="flex justify-between">
                        <dt className="text-[var(--stone)]">Order</dt>
                        <dd className="font-medium text-[var(--ivory)]">Buy {fmtQty(qty)} {sample.symbol}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--stone)]">Estimated cost</dt>
                        <dd className="font-semibold tabular-nums text-[var(--ivory)]">{fmtMoney(estimated)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--stone)]">Buying power</dt>
                        <dd className="tabular-nums text-[var(--stone)]">{fmtMoney(buyingPower)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
                {active === 2 && (
                  <div>
                    <p className="text-[13px] text-[var(--stone)]">Step 3 — Get a fill receipt</p>
                    <div className="mt-3 rounded-lg border border-[var(--hairline)] bg-[var(--ink-950)] p-4">
                      <p className="text-sm font-semibold text-[var(--ivory)]">
                        Bought {fmtQty(qty)} {sample.symbol} at {fmtMoney(price)}
                      </p>
                      <dl className="mt-3 space-y-1.5 text-[13px]">
                        <div className="flex justify-between">
                          <dt className="text-[var(--stone)]">Total</dt>
                          <dd className="tabular-nums text-[var(--ivory)]">{fmtMoney(estimated)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-[var(--stone)]">Order</dt>
                          <dd className="tabular-nums text-[var(--stone)]">…a3f9c21e (sample)</dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-xs text-[var(--stone-muted)]">
                        Server fill values, not estimates. Retries reuse the same order key, so a double-click fills once.
                      </p>
                    </div>
                  </div>
                )}
                {active === 3 && (
                  <div>
                    <p className="text-[13px] text-[var(--stone)]">Step 4 — Track the position</p>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-[13px]">
                      {[
                        { label: 'Shares', value: fmtQty(qty) },
                        { label: 'Avg cost', value: fmtMoney(price) },
                        { label: 'Market value', value: fmtMoney(estimated) },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-[var(--hairline)] bg-[var(--ink-950)] p-3">
                          <p className="text-xs text-[var(--stone)]">{item.label}</p>
                          <p className="mt-1 font-semibold tabular-nums text-[var(--ivory)]">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[var(--stone-muted)]">
                      Live prices revalue holdings. The activity ledger records every fill with CSV export.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
