import { cn } from '../../lib/utils'
import Kicker from './Kicker'

export default function SectionHeading({
  kicker,
  title,
  description,
  align = 'left',
  className
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        align === 'center' && 'items-center text-center',
        className
      )}
    >
      {kicker && <Kicker>{kicker}</Kicker>}
      <h2 className="font-display text-3xl leading-tight text-text-primary sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-xl text-sm leading-relaxed text-text-secondary">{description}</p>
      )}
    </div>
  )
}