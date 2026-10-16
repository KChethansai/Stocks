import { TrendingUp, Check, Minus, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Section, SectionHead, LReveal, Illustrative } from './ui'

const SIGNALS = [
  { name: 'Momentum', state: 'aligned', aligned: true },
  { name: 'Trend', state: 'aligned', aligned: true },
  { name: 'Volatility', state: 'mixed', aligned: false },
]

export default function S08Forecasts() {
  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Forecasts, honestly"
          title="Direction, not destiny."
          lede="A direction-only signal with its provenance on the label. No price targets, no accuracy claims."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-[var(--ivory)]">
                <TrendingUp size={16} className="text-[var(--brass)]" aria-hidden="true" />
                Direction Bullish
              </p>
              <p className="mt-1 text-sm text-[var(--stone)]">2 of 3 signals aligned</p>
              <ul className="mt-3 space-y-2">
                {SIGNALS.map((signal) => (
                  <li key={signal.name} className="flex min-h-[44px] items-center gap-2 text-sm">
                    {signal.aligned ? (
                      <Check size={16} className="shrink-0 text-[var(--gain)]" aria-hidden="true" />
                    ) : (
                      <Minus size={16} className="shrink-0 text-[var(--stone)]" aria-hidden="true" />
                    )}
                    <span className="text-[var(--ivory)]">{signal.name}</span>
                    <span className="ml-auto text-[var(--stone-muted)]">{signal.state}</span>
                  </li>
                ))}
              </ul>
              <p className="mf-meta mt-3 border-t border-[rgba(236,233,226,.08)] pt-3">
                Direction-only signal. Not a price target, not investment advice.
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ivory)]">
                  <ShieldCheck size={16} className="text-[var(--gain)]" aria-hidden="true" />
                  Quote verified · 09:41
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-[44px] w-full rounded-lg bg-[var(--ivory)] px-4 text-sm font-bold text-[#0B0C0E]"
                >
                  Place paper order
                </button>
              </div>
              <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#0B0C0E] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ivory)]">
                  <TriangleAlert size={16} className="text-[var(--loss)]" aria-hidden="true" />
                  Quote is stale — refresh market data and retry.
                </p>
                <button
                  type="button"
                  disabled
                  title="Refresh market data to re-enable ordering"
                  className="mt-3 min-h-[44px] w-full cursor-not-allowed rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] px-4 text-sm font-bold text-[var(--stone-muted)]"
                >
                  Place paper order
                </button>
              </div>
            </div>
          </div>
        </Illustrative>
      </LReveal>
    </Section>
  )
}
