import { useState } from 'react'
import { Link } from 'react-router'
import {
  ShieldCheck,
  Zap,
  BarChart3,
  ArrowRight,
  Activity,
  Lock,
  Sliders
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import MarketCanvas from './3d/MarketCanvas'
import { ShimmerButton } from './magicui/ShimmerButton'
import { BorderBeam } from './magicui/BorderBeam'
import { AnimatedGradientText } from './magicui/AnimatedGradientText'
import { FlickeringGrid } from './magicui/FlickeringGrid'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { LiquidGlassButton } from './kokonutui/LiquidGlassButton'
import { BlurText } from './reactbits/BlurText'
import { ShinyText } from './reactbits/ShinyText'
import { Aurora } from './reactbits/Aurora'
import Logo3D from './Logo3D'

const sampleTickers = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 227.14, change: +1.42, sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 942.81, change: +4.24, sector: 'Semiconductors' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 415.10, change: -0.60, sector: 'Software' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 170.80, change: -2.95, sector: 'Automotive' }
]

const featureCards = [
  {
    icon: Activity,
    title: 'Real-Time Market Sync',
    desc: 'Live ticker feeds and synchronized depth powered by Yahoo Finance for authentic simulated trading.',
    spotlight: 'rgba(59, 130, 246, 0.2)'
  },
  {
    icon: ShieldCheck,
    title: 'Risk-Free Sandboxing',
    desc: 'Test momentum strategies, swing positions, and hedging without jeopardizing real money.',
    spotlight: 'rgba(34, 197, 94, 0.2)'
  },
  {
    icon: BarChart3,
    title: 'Institutional Analytics',
    desc: 'Evaluate portfolio return windows, drawdown exposure, sector attribution, and win-rate ratios.',
    spotlight: 'rgba(245, 158, 11, 0.2)'
  },
  {
    icon: Zap,
    title: 'Instant Execution Engine',
    desc: 'Execute market buys and partial sells with instantaneous calculation of buying power and balances.',
    spotlight: 'rgba(59, 130, 246, 0.2)'
  },
  {
    icon: Sliders,
    title: 'Multi-Timeframe Charts',
    desc: 'Switch between sleek line charts and candlestick charts across 1D, 1W, 1M, 3M, 1Y, and ALL ranges.',
    spotlight: 'rgba(255, 77, 103, 0.2)'
  },
  {
    icon: Lock,
    title: 'Secure Account Vault',
    desc: 'Protected authentication sessions with HTTP-only cookies, password encryption, and Google OAuth.',
    spotlight: 'rgba(59, 130, 246, 0.2)'
  }
]

