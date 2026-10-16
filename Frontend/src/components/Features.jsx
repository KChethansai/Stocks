import { Link } from 'react-router'
import {
  Activity,
  Zap,
  TrendingUp,
  Bookmark,
  BarChart3,
  History,
  Lock,
  Sliders,
} from 'lucide-react'

/* Verifiable claims only — every row maps to code. Alternating editorial
 * rows replace the identical-card grid. */
const ROWS = [
  {
    icon: Activity,
    title: 'Real market quotes, honestly labeled',
    body: 'Thirty US stocks from Yahoo Finance with source and age on every quote. Stale or unverified quotes are marked and never execute.',
  },
  {
    icon: Zap,
    title: 'Atomic virtual execution',
    body: 'Balance, holdings, order, transaction, and idempotency receipt commit in one MongoDB transaction. Retries replay the original receipt instead of double-filling.',
  },
  {
    icon: TrendingUp,
    title: 'Positions revalued with live prices',
    body: 'Holdings carry weighted-average cost basis; market value, unrealized profit and loss, and day change derive from the latest quotes.',
  },
  {
    icon: Bookmark,
    title: 'Watchlists with 30-day context',
    body: 'Saved symbols stay distinct from suggestions. Each row carries its 30-day close sparkline and links straight to the trade ticket.',
  },
  {
    icon: Sliders,
    title: 'Charts with honest states',
    body: 'Area and candlestick views across 1D to ALL, with separate loading, empty, failed, stale, and insufficient-data states — never a silent blank.',
  },
  {
    icon: BarChart3,
    title: 'Analytics computed from your ledger',
    body: 'Equity curves built from your actual transaction log against real closes, sector mix with an Other bucket, and an S&P 500 scalar benchmark with its window disclosed.',
  },
  {
    icon: History,
    title: 'Activity ledger with scoped export',
    body: 'The latest 100 transactions and orders, filterable by side and symbol, grouped by day, with CSV export of exactly the filtered view.',
  },
  {
    icon: Lock,
    title: 'Sessions kept server-side honest',
    body: 'HTTP-only cookie sessions, CORS allowlist with origin guard, rate limiting on API and sign-in routes, and per-route authentication with a real 404.',
  },
]

export default function Features() {
  return (
    <div className="min-h-screen bg-[var(--ink-950)] px-4 py-16 text-[var(--ivory)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1
            className="mf-landing-display leading-[1.05] tracking-[-0.02em]"
            style={{ fontSize: 'clamp(2rem, 1.5rem + 2.5vw, 3.25rem)' }}
          >
            What the product does
          </h1>
          <p className="mt-4 leading-relaxed text-[var(--stone)]">
            Each capability below maps to behavior you can verify in the app.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {ROWS.map((row, i) => {
            const Icon = row.icon
            return (
              <section
                key={row.title}
                className={`flex flex-col gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] p-5 sm:p-6 sm:flex-row sm:items-start sm:gap-6 ${
                  i % 2 === 1 ? 'sm:flex-row-reverse' : ''
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[var(--brass)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">{row.title}</h2>
                  <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[var(--stone)]">{row.body}</p>
                </div>
              </section>
            )
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/register"
            className="inline-block rounded-lg bg-[var(--ivory)] px-5 py-2.5 text-sm font-semibold text-[#0B0C0E] transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C0E]"
          >
            Open practice account
          </Link>
        </div>
      </div>
    </div>
  )
}
