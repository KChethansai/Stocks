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
          {/* One card, the S03Markets/S05/S06 pattern. Nothing is paired beside
              anything, so a tall-vs-short void cannot exist. */}
          <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-bold text-[var(--ivory)]">
              <TrendingUp size={16} className="text-[var(--brass)]" aria-hidden="true" />
              Direction Bullish
            </p>
            <p className="mt-1 text-sm text-[var(--stone)]">2 of 3 signals aligned</p>

            {/* Peers, not a list beside a column. 3-up starts at md, not sm:
                below 768 each tile cannot hold "Volatility" plus "mixed"
                without the name truncating. */}
            <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              {SIGNALS.map((signal) => (
                <li
                  key={signal.name}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] px-3 py-2 text-sm"
                >
                  {signal.aligned ? (
                    <Check size={16} className="shrink-0 text-[var(--gain)]" aria-hidden="true" />
                  ) : (
                    <Minus size={16} className="shrink-0 text-[var(--stone)]" aria-hidden="true" />
                  )}
                  <span className="truncate text-[var(--ivory)]">{signal.name}</span>
                  <span className="ml-auto shrink-0 text-[var(--stone-muted)]">{signal.state}</span>
                </li>
              ))}
            </ul>

            {/* items-start: these two labels can wrap to different line counts,
                so the shorter block must end flush with its own button instead
                of stretching and hanging its own fill below it. */}
            <div className="mt-3 grid grid-cols-1 items-start gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ivory)]">
                  <ShieldCheck size={16} className="shrink-0 text-[var(--gain)]" aria-hidden="true" />
                  Quote verified · 09:41
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-[44px] w-full rounded-lg bg-[var(--ivory)] px-4 text-sm font-bold text-[#0B0C0E]"
                >
                  Place paper order
                </button>
              </div>
              {/* Peer fill. State rides on the --loss border, the loss icon and
                  the disabled control — never on a second card surface, which
                  was the mismatched-surfaces half of the defect. */}
              <div className="rounded-lg border border-[var(--loss)]/40 bg-[#181B1F] p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ivory)]">
                  <TriangleAlert size={16} className="shrink-0 text-[var(--loss)]" aria-hidden="true" />
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

            <p className="mf-meta mt-3 border-t border-[rgba(236,233,226,.08)] pt-3">
              Direction-only signal. Not a price target, not investment advice.
            </p>
          </div>
        </Illustrative>
      </LReveal>
    </Section>
  )
}
