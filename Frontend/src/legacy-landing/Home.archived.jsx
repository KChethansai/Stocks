import HeroScene from './scenes/HeroScene'
import ControlScene from './scenes/ControlScene'
import AnalyticsScene from './scenes/AnalyticsScene'
import ForecastsScene from './scenes/ForecastsScene'
import ExitScene from './scenes/ExitScene'

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased relative overflow-hidden">
      <HeroScene />
      <ControlScene />
      <AnalyticsScene />
      <ForecastsScene />
      <ExitScene />
    </div>
  )
}
