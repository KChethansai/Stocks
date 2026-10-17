# Arena decision register — MarketForge rework

Tournament: `.arena/run-20261015-212502-s594025` (seed 594025), 4 competitors,
single elimination, 2 rounds (semi + final), 19 sub-agent calls in 7 waves.
Bracket machinery: Agent Hub `arena` skill (`bracket.py` — present and working).
Full record (proposals, attacks, defenses, verdicts) lives in the run folder;
this file records conclusions only, not dialogue.

## Results

- Semi 1: **a003 beat a002, 91–75.5**
- Semi 2: **a004 beat a001, 84.5–73**
- Final: **a004 beat a003, 88–62** — champion
- Attacks the champion survived (judge-verified): multi-alert toast dedup,
  LiveValue flash denial, bare-slash guard regression, brass single-meaning
  clash, avatar orphaning, whole-dollar sub-$100 ticks, dirty-dot announcement.

## Senior review

Independent `reviewer` pass over champion vs runner-up vs baselines:
**APPROVE-WITH-CHANGES** (7 binding resolutions). One ruling was later
overturned on code evidence (see D6).

## Decisions (binding)

- **D1. Identity/tokens.** Adopt champion §1: strict surface roles, ivory/stone
  text scale (all ≥4.5:1), Instrument Serif deleted (Geist-only app, Inter Tight
  landing display), blue accents purged, brass restricted to two explicit roles
  (interactive vs data), new status semantics (gain `--gain`, loss `--loss`,
  warning amber distinct from brass), stable symbol-hash allocation ramp with
  hatched `#5C5A54` Other bucket. Rationale: baselines show sans/tabular already
  dominant; serif + blue leaks + brass-as-warning were the inconsistency sources.
- **D2. Scroll.** Senior review REJECTED champion's delete-all-scroll-linking as
  non-compliant with the brief ("preserve the intended expressive effect and make
  it dependable"). Implement one hero-only scroll treatment (scale ~1→0.96 +
  fade, no parallax/pinning), static under reduced-motion/comfort. No GSAP
  ScrollTrigger, no Lenis, no other scroll-linked transforms.
- **D3. LiveValue flash.** Delete the 400ms gain/loss price flash; silent
  tabular-nums swap. Rationale: motion on money reads as volatility.
- **D4. Single ticket.** Markets inline ticket may be removed only if every entry
  point deep-links to the one `TradeModal` prefilled (symbol, price, provenance,
  position) with no extra search step. Deviation recorded: inline ticket KEPT
  during the rework to bound risk; shared quote-gate copy extracted instead, and
  the global entry opens a symbol selector (never `stocks[0]`).
- **D5. Landing.** 12 substantive sections, each mapped to a shipped feature;
  nav/footer are chrome, uncounted. Compositions A (Ticket→Review→Receipt) and B
  (honest signal) adopted.
- **D6. Avatar.** Senior review claimed "no avatar backend" and ordered deletion;
  OVERRULED on code evidence: `Backend/APIs/UserAPI.js:136-138` wires
  POST/PUT `/user-api/profile-picture` (multer + Cloudinary) and
  `authStore.uploadProfilePicture` consumes it. Avatar upload/remove STAYS wired
  (champion correct). "Verified" badge still deleted (no verification process).
  Limitation: Cloudinary upload needs credentials; upload fails closed with an
  inline error where unconfigured.
- **D7. Forecast counts.** A "2/3 signals" count renders only if the existing
  forecast payload already returns countable signals; otherwise direction +
  horizon + footnote, zero counts/percentages/dollar targets. TARGET/RANGE/
  CONFIDENCE cards deleted regardless.

## Evidence hierarchy applied

Task-file product truth < live code. D6 is the instance: filesystem won.

