import { useRef, useState, useCallback } from 'react'

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(59, 130, 246, 0.12)',
  spotlightSize = 350,
  tiltIntensity = 4,
  enableTilt = true,
  onClick,
  ...props
}) {
  const cardRef = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)
  const [transform, setTransform] = useState('')

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setPosition({ x, y })
    setOpacity(1)

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (enableTilt && !prefersReducedMotion) {
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateX = ((y - centerY) / centerY) * -tiltIntensity
      const rotateY = ((x - centerX) / centerX) * tiltIntensity
      setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.005, 1.005, 1.005)`)
    }
  }, [enableTilt, tiltIntensity])

  const handleMouseLeave = useCallback(() => {
    setOpacity(0)
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
  }, [])

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: transform,
        transition: 'transform 0.25s cubic-bezier(0.2, 0, 0.2, 1), border-color 0.2s, box-shadow 0.2s',
        willChange: 'transform'
      }}
      className={`relative rounded-xl border border-white/8 bg-[#111318] p-6 shadow-sm overflow-hidden group ${className}`}
      {...props}
    >
      {/* Spotlight highlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 -z-0"
        style={{
          opacity,
          background: `radial-gradient(${spotlightSize}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
