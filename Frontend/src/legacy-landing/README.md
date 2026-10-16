# Archived landing page (pre-redesign, 5 sections)

Byte-identical copies of the landing implementation that `/` used before the
MarketForge rework: `Home` + `Hero/Control/Analytics/Forecasts/ExitScene` +
`LandingPreloader`. See `manifest.json` for md5 hashes (all verified identical
to HEAD `de208be8` at archive time).

## What is NOT copied (shared, stayed live)

`Header`, `Footer`, `Logo3D`, `About`, `Features`, `RootLayout`, `index.css`
(incl. `[data-landing]` scope + tokens), `lib/motion`, `hooks/useReducedMotion`,
chart modules, stores, `utils/format`. The archived scenes import these via
relative paths that resolve from `src/components/` — the copies here are
archival records, intentionally not imported by anything, so they are excluded
from the production bundle automatically.

## Restore (exact steps)

1. `cp src/legacy-landing/Home.archived.jsx src/components/Home.jsx`
2. `cp src/legacy-landing/scenes/*.jsx src/components/scenes/`
3. `cp src/legacy-landing/landing/LandingPreloader.jsx src/components/landing/`
4. In `src/App.jsx`, point the index route back at `Home` (see git history if the
   new landing changed the wiring).
5. Verify: `md5sum` the restored files against `manifest.json`.
6. Alternative without touching the tree: `git worktree add /tmp/mf-legacy de208be8`
   and run that worktree (it predates the rework).

## Dev preview

No live `/legacy` route is wired: rendering the archive would require rewriting
its imports (breaking byte-identical integrity) or duplicating live components
into the bundle. Use the git-worktree step above for a runnable preview.