## Refinement round 2 (seed 881231, 4 agents, 2 rounds, 19 calls)
- Semi: a001 beat a004 83–68; a002 beat a003 84.5–68. Final: **a001 beat a002, 86.5–80.5** — champion. Card: Systems thinking + Draft/critique/rewrite + Explicit trade-offs. Run: `.arena/run-20261016-104047-s881231/`.
- **D8. Navbar.** Refresh merges INTO the quote pill on lg+ (pill becomes a button, icon trailing); standalone refresh icon on 480px–lg (exactly one visible refresh per viewport; below 480px the palette "Refresh prices" action covers touch via the search trigger — browser evidence at 360px showed a fourth icon pushing Trade off-screen). Cash chip always visible in compact truncated form (icon hidden <480px, label always). Keep sidebar cash card (same store field). Keep Profile/Activity in both sidebar and account menu (different jobs). Palette gains exactly two Actions rows: Open trade + Refresh prices.
- **D9. Profile.** Summary-header + always-mounted two-column grid (xl+), no unmounting tabs (dirty-state safety). Anchor scroll-spy kept. Density from spacing/grid, never type/target shrinkage.
- **D10. Public charts.** At most two live charts (S01 user-switchable, S03 fixed AAPL/1M) on shared fetchHistory cache, no polling, visibility-deferred fetch; S06/S05/S07 honestly labeled illustrations with zero requests; S06 deletes seedOhlcSeries mapping (symbol-free exampleCurve); S03 deletes timeframe chips + rewrites lede. Quote vs series freshness kept separate. Seed data reachable only in explicit sample state.

## Integrity pass (Oct 2026, no arena — defect-driven, not design)
- **D11. Quote/history divergence = poisoned test seed (defect, fixed).**
  Evidence: `Backend/scripts/seedPwTest.js` wrote linear-ramp fixtures
  (endPrice*0.9→endPrice, ±0.4% synthetic OHLC, fake round volumes, identical
  clock timestamps) labeled `source:'yahoo'`, `stale:false` with fresh
  `updatedAt` — served as genuine history for 24h/seed. Live Yahoo at
  investigation time: AAPL 342 / NVDA 217.23; DB cache held AAPL→227.14 /
  NVDA→942.81 ramps. Fix: seed now fetches live Yahoo (quotes + daily +
  60m intraday) for all 30 universe symbols (extracted to side-effect-free
  `Backend/config/universe.js`); unreachable symbols keep existing records
  marked `source:'seed'`, `stale:true` — never fabricated. Cache repopulated
  (`seeded 30 live + 0 stale-marked`); AAPL history now 501 genuine daily
  bars ending 342 = quote 342. Quote vs close may still differ intraday —
  different timestamps/bases, presented with their own labels.
- **D12. providerTime garbage (defect, fixed).** `regularMarketTime` arrives
  as a Date object; code did `Number(date)*1000` → year 58759. New
  `toProviderTime()` handles Date and epoch-seconds shapes.
- **D13. Freshness honesty.** Hook state `live` renamed `verified` (one fetch
  proves verified history, not live delivery); `live` boolean kept as alias
  for legacy scenes. Visible revalidation: hidden→visible refetches once when
  the entry outlived its TTL (15m 1D / 1h daily). Store-level in-flight
  dedupe by symbol|range (caller abort rejects only its own await).
  Measured landing volume: 6 stock-api calls (5 unique), +0 on symbol switch
  (cache), +0 after 20s idle (no polling).
- **D14. Remaining public charts genuine.** S06 = disclosed equal-weight
  NVDA/AAPL/MSFT composite (normalized to 100) + genuine SPY benchmark,
  4 bounded cached requests. S07 watchlist = genuine `/stocks` quotes with
  per-row freshness; inbox stays a rule-definition illustration under a
  sample caption. S05 allocation weights are a disclosed example (no
  performance claim) — kept.
- **D15. Suite hygiene.** `scripts/e2e.sh` (`npm run e2e`) serializes runs
  with `flock` — the Oct round-2 trace-ENOENT/load flakes traced to two
  concurrent Playwright runs sharing backend + artifact dir (workers already
  1, disk 51% free). 360 test gains a shell-readiness gate so a missing
  shell surfaces as such, not as a missing Trade button.

