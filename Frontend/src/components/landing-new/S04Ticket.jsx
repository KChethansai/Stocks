import { ClipboardCheck, ReceiptText, Ticket } from 'lucide-react'
import { Illustrative, LReveal, Section, SectionHead } from './ui'

const STEPS = [
  {
    icon: Ticket,
    label: 'Order ticket',
    body: (
      <>
        Buy 10 AAPL · <span className="tabular-nums">$3,436.40</span> estimate
      </>
    ),
  },
  {
    icon: ClipboardCheck,
    label: 'Review',
    body: (
      <>
        Market · fills at server price · key{' '}
        <span className="font-mono tabular-nums">…a1b2c3d4</span>
      </>
    ),
  },
  {
    icon: ReceiptText,
    label: 'Receipt',
    body: (
      <>
        Bought 10 AAPL at <span className="tabular-nums">$343.64</span> — server
        fill price
      </>
    ),
  },
]

export default function S04Ticket() {
  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Order ticket"
          title="Reviewed, keyed, receipted."
          lede="Every order passes a review sheet and carries an idempotency key; fills return a server receipt."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-10 hidden h-px bg-[rgba(236,233,226,.08)] sm:block"
            />
            <div
              aria-hidden="true"
              className="absolute top-10 hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brass)] sm:block"
              style={{ left: 'calc((100% - 2rem) / 3 + 0.5rem)' }}
            />
            <div
              aria-hidden="true"
              className="absolute top-10 hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brass)] sm:block"
              style={{ left: 'calc(2 * (100% - 2rem) / 3 + 1.5rem)' }}
            />
            <ol className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
              {STEPS.map((step) => (
                <li
                  key={step.label}
                  className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-5"
                >
                  <div className="flex h-10 items-center">
                    <step.icon
                      aria-hidden="true"
                      className="h-5 w-5 text-[var(--brass)]"
                    />
                  </div>
                  <p className="mf-label text-[var(--stone-muted)]">{step.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ivory)]">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-3 text-sm text-[var(--stone)]">
            Every order is reviewed, keyed, and receipted.
          </p>
        </Illustrative>
      </LReveal>
    </Section>
  )
}