export default function Home() {
  const { isAuthenticated } = useAuth()
  const [activePreviewStock, setActivePreviewStock] = useState(sampleTickers[1]) // NVDA default

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F7FA] font-sans antialiased selection:bg-[#3B82F6] selection:text-white relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-20 overflow-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-center">
        {/* Background Grid, Flickering Grid, and Aurora */}
        <div className="absolute inset-0 z-0 data-grid opacity-30"></div>
        <div className="absolute inset-0 z-0 opacity-40">
          <FlickeringGrid color="#3B82F6" squareSize={3} gridGap={8} flickerChance={0.15} maxOpacity={0.2} />
        </div>
        <Aurora className="opacity-15" />
        <div className="absolute inset-0 z-0 opacity-20">
          <MarketCanvas />
        </div>

        <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy & Value Proposition */}
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#111318]/90 border border-white/10 w-fit shadow-md backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
              <ShinyText className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                Version 2.0 • 3D Terminal Live
              </ShinyText>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#F5F7FA] leading-[1.1]">
              <BlurText text="Practice trading." delay={0.04} className="block text-[#F5F7FA]" />
              <span className="text-[#9CA3AF]">Understand markets.</span><br />
              <AnimatedGradientText from="#60A5FA" via="#3B82F6" to="#10B981">
                Build conviction.
              </AnimatedGradientText>
            </h1>

            <p className="text-sm sm:text-base text-[#9CA3AF] leading-relaxed max-w-xl">
              An institutional-grade paper trading workspace engineered for precision. Execute strategies risk-free with deep analytics, 3D position visualization, and real-time market data.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to={isAuthenticated ? '/dashboard' : '/register'}>
                <ShimmerButton background="#3B82F6" className="px-7 py-3.5 text-xs font-mono font-bold">
                  <span>{isAuthenticated ? 'Open Dashboard' : 'Start Trading Free'}</span>
                  <ArrowRight className="w-4 h-4" />
                </ShimmerButton>
              </Link>

              <Link to={isAuthenticated ? '/markets' : '/login'}>
                <LiquidGlassButton variant="primary" className="px-6 py-3 text-xs font-bold font-mono">
                  Explore Markets
                </LiquidGlassButton>
              </Link>
            </div>

            {/* Hero Stats with 3D feel */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/8 mt-2 font-mono">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-xl sm:text-2xl font-bold text-[#F5F7FA]">$100K</div>
                <div className="text-xs text-[#667085]">Virtual Capital</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-xl sm:text-2xl font-bold text-[#F5F7FA]">30+</div>
                <div className="text-xs text-[#667085]">US Equities</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-xl sm:text-2xl font-bold text-[#22C55E]">0ms</div>
                <div className="text-xs text-[#667085]">Risk Exposure</div>
              </div>
            </div>
          </div>

          {/* Right: 3D Spotlight Preview Card */}
          <div id="preview" className="relative w-full h-[480px] sm:h-[540px] hidden lg:block">
            <SpotlightCard
              spotlightColor="rgba(59, 130, 246, 0.25)"
              tiltIntensity={8}
              className="absolute inset-0 bg-[#111318]/95 rounded-2xl border border-white/10 shadow-2xl p-0 overflow-hidden flex flex-col"
            >
              <BorderBeam size={220} duration={7} colorFrom="#3B82F6" colorTo="#10B981" />

              {/* Top Bar Mock */}
              <div className="h-11 border-b border-white/8 flex items-center justify-between px-4 bg-[#09090B]/90 backdrop-blur-md">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/70"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/70"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/70"></div>
                </div>
                <div className="text-[11px] font-mono text-[#667085]">workspace.marketforge.app</div>
                <div className="w-10"></div>
              </div>

              {/* Faux Workspace Content */}
              <div className="flex-1 p-5 grid grid-cols-3 gap-5 bg-[#0e0e10]/80">
                {/* Main Area */}
                <div className="col-span-2 flex flex-col gap-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-lg font-bold font-mono text-[#F5F7FA]">
                        {activePreviewStock.symbol}
                      </h3>
                      <div className="text-sm font-mono text-[#F5F7FA] flex items-center gap-2">
                        ${activePreviewStock.price.toFixed(2)}
                        <span className="text-[#22C55E] text-xs flex items-center font-bold">
                          +{activePreviewStock.change}%
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1 bg-[#151820] p-0.5 rounded border border-white/5 font-mono text-[10px]">
                      <button className="px-2 py-0.5 rounded bg-[#353437] text-white font-medium">1D</button>
                      <button className="px-2 py-0.5 rounded text-[#9CA3AF]">1W</button>
                      <button className="px-2 py-0.5 rounded text-[#9CA3AF]">1M</button>
                    </div>
                  </div>

                  {/* Chart SVG Representation with Glow */}
                  <div className="flex-1 border border-white/8 rounded-xl bg-[#111318] relative overflow-hidden p-4 flex items-end shadow-inner">
                    <svg className="w-full h-32 text-[#3B82F6] opacity-75" preserveAspectRatio="none" viewBox="0 0 100 30">
                      <path
                        d="M0,30 L10,25 L20,28 L30,15 L40,20 L50,10 L60,18 L70,5 L80,12 L90,2 L100,8"
                        fill="none"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                      />
                    </svg>
                  </div>

                  {/* Position Quick Info */}
                  <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                    <div className="bg-[#151820]/90 border border-white/5 rounded-lg p-2.5">
                      <div className="text-[10px] text-[#667085] uppercase">Shares</div>
                      <div className="font-bold text-[#F5F7FA]">50</div>
                    </div>
                    <div className="bg-[#151820]/90 border border-white/5 rounded-lg p-2.5">
                      <div className="text-[10px] text-[#667085] uppercase">Avg Cost</div>
                      <div className="font-bold text-[#F5F7FA]">$850.00</div>
                    </div>
                    <div className="bg-[#151820]/90 border border-white/5 rounded-lg p-2.5">
                      <div className="text-[10px] text-[#667085] uppercase">Unrealized</div>
                      <div className="font-bold text-[#22C55E]">+$4,640.50</div>
                    </div>
                  </div>
                </div>

                {/* Side Ticker Switcher */}
                <div className="col-span-1 flex flex-col gap-2">
                  <span className="text-[10px] font-mono text-[#667085] uppercase tracking-wider">
                    Quick Watch
                  </span>
                  <div className="space-y-1.5 flex-1">
                    {sampleTickers.map((s) => (
                      <div
                        key={s.symbol}
                        onClick={() => setActivePreviewStock(s)}
                        className={`p-2.5 rounded-lg border transition cursor-pointer font-mono ${
                          activePreviewStock.symbol === s.symbol
                            ? 'bg-[#151820] border-[#3B82F6]/60 shadow-md shadow-[#3B82F6]/10'
                            : 'bg-[#111318]/80 border-white/5 hover:bg-[#151820]'
                        }`}
                      >
                        <div className="flex justify-between text-xs font-bold text-[#F5F7FA]">
                          <span>{s.symbol}</span>
                          <span>${s.price.toFixed(2)}</span>
                        </div>
                        <div
                          className={`text-[10px] text-right mt-0.5 ${
                            s.change >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                          }`}
                        >
                          {s.change >= 0 ? '+' : ''}{s.change}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* Features Grid Section with 3D Spotlight Cards */}
      <section id="features" className="py-24 bg-[#08090C] relative z-10 border-t border-white/8">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-2xl sm:text-4xl font-bold font-mono tracking-tight text-[#F5F7FA]">
              Engineered for <ShinyText>Serious Traders</ShinyText>
            </h2>
            <p className="text-xs sm:text-sm text-[#9CA3AF]">
              Everything you need to analyze, execute, and refine trading setups without capital drawdown.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureCards.map((feat, i) => {
              const Icon = feat.icon
              return (
                <SpotlightCard
                  key={i}
                  spotlightColor={feat.spotlight}
                  tiltIntensity={6}
                  className="bg-[#111318]/90 rounded-2xl border border-white/8 p-6 hover:border-white/20 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center mb-4 group-hover:bg-[#3B82F6] group-hover:text-white transition-all shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold font-mono text-[#F5F7FA] mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    {feat.desc}
                  </p>
                </SpotlightCard>
              )
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-24 bg-[#050505] border-t border-white/8 text-center text-xs font-mono text-[#667085] relative overflow-hidden">
        <Aurora className="opacity-15" />
        <div className="container mx-auto px-6 max-w-md space-y-6 relative z-10">
          <div className="flex justify-center">
            <Logo3D size="lg" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#F5F7FA] font-sans tracking-tight">
            Ready to start practicing?
          </h3>
          <p className="text-[#9CA3AF]">
            Open your paper trading account now and receive $100,000 in virtual capital instantly.
          </p>
          <div className="flex justify-center pt-2">
            <Link to={isAuthenticated ? '/dashboard' : '/register'}>
              <ShimmerButton background="#3B82F6" className="px-8 py-3.5 text-xs font-bold font-mono">
                <span>Create Free Account</span>
                <ArrowRight className="w-4 h-4" />
              </ShimmerButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