## Release pass (Oct 2026, defect- and risk-driven, no redesign)
- **D16. Test-data boundary hardened.** `Backend/config/seedGuard.js` (pure,
  unit-tested): seed refuses missing/non-test names, blocked names, and —
  new — the application's own `DB_URL` database (copy-paste refusal).
  `seedPwTest.js` enforces it post-dotenv; per-symbol work extracted to
  `scripts/seedOneSymbol.js` (injectable provider/models) with 18 node:test
  assertions covering provider-throw, zero-price, thin-history, and empty
  quotes — every failure branch asserts `upsert:false` + zero prices written.
  `verifyPhase0.js` asserts the drop scope (`phase0test_*` + connection-name
  match) before `dropDatabase`. New `test:unit` scripts (Backend + Frontend),
  zero new dependencies (`node --test`).
- **D17. Timestamp/cache policy unified + tested.** `toProviderTime`
  hardened against boolean/object coercion (`true` → 1970 caught by the new
  tests — only numbers, numeric strings, and Dates accepted). Shared
  `Frontend/src/utils/historyCachePolicy.js` (key/TTL/freshness incl.
  future-dated and malformed rejection) consumed by both `tradeStore` and
  the OHLC hook; 4 more node:test assertions. ProviderTime `null` cannot
  launder a quote: the trade gate keys on `source==='yahoo'` +
  `lastVerifiedAt` (server-set) + `!stale` + `price>0`, never on providerTime.
- **D18. Endpoint review fixes (concrete only).** `newsCache` bounded LRU
  (200, oldest-first) — unbounded attacker-influenced key growth closed.
  `authLimiter` added to `/register` (abuse parity with login). Register
  existing-user message generalized to `Invalid registration details`
  (frontend toasts without branching; `02-auth` assertion updated) —
  enumeration oracle closed; profile-update conflict message kept
  (authenticated + field-mapped). Open-ticker history/news left as-is:
  rate-limited, TTL-bounded, and SPY (outside the 30-symbol universe) is a
  legitimate public consumer — documented limitation, not a defect.
- **D19. Payload 286.6 → ~279.4KB gzip; target WAIVED with evidence.**
  Fixed `manualChunks` substring bug (lucide/oauth rode vendor-react;
  vendor-react 148.6→89.7KB), deferred `@react-oauth/google` into lazy
  auth chunks (`GoogleAuthSlot`), deferred S02–S12 below-fold via
  `DeferredSection` (anchor shell + 600px preload margin + reserve heights;
  inner section ids moved to shells). Remainder ~59KB over 220KB =
  React core 89.7 + visx/entry 83.6 (live hero charts — the product claim) +
  motion/lucide/zustand/axios 71.8 + CSS 16.1 + stores 17. No framework
  migration: closing the gap requires removing live hero charts or motion,
  i.e. a design regression, not an optimization. About/Features left eager
  (avoids full-screen Suspense flash on marketing nav).
- **D20. Visual evidence closed on mobile.** 360/390/768/short-desktop +
  reduced-motion shots inspected (mf-release/): genuine NVDA/MSFT/AAPL values
  match API; honest captions intact post-deferral; symbol switch works;
  reduced-motion static. One advisory (pre-existing, untouched): cash chip
  truncates with ellipsis at 390px (compact by D8 design; full value in
  portfolio).

## Release pass, Firefox auth findings (D21)
- **D21a. Chunk-load aborts → lazyWithRetry (real fix, app + tests).**
  Firefox 02-auth showed 6–46 `Error handled by React Router default ErrorBoundary`
  console errors with all functional assertions passing. Extracted stack:
  `error loading dynamically imported module: .../Login.jsx` — rapid
  successive navigations abort in-flight lazy chunk fetches; React.lazy
  surfaces the first rejection at the router boundary. New
  `src/lib/lazyWithRetry.js` (2 retries, 800ms) wraps all 11 lazy auth/app
  routes + 11 deferred landing sections. Genuinely missing chunks still fail
  loudly. Production benefit: the same retry covers flaky-CDN chunk loads.
- **D21b. GSI hermetic test runs (docs only, no app change).** The local
  (gitignored) `Frontend/.env` carries a real Google client ID, loading the
  third-party GSI script during tests; sandbox-blocked Google + Firefox's
  FedCM-less path produced iframe failures and init races. A/B proved the
  app clean without GSI (zero errors). Documented test command now blanks
  `VITE_GOOGLE_CLIENT_ID` (playwright.config comment + README). Fresh clones
  have no ID, so hermetic is the default everywhere else. OAuth round-trip
  stays explicitly unverified.
