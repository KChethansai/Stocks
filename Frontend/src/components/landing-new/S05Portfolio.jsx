import { ShieldCheck } from 'lucide-react'
import { Illustrative, LReveal, Section, SectionHead } from './ui'
import { SectorAllocation } from '../charts/sector-donut'

const ITEMS = [
  { label: 'NVDA', key: 'NVDA', value: 40, display: '40%' },
  { label: 'AAPL', key: 'AAPL', value: 25, display: '25%' },
  { label: 'MSFT', key: 'MSFT', value: 15, display: '15%' },
  { label: 'Other (3 holdings)', key: '__other', isOther: true, value: 20, display: '20%' },
]

export default function S05Portfolio() {
  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Portfolio"
          title="Allocation you can read."
          lede="Positions, cash, and a donut with stable per-symbol colors; tiny positions fold into a hatched Other bucket."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8">
          <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-5 sm:p-6">
            <SectorAllocation
              items={ITEMS}
              size={160}
              totalDisplay="100%"
              totalLabel="Allocated"
              className="flex-wrap"
            />
            <p className="mf-meta mt-5 border-t border-[rgba(236,233,226,.08)] pt-4">
              Example allocation — not live holdings.
            </p>
            <p className="mt-1 flex items-start gap-2 text-sm leading-relaxed text-[var(--stone)]">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brass)]"
              />
              Sell everything and cash reconciles to the penny — full
              liquidation is a tested invariant.
            </p>
          </div>
        </Illustrative>
      </LReveal>
    </Section>
  )
}
