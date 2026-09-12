import { Link } from 'react-router'
import { Info, ShieldCheck, Zap, Server, ArrowRight } from 'lucide-react'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { ParticleButton } from './kokonutui/ParticleButton'
import { ShinyText } from './reactbits/ShinyText'
import { BlurText } from './reactbits/BlurText'
import { Aurora } from './reactbits/Aurora'

export default function About() {
  return (
    <div className="min-h-screen bg-[#03060b] text-[#f8fdff] py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <Aurora className="opacity-15" />
      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#7ce6ff]/30 bg-[#7ce6ff]/10 text-[#7ce6ff] text-xs font-semibold backdrop-blur-sm">
            <Info className="w-3.5 h-3.5" />
            <ShinyText>Platform Overview</ShinyText>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#f8fdff]">
            <BlurText text="About MarketForge" delay={0.04} />
          </h1>
          <p className="text-sm sm:text-base text-[#b7c6cf] leading-relaxed">
            MarketForge is an institutional-grade paper trading sandbox built so traders can develop, test, and master investment conviction without risking real financial capital.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <SpotlightCard
            spotlightColor="rgba(126, 214, 163, 0.2)"
            tiltIntensity={5}
            className="p-6 rounded-2xl border border-white/8 bg-[#0c121b]/90 shadow-sm space-y-2"
          >
            <h2 className="text-lg font-bold text-[#f8fdff] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#7ed6a3]" />
              What is Paper Trading?
            </h2>
            <p className="text-xs sm:text-sm text-[#b7c6cf] leading-relaxed">
              Paper trading allows participants to practice buying and selling securities in real market conditions with simulated currency. You experience genuine market volatility, price discovery, and portfolio P&amp;L dynamics without real financial liability.
            </p>
          </SpotlightCard>

          <SpotlightCard
            spotlightColor="rgba(124, 230, 255, 0.2)"
            tiltIntensity={5}
            className="p-6 rounded-2xl border border-white/8 bg-[#0c121b]/90 shadow-sm space-y-2"
          >
            <h2 className="text-lg font-bold text-[#f8fdff] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#7ce6ff]" />
              How MarketForge Works
            </h2>
            <p className="text-xs sm:text-sm text-[#b7c6cf] leading-relaxed">
              Upon account creation, your portfolio is credited with $100,000 in virtual seed capital. You can browse 30 premier US equities, review multi-timeframe candlestick and line charts, execute instant market orders, and track your performance with institutional-grade risk metrics.
            </p>
          </SpotlightCard>

          <SpotlightCard
            spotlightColor="rgba(150, 205, 222, 0.2)"
            tiltIntensity={5}
            className="p-6 rounded-2xl border border-white/8 bg-[#0c121b]/90 shadow-sm space-y-2"
          >
            <h2 className="text-lg font-bold text-[#f8fdff] flex items-center gap-2">
              <Server className="w-5 h-5 text-[#96cdde]" />
              Architecture &amp; Data Flow
            </h2>
            <p className="text-xs sm:text-sm text-[#b7c6cf] leading-relaxed">
              Built on a modern React, Vite, Node.js, and MongoDB stack. Live market price updates and historical OHLC data sync continuously via Yahoo Finance, with real-time portfolio re-valuation and transaction ledger verification.
            </p>
          </SpotlightCard>
        </div>

        <div className="flex justify-center pt-6">
          <Link to="/register">
            <ParticleButton tone="cyan" className="rounded-full px-6 py-3 text-xs font-semibold font-mono">
              <span>Start Trading with $100,000</span>
              <ArrowRight className="w-4 h-4" />
            </ParticleButton>
          </Link>
        </div>
      </div>
    </div>
  )
}