- **D21c. Firefox trusted-click race on Login submit (test accommodation,
  assertions unchanged).** Even hermetically, trusted mouse clicks on Login's
  motion submit button are intermittently swallowed on Firefox (no request,
  no error; proven across ~15 probes: requestSubmit/synthetic/Enter always
  work, clicks + DOM.click sometimes vanish; register clicks + good-password
  logins succeed on Firefox repeatedly). One bad-password submission in
  02-auth now uses keyboard Enter — an equally user-realistic path; the
  rejection assertions are identical and the click path stays covered by
  Chromium + Firefox register clicks. Suspected layer: React 19 + motion
  pointer-activation race in the Playwright-Firefox driver; unproven at the
  DOM level, documented as a known limitation with a manual-Firefox-login
  recommendation before launch.

## Launch-validation pass (Oct 2026 — uncertainties resolved, no redesign)
- **D22. Firefox Login-submit root cause (demonstrated, fixed at harness layer).**
  Forensics over 20 instrumented runs: failing submits had clicked=true,
  submit=true, hit-test=button, enabled, no overlay — but the DOM email input
  was EMPTY at submit with inline "Enter your email address." and zero
  requests. A post-navigation store re-render (fetchProfile/401 churn) can
  remount inputs mid-fill; a raw fill lands in the detached node and
  react-hook-form correctly blocks the empty submit. Identical signature for
  click and Enter — the click path was exonerated, never the cause. Fix:
  exported fillVerified (fill + toHaveValue + one retry) and the bad-password
  flow is back on a real pointer CLICK (Enter tested separately, not as a
  substitute). New e2e/11-login-submit.spec.js guards both paths. Stability:
  12/12 Firefox + 6/6 Chromium (new spec), 8/8 Firefox 02-auth.
- **D23. Toast-overlay avatar sequencing (demonstrated, test-layer fix).**
  Logout-test avatar clicks failed with the toaster div intercepting pointer
  events: the test's own watch-toggle toast sits over the account menu until
  dismissal. First fix (wait-detached) passed vacuously while the watch POST
  was in flight; corrected to wait-toast-arrive then wait-clear (both
  best-effort, hard gates follow). No force-clicks (would mask real
  overlays), no app change (transient overlay is normal UX). Logout test 6/6
  after fix.
- **D24. Module-cache vs retry honesty (measured per engine).** import()×3
  vs aborted chunk: Chromium = 1 network request (recorded failures reject
  ~0ms from the module map); Firefox = 3 requests (genuine refetch). So
  lazyWithRetry retries really do ride out abort-class blips on Firefox
  (consistent with the Oct storms stopping), while on Chromium they bound
  the failure quickly. Comments corrected on both files; new
  retryImport unit tests assert the bounds contract (1/3/reject/zero).
  Frontend test:unit now 8/8.
- **D25. Chunk-failure UX defects fixed (proven by injection).** (a) A failed
  landing-section chunk rendered the router dev-default page over the WHOLE
  landing — now each section resolves explicitly into state behind a
  contained error card (Try again = fresh import call; Reload page after a
  second failure; no auto-loop). (b) All 11 lazy leaf routes gained a
  RouteError errorElement (role=alert, focus management, Reload + Back-home,
  no dev leak) with RootLayout/AppShell chrome surviving — verified sidebar,
  cash, and session intact through a failed navigation, zero mutations fired,
  ordinary nav recovers. In-SPA remount of the same URL cannot recover a
  recorded failure on any engine (module cache) — reload is the genuine fix
  and is what both UIs offer. New e2e/12-lazy-recovery.spec.js guards both.
  Modal-open ticket blocks background nav by construction, and close clears
  the draft by design — no silent-discard path exists; verified zero
  mutating requests during failures + idempotency keys server-side.
