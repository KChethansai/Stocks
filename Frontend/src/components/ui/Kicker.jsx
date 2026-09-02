import { cn } from '../../lib/utils'

export default function Kicker({ children, className }) {
  return (
    <p
      className={cn(
        'font-mono text-[0.6875rem] font-medium uppercase leading-none tracking-[0.22em] text-accent',
        className
      )}
    >
      {children}
    </p>
  )
}