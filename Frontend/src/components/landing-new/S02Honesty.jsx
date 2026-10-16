import { ChartLine, FileDown, ReceiptText } from 'lucide-react'
import { Link } from 'react-router'
import { Illustrative, LReveal, Section, SectionHead } from './ui'

const STEPS = [
  {
    n: '01',
    icon: ChartLine,
    title: 'Research',
    body: 'Browse 30 stocks with line/candle history',
  },
  {
    n: '02',
    icon: ReceiptText,
    title: 'Paper-trade',
    body: 'Review every order, fills at server price',
  },
  {
    n: '03',
    icon: FileDown,
    title: 'Review',
    body: 'Receipts, allocation, analytics, CSV',
  },
]

const LEGEND = [
  { dot: 'bg-[var(--gain)]', label: 'Verified · as of time' },
  { dot: 'bg-[#D9A441]', label: 'Stale or unverified — trading gated' },
  { dot: 'bg-[var(--stone-muted)]', label: 'Unavailable' },
]

const FACTS = [
  { value: '$100K', label: 'virtual capital' },
  { value: '30', label: 'US stocks' },
  { value: '$0', label: 'real money' },
]

export default function S02Honesty() {
  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="How it works"
          title="Research. Paper-trade. Review."
          lede="Three steps, one loop — quotes carry provenance from Yahoo so you always know what a price is worth."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8">
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] p-5"
              >
                <div className="flex items-center justify-between">
                  <s.icon size={20} className="text-[var(--brass)]" aria-hidden="true" />
                  <span className="text-xs font-bold tabular-nums text-[var(--stone-muted)]">
                    {s.n}
                  </span>
                </div>
                <p className="mt-4 text-base font-semibold text-[var(--ivory)]">{s.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--stone)]">{s.body}</p>
              </li>
            ))}
          </ol>
          <ul className="mt-4 flex flex-col gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--ink-950)] px-4 py-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {LEGEND.map((l) => (
              <li
                key={l.label}
                className="flex min-h-[28px] items-center gap-2 text-[13px] text-[var(--stone)]"
              >
                <span className={`size-2 shrink-0 rounded-full ${l.dot}`} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>
        </Illustrative>
      </LReveal>
      <LReveal delay={0.16}>
        <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FACTS.map((f) => (
            <div
              key={f.label}
              className="rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] px-5 py-4 text-center"
            >
              <dd className="text-2xl font-bold tabular-nums text-[var(--ivory)]">{f.value}</dd>
              <dt className="mt-1 text-[13px] text-[var(--stone-muted)]">{f.label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-center text-sm text-[var(--stone)]">
          Ready to try the loop?{' '}
          <Link
            to="/register"
            className="font-medium text-[var(--ivory)] underline decoration-[var(--hairline)] underline-offset-4 transition hover:text-[var(--brass)]"
          >
            Open a practice account
          </Link>
        </p>
      </LReveal>
    </Section>
  )
}