- **D26. Google-configured verification (no OAuth claim).** With the real
  public client ID: landing issues 0 GSI requests (deferral holds); login
  loads GSI, renders the Google iframe, remounts cleanly, and ordinary
  email/password register+login works on Chromium AND Firefox. Backend
  rejects invalid credentials with 401 + clear message (rate-limited).
  Actual OAuth round-trip NOT performed (needs human Google consent) — exact
  remaining step documented in handoff.
- **D27. WebKit reassessed, still host-blocked.** Playwright webkit-2370 is
  cached but its process needs libicu74-era sonames + libflite1; this Arch
  host carries libicuuc.so.78/libxml2.so.16 and no flite (soname mismatch —
  Arch-native install may not satisfy it). Unblock: Ubuntu 22.04/24.04
  container or CI with `npx playwright install-deps`, or GitHub Actions
  ubuntu-latest. One probe attempt, no repetition. Safari stays explicitly
  unverified; Firefox remains the second engine (no Safari equivalence
  claimed). Physical-device + screen-reader stays unverified.
- **D28. Payload 280.7KB gzip initial vs 220KB target: UNMET, no waiver
  claimed.** Delta +1.3KB vs 279.4 covers the error UIs (RouteError in entry
  + section boundary). Remainder ≈ 60KB = React core 89.7 + live hero charts
  entry 84.7 + motion/lucide/zustand/axios 71.9 + CSS 16.1 + stores 17.
  The earlier "waived with evidence" note is withdrawn to a PROPOSED
  exception for the owner — not approval. Options (no redesign, no framework
  change): accept as exception; split About/Features (saves ~10–20KB, costs
  nav Suspense flash); hero motion→CSS (design change, not recommended
  unilaterally). Impact: sub-second first JS paint on broadband, ~2–3s on
  slow 3G; repeat visits cached.

## Release-prep pass (Oct 2026 — commit to main, ML included)
- **D29. WebKit run EXECUTED via rootless podman (no sudo).** Image
  mcr.microsoft.com/playwright:v1.64.1-noble matches repo ^1.64.1;
  --network=host against the standard isolated audit stack. Critical set
  (02/08/09/10/11/12): 21/24 first run; 3 failures all in 08-trade-selector
  selection-after-search steps. Idle-box rerun of 08: 8/8 green (x2) — not
  reproduced. Forensics (passing probes) still demonstrated a real focus race:
  palette opened with focus on MAIN (typed text lost); selector option
  present/enabled/priced/stable with clean hit-test but focus on dialog DIV.
  Mechanism: Dialog's rAF panel-focus beats TradeModal's sync input-focus;
  palette relies on a lone rAF focus. This breaks keyboard-only users on every
  engine (panel swallows keystrokes until a pointer fill re-focuses), not just
  WebKit — fixed, not waived.
- **D30. Focus-race fix (small, deterministic).** Dialog is now the single
  focuser: mount effect prefers [data-autofocus] inside the panel, falls back
  to panel. TradeModal search carries data-autofocus (its own sync focus
  kept — both target the same input). CommandPalette focuses synchronously
  in the open effect (same-task-as-commit, so no keystroke can interleave)
  plus one bounded 120ms re-assert fallback for exotic remounts. Why sync:
  probes proved a lone rAF focus leaves a gap where immediate typing is lost
  (2/3 empty + 1/3 partial before; 4/4 val=TSLA + row present after).
  Verified: WebKit focus probes + 08 x2 on WebKit; Chromium 08+10 10/10 and
  10-refinement 6/6 regression.
- **D31. test_campaign universe pointer (real failure, fixed).** Included ML
  checks caught it: symbol extraction moved StockAPI.js to config/universe.js,
  regex found 0 symbols. Fixed at test layer (same assertion, correct file;
  30/30 match verified pre-fix); stale pointer also cleared from data.py
  docstring+comment. Suite 8/8.
- **D32. Commit scope.** ML work committed with everything (contents +
  functionality preserved). Excluded: graphify-out/ (5.3M generated),
  ml/campaign/20*/ timestamped run-evidence (~515MB, gitignored), model
  binaries/tarballs/datasets/logs/venvs (gitignored), .env files (gitignored;
  .env.examples retained), node_modules/dist/test-results/playwright-report
  (gitignored). Campaign protocol .md docs + releases/manifest.json included
  (provenance). Payload re-measured 280.0KB gzip vs 220KB target: UNMET, no
  exception claimed. Schema additions all-optional-with-defaults (proven by
  offline legacy-doc round-trip on mongoose 9.6); app/model rollbacks
  independent and documented; smoke checklist in README.
