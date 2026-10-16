import { Link } from 'react-router'
import Logo3D from './Logo3D'
import { useAuth } from '../store/authStore'

const linkClass =
  'block py-1 text-[13px] text-[var(--stone)] transition hover:text-[var(--ivory)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] rounded'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'About', to: '/about' },
    ],
  },
  {
    heading: 'Account',
    auth: true,
  },
  {
    heading: 'Source',
    links: [{ label: 'GitHub repository', to: 'https://github.com/KChethansai/Stocks', external: true }],
  },
]

export default function Footer() {
  const { isAuthenticated } = useAuth()

  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--ink-950)]" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center" aria-label="MarketForge home">
              <Logo3D size="xs" showText={true} textClassName="text-sm" />
            </Link>
            <p className="mt-3 max-w-xs text-[13px] leading-5 text-[var(--stone)]">
              Paper trading with real market data and simulated execution.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={`Footer — ${col.heading}`}>
              <p className="text-[13px] font-medium text-[var(--ivory)]">{col.heading}</p>
              <div className="mt-2">
                {col.auth ? (
                  isAuthenticated ? (
                    <>
                      <Link to="/dashboard" className={linkClass}>
                        Dashboard
                      </Link>
                      <Link to="/profile" className={linkClass}>
                        Profile
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/login" className={linkClass}>
                        Sign in
                      </Link>
                      <Link to="/register" className={linkClass}>
                        Create account
                      </Link>
                    </>
                  )
                ) : (
                  col.links.map((l) =>
                    l.external ? (
                      <a key={l.label} href={l.to} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {l.label}
                      </a>
                    ) : (
                      <Link key={l.label} to={l.to} className={linkClass}>
                        {l.label}
                      </Link>
                    )
                  )
                )}
              </div>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-[var(--hairline)] pt-6">
          <p className="text-xs leading-5 text-[var(--stone-muted)]">
            Simulated trading. Not investment advice. Quotes via Yahoo Finance and may be delayed.
          </p>
          <p className="mt-2 text-xs text-[var(--stone-muted)]">
            © {new Date().getFullYear()} MarketForge. Built by K Chethan Sai.
          </p>
        </div>
      </div>
    </footer>
  )
}
