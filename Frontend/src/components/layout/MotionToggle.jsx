import { cn } from '../../lib/utils'
import { useMotionMode } from '../../store/uiStore'

const modes = [
  { key: 'full', label: 'Full' },
  { key: 'comfort', label: 'Comfort' }
]

export default function MotionToggle({ className }) {
  const [motionMode, setMotionMode] = useMotionMode()
  return (
    <div
      role="group"
      aria-label="Motion mode"
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5',
        className
      )}
    >
      {modes.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => setMotionMode(key)}
          aria-pressed={motionMode === key}
          className={cn(
            'rounded-full px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-wider transition-colors',
            motionMode === key
              ? 'bg-accent text-bg-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}