// Below-fold code deferral for the landing route. Sections S02–S11 load as
// separate chunks only when the visitor scrolls near them (600px root margin
// preloads before visible), keeping the initial landing payload to S01Hero +
// shell. The anchor shell renders immediately with the section id, so /#how
// deep links, nav anchors, and test locators resolve before the chunk loads.
// Before loading, the shell holds a min-height to avoid layout-shift jumps;
// after loading, the section owns its layout entirely (shell is height-auto).
//
// Failure containment (Oct 2026): each section resolves its module into
// local state behind a per-section error card, so one failed chunk can never
// blank the landing the way the router default boundary did. Recovery is
// two-tier and honest about the platform:
//   1. "Try again" re-runs the import() call. This genuinely refetches on
//      Firefox (verified: retries re-hit network); on Chromium a recorded
//      network failure rejects instantly from the module cache. (A React.lazy
//      instance would be worse everywhere: the rejected payload is cached on
//      the instance, so boundary resets alone re-throw forever — hence
//      explicit resolution instead of lazy().)
//   2. If the fresh attempt also fails, "Reload page" does a full reload —
//      the only recovery that clears the module registry on every engine.
//   No auto-retry loop: every attempt after the first needs an explicit click.
import { Suspense, useEffect, useRef, useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { retryImport } from '../../lib/lazyWithRetry'
import { Button } from '../ui/Button'

// Conservative per-slot reserve heights (px) so the scrollbar and anchor
// offsets stay stable before each chunk loads. Generous, not exact.
const RESERVE = {
  how: 900,
  markets: 800,
  ticket: 900,
  portfolio: 700,
  analytics: 800,
  alerts: 800,
  forecasts: 700,
  activity: 600,
  news: 700,
  workspace: 700,
}

const SECTION_TITLES = {
  how: 'How it works',
  markets: 'Markets',
  ticket: 'Ticket',
  portfolio: 'Portfolio',
  analytics: 'Fund analytics',
  alerts: 'Alerts',
  forecasts: 'Forecasts',
  activity: 'Activity',
  news: 'News',
  workspace: 'Workspace',
}

function SectionFallback() {
  return (
    <div
      className="mx-auto max-w-5xl px-5 sm:px-8 py-14 sm:py-20"
      role="status"
      aria-busy="true"
      aria-label="Loading section"
    >
      <div className="h-6 w-40 rounded bg-white/[0.06]" />
      <div className="mt-4 h-10 w-3/4 rounded bg-white/[0.04]" />
      <div className="mt-6 aspect-[2/1] rounded-xl bg-white/[0.03]" />
    </div>
  )
}

function SectionError({ sectionId, retried, onRetry }) {
  const title = SECTION_TITLES[sectionId] || 'This section'
  return (
    <div
      className="mx-auto max-w-5xl px-5 sm:px-8 py-14 sm:py-20"
      role="alert"
      aria-live="polite"
      aria-label={`${title} did not load`}
    >
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ivory)]">
          <AlertTriangle className="h-4 w-4 text-[var(--warning)]" aria-hidden="true" />
          {title} didn&rsquo;t load
        </p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[var(--stone)]">
          {retried
            ? 'Still unavailable — your connection may be down or a new release may be going live. Reloading fetches a fresh copy.'
            : 'The download was interrupted. Trying again usually fixes it — everything else on this page is unaffected.'}
        </p>
        {retried ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reload page</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRetry}
            className="mt-4"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Try again</span>
          </Button>
        )}
      </div>
    </div>
  )
}

export default function DeferredSection({ id, load }) {
  const ref = useRef(null)
  const [near, setNear] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [SectionComponent, setSectionComponent] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (near) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px 0px 600px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])

  useEffect(() => {
    if (!near) return
    let live = true
    setFailed(false)
    retryImport(load)
      .then((mod) => {
        if (live) setSectionComponent(() => mod.default || mod)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [near, load, attempt])

  return (
    <div id={id} ref={ref} className="scroll-mt-24" style={near ? undefined : { minHeight: RESERVE[id] || 600 }}>
      {near ? (
        failed ? (
          <SectionError sectionId={id} retried={attempt > 0} onRetry={() => setAttempt((a) => a + 1)} />
        ) : SectionComponent ? (
          <Suspense fallback={<SectionFallback />}>
            <SectionComponent />
          </Suspense>
        ) : (
          <SectionFallback />
        )
      ) : null}
    </div>
  )
}
