// Leaf-route error UI. Rendered inside RootLayout (header/AppShell chrome
// survives), so a failed lazy chunk can never blank the whole app and
// navigation stays available as a recovery path.
//
// Recovery honesty (verified Oct 2026): browsers cache failed module fetches
// per URL, so re-rendering the same chunk in-page rejects instantly without
// re-fetching — an in-place "try again" that only remounts the same component
// cannot work. The genuine recovery is a full reload (fresh module registry),
// which is what the primary button does. The Home link is guaranteed to work
// because / ships in the initial bundle (never lazy).
import { useEffect, useRef } from 'react'
import { useNavigate, useRouteError } from 'react-router'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { Button } from './ui/Button'

export default function RouteError() {
  const navigate = useNavigate()
  const routeError = useRouteError()
  const headingRef = useRef(null)

  // Move focus to the error on mount so screen-reader users land on it
  // instead of silently sitting on a dead page.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const isChunkFailure =
    routeError instanceof TypeError ||
    /dynamically imported module|loading chunk|chunk/i.test(String(routeError?.message || routeError || ''))

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 sm:py-24 text-center" role="alert" aria-live="assertive">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--loss)]/10 text-[var(--loss)]">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-bold tracking-tight text-[var(--ivory)] focus:outline-none">
        This page didn&rsquo;t load
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--stone)]">
        {isChunkFailure
          ? 'The download was interrupted before this page arrived — usually a dropped connection or a new release going live mid-visit. Reloading fetches a fresh copy.'
          : 'Something went wrong showing this page. Reloading usually fixes it.'}
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="primary"
          className="flex-1 py-2.5"
          onClick={() => window.location.reload()}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Reload page</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1 py-2.5"
          onClick={() => navigate('/')}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          <span>Back to home</span>
        </Button>
      </div>
      <p className="mt-4 text-xs text-[var(--stone-muted)]">
        If reloading keeps failing, check your connection and try again in a minute.
        Your portfolio and funds are unaffected — nothing was submitted.
      </p>
    </div>
  )
}
