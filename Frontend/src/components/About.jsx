import { Link } from 'react-router'

const SECTIONS = [
  {
    heading: 'Why it was built',
    body: 'MarketForge exists so anyone can learn how stock trading feels — placing orders, watching positions move, reviewing fills — without risking money. Paper trading turns market mechanics into experience instead of theory.',
  },
  {
    heading: 'Where prices come from',
    body: 'Quotes and historical candles come from Yahoo Finance, synced every 5 minutes with a 60-second read cache. When Yahoo is unreachable, the app keeps the last verified quote and marks it stale. Unverified or stale quotes never execute trades and never fire price alerts.',
  },
  {
    heading: 'How execution works',
    body: 'Orders are virtual market orders executed atomically in MongoDB transactions: balance, holdings, order, transaction, and idempotency receipt commit together. Retries reuse the same order key, so a double-click fills exactly once. Every fill returns its server price, quantity, total, and order id.',
  },
  {
    heading: 'What it does not do',
    body: 'MarketForge places no real orders, holds no real money, and gives no investment advice. Forecasts are model outputs with logged, resolvable accuracy — not recommendations. The activity ledger keeps your latest 100 records with CSV export.',
  },
  {
    heading: 'Who built it',
    body: 'MarketForge is built by K Chethan Sai. The source is on GitHub, linked in the footer.',
  },
]

export default function About() {
  return (
    <div className="min-h-screen bg-[var(--ink-950)] px-4 py-16 text-[var(--ivory)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <h1
          className="mf-landing-display leading-[1.05] tracking-[-0.02em]"
          style={{ fontSize: 'clamp(2rem, 1.5rem + 2.5vw, 3.25rem)' }}
        >
          About MarketForge
        </h1>
        <p className="mt-4 leading-relaxed text-[var(--stone)]">
          A paper-trading simulator with real market quotes, atomic virtual fills, and forecasts
          it scores against reality.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold text-[var(--ivory)]">{s.heading}</h2>
              <p className="mt-2 max-w-[70ch] text-[15px] leading-7 text-[var(--stone)]">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10">
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
