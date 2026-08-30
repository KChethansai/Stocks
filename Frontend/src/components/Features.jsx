import { Link } from 'react-router'
import {
  Activity,
  Zap,
  TrendingUp,
  History,
  BarChart3,
  Lock,
  Sliders,
  Bookmark,
  ArrowRight
} from 'lucide-react'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { ShimmerButton } from './magicui/ShimmerButton'
import { ShinyText } from './reactbits/ShinyText'
import { BlurText } from './reactbits/BlurText'
import { Aurora } from './reactbits/Aurora'

const featuresList = [
  {
    icon: Activity,
    title: 'Real-Time Market Quotes',
    description: 'Equities data streaming from Yahoo Finance with automatic 30s background synchronization.',
    spotlight: 'rgba(59, 130, 246, 0.2)'
  },
  {
    icon: Zap,
    title: 'Instant Execution Engine',
    description: 'Place market buy and partial sell orders with zero slippage and instantaneous balance reconciliation.',
    spotlight: 'rgba(34, 197, 94, 0.2)'
  },
  {
    icon: TrendingUp,
    title: 'Live P&L Tracking',
    description: 'Real-time calculation of invested capital, market value, unrealized profits, and total percentage returns.',
    spotlight: 'rgba(59, 130, 246, 0.2)'
  },
  {
    icon: Bookmark,
    title: 'Custom Watchlist Console',
    description: 'Pin high-conviction assets, monitor mini sparklines, and trigger rapid 1-click orders.',
    spotlight: 'rgba(245, 158, 11, 0.2)'
  },
  {
    icon: Sliders,
    title: 'Interactive Technical Charts',
    description: 'Toggle between line graphs and candlesticks across 1D, 1W, 1M, 3M, 6M, 1Y, and ALL time horizons.',
    spotlight: 'rgba(255, 77, 103, 0.2)'
  },
  {
    icon: BarChart3,
    title: 'Deep Institutional Analytics',
    description: 'Track win-rate percentages, sector concentration, asset class allocation, and return attribution.',
    spotlight: 'rgba(59, 130, 246, 0.2)'
  },
  {
    icon: History,
    title: 'Immutable Activity Ledger',
    description: 'Every filled order and cash movement is recorded in a chronological ledger with 1-click CSV export.',
    spotlight: 'rgba(34, 197, 94, 0.2)'
  },
  {
    icon: Lock,
    title: 'Enterprise-Grade Security',
    description: 'Encrypted passwords, protected JWT session cookies, and optional Google OAuth authentication.',
    spotlight: 'rgba(59, 130, 246, 0.2)'
  }
]

export default function Features() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F7FA] py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <Aurora className="opacity-15" />
      <div className="max-w-6xl mx-auto space-y-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F5F7FA]">
            <BlurText text="Platform Capabilities" delay={0.04} />
          </h1>
          <p className="text-sm sm:text-base text-[#9CA3AF]">
            Everything necessary to refine your trading edge. Built with <ShinyText>fintech precision</ShinyText> and zero fluff.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featuresList.map((feat) => {
            const Icon = feat.icon
            return (
              <SpotlightCard
                key={feat.title}
                spotlightColor={feat.spotlight}
                tiltIntensity={6}
                className="p-6 rounded-2xl border border-white/8 bg-[#111318]/90 space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#F5F7FA] font-mono">{feat.title}</h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">{feat.description}</p>
              </SpotlightCard>
            )
          })}
        </div>

        <div className="flex justify-center pt-8">
          <Link to="/register">
            <ShimmerButton background="#3B82F6" className="px-8 py-3.5 text-xs sm:text-sm font-bold font-mono">
              <span>Get Started with $100k Virtual Balance</span>
              <ArrowRight className="w-4 h-4" />
            </ShimmerButton>
          </Link>
        </div>
      </div>
    </div>
  )
}
