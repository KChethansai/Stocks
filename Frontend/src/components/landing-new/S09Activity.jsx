import { Download, ReceiptText } from 'lucide-react'
import { Section, SectionHead, LReveal, Illustrative } from './ui'

const FILLS = [
  { side: 'BUY', detail: '10 AAPL @ $343.64', key: '…a1b2c3d4' },
  { side: 'SELL', detail: '5 NVDA @ $216.98', key: '…e5f6g7h8' },
  { side: 'BUY', detail: '2 TSLA @ $302.25', key: '…i9j0k1l2' },
]

export default function S09Activity() {
  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Receipts"
          title="Every fill, receipted."
          lede="The activity ledger records each fill with its order key; export the filtered view as CSV."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8">
          <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-4">
            <p className="mf-label flex items-center gap-2 text-[var(--stone-muted)]">
              <ReceiptText size={16} className="text-[var(--brass)]" aria-hidden="true" />
              Activity ledger
            </p>
            <ul className="mt-3 space-y-2">
              {FILLS.map((fill) => (
                <li
                  key={`${fill.side}-${fill.detail}`}
                  className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] px-3 py-2"
                >
                  <span
                    className={`text-xs font-black tracking-wider ${fill.side === 'BUY' ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}
                  >
                    {fill.side}
                  </span>
                  <span className="text-sm font-semibold text-[var(--ivory)]">{fill.detail}</span>
                  <span className="mf-meta ml-auto">key {fill.key}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled
              title="Sign in to export your ledger"
              className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] px-4 text-sm font-bold text-[var(--stone-muted)] sm:w-auto"
            >
              <Download size={16} aria-hidden="true" />
              Export CSV
            </button>
          </div>
          <p className="mf-meta mt-3">
            Exports carry the current filter — latest 100 rows.
          </p>
        </Illustrative>
      </LReveal>
    </Section>
  )
}
