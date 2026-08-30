import { useEffect, useRef, useState } from 'react'

export function NumberTicker({
  value = 0,
  _direction = 'up',
  delay = 0,
  className = '',
  decimalPlaces = 2,
  prefix = '',
  suffix = ''
}) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValue = useRef(value)

  useEffect(() => {
    const start = prevValue.current
    const end = Number(value || 0)
    prevValue.current = end

    if (start === end) {
      setDisplayValue(end)
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setDisplayValue(end)
      return
    }

    let startTime = null
    const duration = 600

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOutQuad = 1 - (1 - progress) * (1 - progress)
      const current = start + (end - start) * easeOutQuad

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setDisplayValue(end)
      }
    }

    const timer = setTimeout(() => {
      requestAnimationFrame(step)
    }, delay * 1000)

    return () => clearTimeout(timer)
  }, [value, delay])

  return (
    <span className={`inline-block tabular-nums font-mono ${className}`}>
      {prefix}
      {Number(displayValue).toLocaleString('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces
      })}
      {suffix}
    </span>
  )
}