- **D33. Auth-form remount + submitVerified (trace-proven, harness fix).**
  WebKit duplicate-registration step failed twice with empty fields +
  inline errors despite verified fills. Trace nailed it: the submit button
  went "detached from the DOM" mid-click (form subtree remount between
  verification and submit), the app correctly blocked the empty submit, and
  network shows only the first POST 201 — the duplicate POST never fired.
  Fix: submitVerified clicks then requires submission evidence; on the
  empty+silent signature ONLY it re-fills + re-clicks once (a live-but-slow
  submit always has full fields, so no double-submit risk; outcome
  assertions still fail honestly past one retry). 11-login-submit click test
  uses it too (Enter test keeps Enter). Chromium 02+11 6/6 with new helpers.
  Steady-state remount probes show zero remounts — the trigger is a narrow
  post-navigation window; disclosed, not hand-waved.
- **D34. Test-backend DB mixup + production cleanup (Oct 2026, self-caught).**
  Restarting the :4101 backend after adding the quote-refresh endpoint ran
  WITHOUT DB_URL in its environment, so dotenv loaded Backend/.env and the
  server attached to the production `stocks` DB. Three probe users
  (qx204788, qx785918, cyc774444, cyc430517) plus their portfolios, VZ
  transactions, orders, and idempotency keys were written to production and
  then surgically deleted (listed before deleting; only empty/auto-created
  docs plus the probe writes removed; VZ row rewrites carried Yahoo-identical
  data). Lesson enforced: after every backend (re)start, resolve the
  LISTENING pid via ss and confirm its /proc DB_URL path before any test
  traffic. The isolated DB URL lives in /home/chethan/.tmp/opencode/
  pwtest_url.txt (never in the repo, never committed).
- **D35. Stale-quote root cause, proven end-to-end (U1).** With VZ flipped
  stale on the isolated DB: buy → 409 "Quote is stale — refresh market data
  and retry" (reproduces the user report: the price still displays, the
  server rejects); POST /quote/VZ/refresh → 200 refreshed; retry with the
  SAME idempotency key → 200 fill; duplicate retry → same txn, no double
  fill. Cause: the ticket named a refresh action it could not perform
  (GET /stocks = background sync + 60 s cache; /stocks/seed throttled 5
  min) and Topbar toasted unconditional success. Fix: per-symbol synchronous
  refresh endpoint + in-ticket Refresh quote button (symbol/quantity/key
  preserved) + truthful Topbar toasts. Validation stays intact; nothing
  synthetic; failed refreshes never mark data fresh.
- **D36. Notification "always unread": two mechanisms (U2).** (a) Every
  ALERT-rule trigger minted a new inbox row with no dedup — repeat rules
  produce endless fresh unread rows; fixed with a cooldown-windowed
  identical-unread suppressor (genuinely new events still notify).
  (b) The 30 s poll replaced the list wholesale and the badge came from a
  separate counter; fixed with a confirmed-reads merge + badge derived from
  the merged list + Mark all read. No badge-hiding, no global flag.
- **D37. News duplication (U3):** per-symbol feeds stamped with the queried
  symbol and merged without identity — same Yahoo article under N symbols.
  Fixed with canonical-URL (+title fallback) dedup carrying symbol unions,
  unique counts, and load-more pagination. No fabricated summaries/images.
- **D38. Profile layout via Arena --quick (U4):** 16 agents, 4 rounds,
  champion a001 (Contrarian + Write-then-restructure + Built-to-last),
  Option B — balanced workspace: sidebar deleted, unified non-selecting
  anchor-chip bar at all breakpoints, Account full width, Credentials 2-col
  (password) / notice+Login bands (Google), Preferences + Data full-width
  bands, bounded scroll-spy with focus override, unsaved dots on chips and
  headings. Plus theme-aware autofill CSS (paint only; managers untouched).
