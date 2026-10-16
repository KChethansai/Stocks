# Checkpoint / evidence ledger — MarketForge rework

Loop used: Agent Hub `continuous-agent-loop` + `ralphinho-rfc-pipeline` (no skill
literally named "Ralph Loop" exists; this is the closest canonical loop,
recorded as substitution). Cycle per stage: implement → review code → test →
inspect visually → refine → fix → retest. Browser: Playwright MCP-equivalent
tooling via the environment's Playwright browser tools (`browser_navigate`,
`browser_snapshot`, `browser_take_screenshot`, …) driving real Chrome against
the live dev servers — no Playwright MCP server process exists here, recorded
as substitution.

## Mandatory checkpoints

- [x] **Original landing preserved.** `Frontend/src/legacy-landing/`
  (Home.archived + 5 scenes + preloader, md5-verified byte-identical to HEAD
  `de208be8`), `manifest.json`, `README.md` with exact restore steps.
  Old scenes import-free → excluded from the production bundle.
- [x] **New long-form landing complete.** 12 sections (`landing-new/`,
  S01–S12), each mapped to a shipped feature; compositions A (Ticket→Review→
  Receipt) and B (honest signal); hero with live mini-ticket + the single
  permitted scroll treatment; `/` wired to `HomeNew`. Shots: `mf-new/hero-1440,
  sec-ticket, sec-forecasts, sec-craft, landing-390, landing-comfort`.
- [x] **Consistent palette/charts/stock interfaces/icons/responsive.**
  Token purge across 23 files + sweep (token gate clean, incl. CSS);
  ivory/brass chart system, symbol-hash donut ramp + hatched Other,
  lucide 1.75px global, responsive specs 06 green.
- [x] **Navbar Trade symbol selection, no forced AAPL.** Selector → ticket →
  review → receipt in `TradeModal`; `stocks[0]` fallback deleted. e2e
  `08-trade-selector` 4/4 (chromium + firefox). Bug reproduced live before fix
  (`mf-baseline/trade-aapl-fallback.png`).
- [x] **Velocity scrolling + reduced motion.** Hero-only scale/fade (D2),
  no libraries; comfort/OS-reduced renders static final state (shot
  `landing-comfort.png`); comfort preference e2e-persisted.
- [x] **Profile redesigned, persists.** Workspace with 5 sections, real
  validation, dirty state, avatar upload/remove (real endpoints), Google
  provider note. e2e `09-profile` 6/6 (chromium + firefox).
- [x] **Tests/lint/build.** Full suite 60/60 on chromium-desktop first attempt
  (integrity pass, `pw-integrity-final3.log`); `08`+`09`+`10` 16/16 firefox;
  lint 0 errors; build green; `tokens:check` clean; Phase0 13/13 post-fix.

## Real bugs found by this rework's tests (not pre-existing reports)

1. Fractional qty 1.5 filled as 1 share (`parseInt` coercion). Fixed in
   `tradeService.js` (validate raw `Number`), verified 400s + Phase0 13/13.
2. Wrong-current-password 401 triggered global session-expiry logout. Fixed at
   source: backend returns 400. Verified no logout + field error.
3. Portfolio liquidation modal lacked focus trap/Escape (review finding).
   Routed through `Dialog`.

## Evidence locations

- Baselines: `/home/chethan/.tmp/opencode/mf-baseline/` (7 shots).
- After: `/home/chethan/.tmp/opencode/mf-new/` (10 shots).
- Arena record: `Stocks/.arena/run-20261015-212502-s594025/` (gitignored).
- Decisions/matrix: `Frontend/docs/redesign/DECISIONS.md`, `COMPONENTS.md`.
- Suite logs: `/home/chethan/.tmp/opencode/pw-rework-full.log` (52/54, 2 fixed
  after), `/home/chethan/.tmp/opencode/pw-final.log` (final regression).
- Progress ledger: `/home/chethan/.tmp/opencode/marketforge-progress-ledger.md`.

## Commands (portable — never commit a personal absolute path)

