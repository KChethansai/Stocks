import { Link } from 'react-router'
import Logo3D from './Logo3D'

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-[#09090B] py-12 text-[#9CA3AF] text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <Link to="/" className="flex items-center group">
            <Logo3D size="xs" showText={true} textClassName="text-sm" />
          </Link>
          <p className="text-[0.7rem] text-[#667085] text-center md:text-left">
            Institutional-grade paper trading platform. 100% simulated market data & risk-free execution.
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <Link to="/about" className="hover:text-[#F5F7FA] transition">
            About
          </Link>
          <Link to="/features" className="hover:text-[#F5F7FA] transition">
            Features
          </Link>
          <Link to="/login" className="hover:text-[#F5F7FA] transition">
            Sign In
          </Link>
          <Link to="/register" className="hover:text-[#F5F7FA] transition">
            Create Account
          </Link>
        </div>

        <p className="text-[0.68rem] text-[#667085]">
          © {new Date().getFullYear()} MarketForge. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