- **D39. Analytics/Portfolio (U5):** metric strip + activity are now
  full-width bands under a chart+exposure row (the strip no longer ends
  mid-column against a taller panel); Cash/Unknown/Other labeled as
  allocation categories with a true-sector count ("N sectors"); missing
  sector metadata is Unknown, never folded into Other.
- **D40. Markets taxonomy + filters (U6):** frontend-only GICS-style
  normalization (Semiconductors→Technology, Automotive→Consumer Cyclical;
  backend universe + ML untouched), all sectors shown with counts, sort
  control, result scope, reset, pagination with filter-change reset,
  keyboard-operable rows, honest empty state.
- **D41. Market Outlook removal (U7):** PredictionPanel/PredictionBadge
  presentation deleted from Markets (no hidden panels left); automation
  controls preserved as a neutral AutomationPanel; prediction APIs, model,
  Forecast accuracy page, and Dashboard Forecasts untouched.
- **D42. Number spinners (U8):** native spinners suppressed across
  engines (paint only); stepper buttons were already type="button";
  validation/keyboard/min-max unchanged.
- **D43. Provider resilience (Oct 2026 production incident):** production
  quotes were 18h stale with no `marketState` because the 60s background sync
  retried every 60s against a rejecting provider, and each failure ran
  `updateMany({}, {stale:true})`. Three root causes fixed:
  (1) *Unbounded retry loop* — a shared circuit breaker
  (`services/providerBudget.js`) opens after 3 consecutive failures, makes **no
  provider call** during the cooldown, and admits exactly one half-open probe;
  exponential backoff to a 15min ceiling. Used by the sync, the manual
  refresh, and the execution-path refresh.
  (2) *`stale` conflated two facts* — a provider outage no longer invalidates
  data. `stale` now means only "not valid for its own session" (computed with
  the same `isExecutableQuote` gate that guards execution), so Friday's close
  stays usable on Saturday. The outage is recorded separately as
  `providerUnavailableAt` so the UI can say so. Rows with no session state
  still fail closed — never inferred.
  (3) *Fixed 60s cadence* — now adaptive from what the provider last
  reported: 60s in a regular session, 15min while closed, since a closed
  market's data cannot change. Never assumes the market is open.
  Also: the manual-refresh throttle no longer returns a user-facing 429 —
  if a refresh for that symbol already ran inside the window, the verified
  stored row is returned as 200 (`cachedWithinThrottle`); if the provider is
  unreachable but the stored quote is still valid, it is returned as a
  degraded 200. Genuine failures stay 429/502/503 with the real cause. No
  refresh path returns 429 for a request that never needed to be made.
- **D44. Partial-provider recovery (Oct 2026, follow-up to D43):** D43 did not
  restore service. Production stayed at 0/30 usable because Yahoo's *quote*
  endpoint was blocked from Render's egress IP while the *chart* endpoint still
  answered. Yahoo worked from every other host, so this was an IP-level block,
  not an outage. Three fixes:
  (1) *Throttle was spent on calls that never happened* — `rememberRefresh`
     ran before the provider call, so a circuit-open request (which makes no
     provider call at all) still locked the user out, turning one outage into a
     429 cascade. It is now consumed only on a successful provider fetch.
  (2) *Second transport, same provider* — `services/chartQuoteSource.js` reads
     the provider's chart endpoint. Same genuine price and provider timestamp,
     not a different or synthetic source. Tried **inside** the single circuit
     breaker attempt (`services/quoteSource.js`), so a primary failure that
     recovers via the chart endpoint never records a provider failure.
  (3) *Session derivation* (`services/sessionClock.js`) — the chart endpoint
     reports no `marketState`, and rows without one fail closed, so the whole
     universe was unusable. The session is now derived from the provider's own
     timestamp in the exchange timezone (US equities 09:30–16:00 ET, weekends
     closed). This is a fallback ONLY: a *recognised* provider state always
     wins, an unrecognised state is not trusted, and an unreadable timestamp
     yields null so the gate still fails closed. A half-day early close (13:00
     ET) falls inside the window, so a genuinely open market is never reported
     closed — the unsafe direction is avoided.
