// New long-form landing (11 substantive sections). Replaces Home at `/`;
// the previous 5-section page is archived byte-identical under
// src/legacy-landing/ with restoration steps.
//
// Payload discipline: only S01Hero ships in the initial bundle. Sections
// S02–S11 are lazy chunks mounted through DeferredSection, which renders
// the anchor shell immediately (deep links keep working) and loads the
// chunk when the visitor scrolls near. Factories (not components) are passed
// down so a failed section can re-run the import() call on retry —
// DeferredSection resolves the module into state explicitly, because resetting
// a React.lazy boundary around the same instance would re-throw its cached
// rejection forever. See DeferredSection for the two-tier recovery contract.
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import S01Hero from './S01Hero'
import DeferredSection from './DeferredSection'

const LOADERS = {
  how: () => import('./S02Honesty'),
  markets: () => import('./S03Markets'),
  ticket: () => import('./S04Ticket'),
  portfolio: () => import('./S05Portfolio'),
  analytics: () => import('./S06Analytics'),
  alerts: () => import('./S07Alerts'),
  forecasts: () => import('./S08Forecasts'),
  activity: () => import('./S09Activity'),
  news: () => import('./S10News'),
  workspace: () => import('./S11Palette'),
}

export default function HomeNew() {
  const { hash } = useLocation()
  // Anchor support for /#how (nav "How it works"): scroll after paint so
  // reveals have mounted; no smooth-scroll library (D2). The anchor shell
  // exists immediately even when the section chunk is still deferred, so
  // deep links resolve and the chunk loads on approach.
  useEffect(() => {
    if (!hash) return
    const el = document.querySelector(hash)
    if (el) {
      const t = window.setTimeout(() => el.scrollIntoView({ block: 'start' }), 60)
      return () => window.clearTimeout(t)
    }
  }, [hash])
  return (
    <div className="min-h-screen bg-[#0B0C0E] text-[var(--ivory)] antialiased">
      <S01Hero />
      <DeferredSection id="how" load={LOADERS.how} />
      <DeferredSection id="markets" load={LOADERS.markets} />
      <DeferredSection id="ticket" load={LOADERS.ticket} />
      <DeferredSection id="portfolio" load={LOADERS.portfolio} />
      <DeferredSection id="analytics" load={LOADERS.analytics} />
      <DeferredSection id="alerts" load={LOADERS.alerts} />
      <DeferredSection id="forecasts" load={LOADERS.forecasts} />
      <DeferredSection id="activity" load={LOADERS.activity} />
      <DeferredSection id="news" load={LOADERS.news} />
      <DeferredSection id="workspace" load={LOADERS.workspace} />
    </div>
  )
}
