import { Bell, Briefcase, ChartLine, Search } from 'lucide-react'
import { Illustrative, LReveal, Section, SectionHead } from './ui'

const ROWS = [
  {
    icon: ChartLine,
    title: 'NVDA',
    sub: 'NVIDIA Corp · NASDAQ',
    action: 'Trade',
  },
  {
    icon: Briefcase,
    title: 'Portfolio',
    sub: 'Go to page',
    action: null,
  },
  {
    icon: Bell,
    title: 'Price alerts',
    sub: 'Go to page',
    action: null,
  },
]

const HINTS = [
  { keys: ['↑', '↓'], label: 'navigate' },
  { keys: ['Enter'], label: 'open' },
  { keys: ['Esc'], label: 'close' },
]

export default function S11Palette() {
  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Command palette"
          title="Keyboard first."
          lede="⌘K jumps anywhere — symbols, pages, trade actions — with full keyboard control."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8">
          <div className="w-full overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--ink-900)] shadow-[var(--shadow-float)]">
            <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4">
              <Search size={20} className="shrink-0 text-[var(--stone)]" aria-hidden="true" />
              <input
                type="text"
                readOnly
                value="Search markets, symbols, commands…"
                aria-label="Search markets, symbols, commands (static preview)"
                className="h-12 w-full min-w-0 bg-transparent text-sm text-[var(--stone)] outline-none"
              />
              <kbd className="shrink-0 rounded-md border border-[var(--hairline)] bg-[var(--ink-950)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--stone)]">
                ⌘K
              </kbd>
            </div>
            {/* Row geometry mirrors the palette's own list: a full-width action
                row plus a 2-up go-to pair, with `sub` right-anchored so both
                edges of every row carry content. */}
            <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
              {ROWS.map((r) => (
                <div
                  key={r.title}
                  className={`flex min-h-[52px] items-center gap-3 rounded-lg px-3 py-2 ${r.action ? 'sm:col-span-2' : ''}`}
                >
                  <r.icon size={16} className="shrink-0 text-[var(--brass)]" aria-hidden="true" />
                  <p className="min-w-0 truncate text-sm font-semibold text-[var(--ivory)]">{r.title}</p>
                  <p className="ml-auto min-w-0 shrink truncate text-xs text-[var(--stone-muted)]">{r.sub}</p>
                  {r.action && (
                    <span className="shrink-0 rounded-full bg-[var(--ivory)] px-3 py-1 text-xs font-semibold text-[var(--ink-950)]">
                      {r.action}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="mf-meta mt-3">
            Static preview — the live palette filters as you type.
          </p>
        </Illustrative>
      </LReveal>
      <LReveal delay={0.16}>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {HINTS.map((h) => (
            <li
              key={h.label}
              className="flex min-h-[44px] items-center gap-2 text-[13px] text-[var(--stone-muted)]"
            >
              <span className="flex gap-1">
                {h.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-md border border-[var(--hairline)] bg-[var(--ink-950)] px-2 py-1 text-xs font-semibold text-[var(--stone)]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              {h.label}
            </li>
          ))}
        </ul>
      </LReveal>
    </Section>
  )
}
