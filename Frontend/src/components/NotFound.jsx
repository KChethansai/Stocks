import { Link } from 'react-router'

const ROUTES = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Markets', path: '/markets' },
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Activity', path: '/activity' }
]

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[13px] text-[var(--stone)]">Page not found</p>
      <h1 className="mt-2 font-display text-[40px] leading-tight text-[var(--ivory)]">
        This page does not exist.
      </h1>
      <p className="mt-2 text-sm text-[var(--stone)]">
        The link may be wrong, or the page may have moved.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {ROUTES.map((r) => (
          <Link
            key={r.path}
            to={r.path}
            className="rounded-lg border border-[var(--hairline)] bg-[var(--ink-900)] px-4 py-2 text-xs font-medium text-[var(--ivory)] transition-colors hover:border-[var(--hairline-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
          >
            {r.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
