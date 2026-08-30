import { Link } from 'react-router'
import { Info, ShieldCheck, Zap, Server, ArrowRight } from 'lucide-react'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { ShimmerButton } from './magicui/ShimmerButton'
import { ShinyText } from './reactbits/ShinyText'
import { BlurText } from './reactbits/BlurText'
import { Aurora } from './reactbits/Aurora'

export default function About() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F7FA] py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <Aurora className="opacity-15" />
      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#3B82F6] text-xs font-semibold backdrop-blur-sm">
            <Info className="w-3.5 h-3.5" />
            <ShinyText>Platform Overview</ShinyText>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F5F7FA]">
            <BlurText text="About MarketForge" delay={0.04} />
          </h1>
          <p className="text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
            MarketForge is an institutional-grade paper trading sandbox built so traders can develop, test, and master investment conviction without risking real financial capital.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <SpotlightCard
            spotlightColor="rgba(34, 197, 94, 0.2)"
            tiltIntensity={5}
            className="p-6 rounded-2xl border border-white/8 bg-[#111318]/90 shadow-sm space-y-2"
          >
            <h2 className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
              What is Paper Trading?
            </h2>
            <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
              Paper trading allows participants to practice buying and selling securities in real market conditions with simulated currency. You experience genuine market volatility, price discovery, and portfolio P&amp;L dynamics without real financial liability.
            </p>
          </SpotlightCard>

          <SpotlightCard
            spotlightColor="rgba(59, 130, 246, 0.2)"
            tiltIntensity={5}
            className="p-6 rounded-2xl border border-white/8 bg-[#111318]/90 shadow-sm space-y-2"
          >
            <h2 className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#3B82F6]" />
              How MarketForge Works
            </h2>
            <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
              Upon account creation, your portfolio is credited with $100,000 in virtual seed capital. You can browse 30 premier US equities, review multi-timeframe candlestick and line charts, execute instant market orders, and track your performance with institutional-grade risk metrics.
            </p>
          </SpotlightCard>

          <SpotlightCard
            spotlightColor="rgba(245, 158, 11, 0.2)"
            tiltIntensity={5}
            className="p-6 rounded-2xl border border-white/8 bg-[#111318]/90 shadow-sm space-y-2"
          >
            <h2 className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Server className="w-5 h-5 text-[#F59E0B]" />
              Architecture &amp; Data Flow
            </h2>
            <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
              Built on a modern React, Vite, Node.js, and MongoDB stack. Live market price updates and historical OHLC data sync continuously via Yahoo Finance, with real-time portfolio re-valuation and transaction ledger verification.
            </p>
          </SpotlightCard>
        </div>

        <div className="flex justify-center pt-6">
          <Link to="/register">
            <ShimmerButton background="#3B82F6" className="px-6 py-3 text-xs font-semibold font-mono">
              <span>Start Trading with $100,000</span>
              <ArrowRight className="w-4 h-4" />
            </ShimmerButton>
          </Link>
        </div>
      </div>
    </div>
  )
}
