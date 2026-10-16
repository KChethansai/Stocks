import { ExternalLink } from 'lucide-react'
import { Section, SectionHead, LReveal, Illustrative } from './ui'

const CHIPS = ['All', 'NVDA', 'AAPL', 'TSLA']

const HEADLINES = [
  {
    title: 'NVDA — earnings-week price action and what moved it',
    meta: 'MarketForge Brief · 35m ago · NVDA',
  },
  {
    title: 'AAPL — supplier-chain notes analysts are watching',
    meta: 'MarketForge Brief · 2h ago · AAPL',
  },
  {
    title: 'Market — index breadth narrows into the close',
    meta: 'MarketForge Brief · 4h ago · Market',
  },
]

export default function S10News() {
  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Market context"
          title="News with a symbol filter."
          lede="Headlines prefiltered to what you hold and watch — deep-link any symbol into Markets."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8">
          <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter headlines by symbol">
              {CHIPS.map((chip) => {
                const active = chip === 'NVDA'
                return (
                  <button
                    key={chip}
                    type="button"
                    aria-pressed={active}
                    className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${
                      active
                        ? 'border-[var(--brass)] text-[var(--brass)]'
                        : 'border-[rgba(236,233,226,.08)] text-[var(--stone)]'
                    }`}
                  >
                    {chip}
                  </button>
                )
              })}
            </div>
            <ul className="mt-4 space-y-2">
              {HEADLINES.map((item) => (
                <li
                  key={item.title}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--ivory)]">{item.title}</p>
                    <p className="mf-meta">{item.meta}</p>
                  </div>
                  <ExternalLink
                    size={16}
                    className="ml-auto shrink-0 text-[var(--stone-muted)]"
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>
          </div>
          <p className="mf-meta mt-3">
            Headlines shown are capability examples, not real articles.
          </p>
        </Illustrative>
      </LReveal>
    </Section>
  )
}
