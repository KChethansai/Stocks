import { Link } from 'react-router'
import Logo3D from './Logo3D'

// Reference footer: gradient rule element (accent-soft .075 -> .032 ->
// transparent, origin left) + meta + underline-style link cluster.
const linkClass =
  'relative inline-flex items-center min-h-[2.5rem] text-[0.9375rem] font-bold leading-none tracking-normal text-[#b7c6cf] transition hover:text-[#f8fdff] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-[#7ce6ff] after:transition-transform after:duration-200 hover:after:scale-x-100'

export default function Footer() {
  return (
    <footer className="bg-[#07090d] pt-4 pb-12" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Gradient rule (matches reference .site-footer__rule) */}
        <span
          aria-hidden="true"
          className="block h-px pointer-events-none origin-left"
          style={{
            background:
              'linear-gradient(90deg, rgba(189,247,255,0.075), rgba(189,247,255,0.032) 68%, transparent)',
          }}
        />

        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <Link to="/" className="flex items-center group" aria-label="MarketForge home">
              <Logo3D size="xs" showText={true} textClassName="text-sm" />
            </Link>
            <p className="text-[0.75rem] text-[#84949e] text-center md:text-left leading-relaxed">
              Paper trading with real market data, simulated execution, and zero real risk.
            </p>
          </div>

          <nav className="flex items-center gap-7" aria-label="Footer pages">
            <Link to="/about" className={linkClass}>
              About
            </Link>
            <Link to="/features" className={linkClass}>
              Features
            </Link>
            <Link to="/login" className={linkClass}>
              Sign In
            </Link>
            <Link to="/register" className={linkClass}>
              Create Account
            </Link>
          </nav>

          <p className="text-[0.75rem] text-[#84949e]">
            © {new Date().getFullYear()} MarketForge. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
