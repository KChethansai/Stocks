import { Link } from 'react-router'
import { LReveal, Section, SectionHead } from './ui'

const SWATCHES = [
  { name: 'Ink', hex: '#0B0C0E' },
  { name: 'Ivory', hex: '#ECE9E2' },
  { name: 'Brass', hex: '#C9A96E' },
  { name: 'Gain', hex: '#4FB286' },
  { name: 'Loss', hex: '#D9667A' },
]

export default function S12Craft() {
  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Craft"
          title="Simulated trading, taken seriously."
          lede="Dark-only Ink/Ivory/Brass, tabular figures everywhere, full/comfort motion toggle — then the final CTA."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <ul
          aria-label="System color tokens"
          className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5"
        >
          {SWATCHES.map((s) => (
            <li
              key={s.name}
              className="overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)]"
            >
              <div className="h-16 w-full" style={{ backgroundColor: s.hex }} aria-hidden="true" />
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-[var(--ivory)]">{s.name}</p>
                <p className="text-xs tabular-nums text-[var(--stone-muted)]">{s.hex}</p>
              </div>
            </li>
          ))}
        </ul>
      </LReveal>
      <LReveal delay={0.16}>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-6 text-[var(--stone)]">
          Simulated trading. Server-validated quotes, idempotent orders, full receipts. Not
          investment advice. No real money.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--ivory)] px-6 text-sm font-semibold text-[#0B0C0E] transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C0E]"
          >
            Open practice account
          </Link>
          <Link
            to="/markets"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--hairline)] bg-transparent px-6 text-sm font-semibold text-[var(--ivory)] transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C0E]"
          >
            Browse markets
          </Link>
        </div>
        <p className="mf-meta mt-8 text-center">
          Paper-trading simulator · Quotes carry Yahoo provenance
        </p>
      </LReveal>
    </Section>
  )
}
