import HeroScene from './scenes/HeroScene'
import ControlScene from './scenes/ControlScene'
import AnalyticsScene from './scenes/AnalyticsScene'
import ReplayScene from './scenes/ReplayScene'
import StrategyScene from './scenes/StrategyScene'
import ProofScene from './scenes/ProofScene'
import ExitScene from './scenes/ExitScene'

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased selection:bg-accent/30 selection:text-white relative overflow-hidden">
      <HeroScene />
      <ControlScene />
      <AnalyticsScene />
      <ReplayScene />
      <StrategyScene />
      <ProofScene />
      <ExitScene />
    </div>
  )
}
