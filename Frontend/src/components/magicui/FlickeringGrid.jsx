import { useEffect, useRef, useState } from 'react'

export function FlickeringGrid({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.2,
  color = '#3B82F6',
  width,
  height,
  className = '',
  maxOpacity = 0.25
}) {
  const canvasRef = useRef(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isInView) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId
    let w = width || canvas.clientWidth || 400
    let h = height || canvas.clientHeight || 400
    canvas.width = w
    canvas.height = h

    const cols = Math.floor(w / (squareSize + gridGap))
    const rows = Math.floor(h / (squareSize + gridGap))
    const squares = new Float32Array(cols * rows)

    for (let i = 0; i < squares.length; i++) {
      squares[i] = Math.random() * maxOpacity
    }

    const render = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const idx = c * rows + r
          if (!prefersReducedMotion && Math.random() < flickerChance) {
            squares[idx] = Math.random() * maxOpacity
          }
          ctx.globalAlpha = squares[idx]
          ctx.fillRect(
            c * (squareSize + gridGap),
            r * (squareSize + gridGap),
            squareSize,
            squareSize
          )
        }
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render)
      }
    }

    render()

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [width, height, squareSize, gridGap, flickerChance, color, maxOpacity, isInView])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none w-full h-full ${className}`}
    />
  )
}