- Seed (isolated DB): `cd Backend && PWTEST_DB_URL=<test-db-url> node scripts/seedPwTest.js`
- Backend (test DB): `cd Backend && DB_URL="<same-test-db-url>" PORT=4101 AUTH_RATE_LIMIT_MAX=1000 node server.js`
- Frontend: `cd Frontend && VITE_API_URL=http://localhost:4101 npx vite --port 5173`
- Suite: `cd Frontend && npm run e2e` (flock-serialized; never bare `npx playwright test` concurrently)
- Unit: `cd Backend && npm run test:unit`; `cd Frontend && npm run test:unit`
- Gates: `npm run lint`, `npm run tokens:check`, `npm run build`,
  `cd Backend && node scripts/verifyPhase0.js` (drops its derived DB — test cluster only)

## Blocked / unverified (evidence-backed, not passed)

- WebKit: host missing browser deps (`install-deps` needs sudo — not run).
  Firefox covers the second engine instead.
- Screen reader, physical devices, OAuth round-trip, production migration:
  unchanged from prior ledger, still unverified.
- Landing initial ≈274KB gzip (rework tree) → 279.4KB (release) →
  280.7KB gzip (launch-validation: +RouteError + section boundary in entry)
  vs ≤220KB target: UNMET — no waiver claimed. The earlier "waived with
  evidence" note is a PROPOSED exception for the owner, not approval.
  Remainder ≈60KB = React core + live hero charts + motion (see D28 for
  measured contributors, impact, and non-redesign options).

## Refinement round 2 (D8–D10, Oct 2026)

Loop: `continuous-agent-loop` + `ralphinho-rfc-pipeline` (verified — no literal
"Ralph Loop" skill exists; mapping re-confirmed from both SKILL.md files).
Browser: real Chrome via Playwright browser tooling (no Playwright MCP server
process in this env — same substitution as round 1).

- [x] **Navbar compact (D8).** Refresh merged INTO the quote pill on lg+ (pill
  is now a labeled button, icon trailing, `aria-label` carries timestamp);
  standalone icon on 480px–lg; palette "Refresh prices" covers <480px touch
  (browser evidence at 360px: a fourth icon pushed Trade off-screen — fixed,
  `verify-360.png` shows full bar fitting). Cash chip always visible, compact
  truncated with `title` fallback. Palette gains exactly two Actions rows.
  Escape closes menus with focus return; bell has unread `aria-label`; avatar
  trigger labeled with `aria-expanded`; Trade label always visible, min-44px.
- [x] **Profile compact (D9).** Summary-header card (~180px) + always-mounted
  `xl:grid-cols-2` grid (Login+Security, Preferences+Data); no unmounting tabs
  (dirty-state safety). All 5 anchors mounted; every feature preserved
  (avatar upload/remove, login validation + conflict mapping, pw show/hide +
  strength + Google guard, MotionToggle, data links, dirty dots, aria-live,
  error focus). Account card height asserted <420px in e2e.
- [x] **Public charts genuine (D10).** S01 NVDA ticket + S03 AAPL/1M candles
  via shared `fetchHistory` cache; headers verified against API (NVDA 942.81,
  AAPL 227.14, real Sep–Oct date axes). S06 seed mapping deleted (symbol-free
  `exampleCurve`); S05/S07 labeled samples with Sample badges + row
  `aria-label`s. Quote vs series freshness kept separate; seed reachable only
  in explicit offline `sample` state. Request volume at the time: 4 stock-api
  requests per landing load (2 history + 2 quotes) — superseded by the
  integrity-pass measurement (6 calls / 5 unique: history NVDA/AAPL/MSFT/SPY +
  stocks), then by the release-pass deferral (below-fold sections no longer
  fetch on initial load; only the hero ticket's history fires).
- [x] **Independent review applied.** `reviewer` APPROVE-WITH-CHANGES: fixed
  stale-closure rows read (rowsRef), catch-to-sample mislabel (offline-only
  sample; online throws → error/stale), avatar trigger naming, <480px touch
  targets, error-state header quote fallback. keepPrevious kept as documented
  option (no authenticated consumer yet — TerminalCharts path untouched).
- [x] **Regression tests.** New `e2e/10-refinement.spec.js` (6 tests: navbar
  essentials, palette actions, profile preservation, genuine-chart labels,
  360px Trade fit, intercepted-failure error + retry recovery). Full suite
  60/60 chromium-desktop first attempt + 16/16 firefox (08+09+10) in the
  integrity pass.
- [x] **Archived landing intact.** `legacy-landing/` unmodified (no diff
  entries); manifest + README untouched.
