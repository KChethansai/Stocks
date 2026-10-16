# Component-selection matrix — MarketForge rework

Sources researched October 2026 from the canonical vault
(`IMP/Ultimate UI & Design Resources.md`, read in full). "Verified" = checked
live docs/license during this rework; "vault-stated" = per the vault index only.
New runtime dependencies installed: **zero** — every adoption is either already
in `package.json` or a hand-adapted pattern. Rationale per row.

| Source (URL) | Component / pattern | Placement | Adaptation | Dep cost | A11y notes | License | Decision |
|---|---|---|---|---|---|---|---|
| https://lucide.dev/ (vault §14) | Lucide icon family, 1.75px stroke, 14/16/20/24 sizes | Entire app (re-cut all icons) | Stroke normalized from 1px/2px mix; fill banned except watchlist star | Already installed (`lucide-react`) | Icons pair with text; status never color-alone | ISC (verified, package) | **Adopt** as the single primary family |
| https://motion.dev/ (vault §05) | Motion `whileInView` reveals, dialog transitions | Landing sections, Dialog/sheet | Reveal: opacity/y≤16px/220ms/once; durations tokenized; comfort → static | Already installed (`motion`) | Respects reduced-motion + app comfort mode; focus trap unchanged | MIT (verified, package) | **Adopt**; GSAP ScrollTrigger and Lenis explicitly **rejected** (break anchors/dialogs/sticky per D2) |
| https://www.tremor.so/ (vault §08) | KPI-card anatomy (label/value/delta hierarchy) | Dashboard stat cards | Pattern adapted to Ink/Ivory/Brass tokens; no Tremor code used | Zero (pattern only) | Delta keeps icon + text, 4.5:1 pairs | Apache-2.0 (vault-stated; not installed so no obligation incurred) | **Adapt pattern**, do not install (Recharts-based; would duplicate visx) |
| https://bklit.com/ + https://github.com/bklit/bklit-ui (vault §08) | Candlestick/area chart polish (profit-loss line, live line) | Market + analytics charts | Ideas folded into visx tokenization (ivory line, brass-dashed benchmark, gain/loss candles) | Zero (pattern only) | Keeps adapter status states + Retry + text badges | MIT (verified via GitHub LICENSE raw, Oct 2026) | **Adapt ideas**, no migration (no demonstrated visx limitation justifies a rewrite) |
| https://tailark.com/ (vault §04) | Marketing section composition rhythm | New 12-section landing | Section cadence adapted; all markup original to MarketForge tokens | Zero | Semantic sections, anchor offsets, 44px targets | Mixed free/premium (vault-stated; no code copied) | **Adapt composition**, no code copied |
| https://motion-primitives.com/ (vault §02) | Micro-interaction restraint (exit-faster, interruptible) | Buttons, sheets, reveals | Timing tokens `--mf-duration-*`; comfort forces opacity-only | Zero | Reduced-motion first-class | FOSS (vault-stated) | **Adapt principles** via installed `motion` |
| https://shaders.paper.design/ (vault §07) | Paper Shaders backgrounds | Nowhere | — | — | GPU/mobile cost | Apache-2.0 (vault-stated) | **Reject** (no composition needs it; perf budget) |
| https://www.radix-ui.com/colors (vault §12) | Semantic scale method | Token ramp construction | Method followed (text pairs verified ≥4.5:1) | Zero | Contrast-first | MIT (vault-stated) | **Adapt method** |

## Retained foundations (not replaced)

- visx chart stack + `TerminalCharts` adapters (tokenized, not rewritten).
- shadcn-style primitives + custom Dialog/Select/SegmentedControl (reviewed, kept).
- `react-hot-toast` as the single transient channel (brief requirement).
- No TanStack Table (native tables kept — prior documented decision stands).
- No smooth-scroll library, no new icon family, no new chart engine.
