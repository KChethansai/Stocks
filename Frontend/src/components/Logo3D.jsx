import { useState, useRef, useEffect } from 'react'
import marketForgeLogo from '../assets/MarketForge.png'

/**
 * 3D Interactive MarketForge Logo Component
 * Features:
 * - Magnetic 3D tilt tracking with smooth easing
 * - Specular reflection highlight on hover
 * - Multi-layer cyber blue / neon ambient glow
 * - Full prefers-reduced-motion accessibility support
 */
export default function Logo3D({
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showText = false,
  textClassName = '',
  className = '',
  withGlow = true,
  interactive = true
}) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef(null)
  const isReducedMotion = useRef(false)

  useEffect(() => {
    isReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const sizeMap = {
    xs: { box: 'w-7 h-7', img: 'w-5 h-5', text: 'text-xs' },
    sm: { box: 'w-8 h-8', img: 'w-6 h-6', text: 'text-sm' },
    md: { box: 'w-10 h-10', img: 'w-8 h-8', text: 'text-base' },
    lg: { box: 'w-12 h-12', img: 'w-9 h-9', text: 'text-lg' },
    xl: { box: 'w-16 h-16', img: 'w-12 h-12', text: 'text-2xl' }
  }

  const { box, img, text: defaultTextSize } = sizeMap[size] || sizeMap.md

  const handleMouseMove = (e) => {
    if (!interactive || isReducedMotion.current || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2

    // Max 10deg rotation for subtle, professional 3D feel
    const maxRot = 10
    const rotY = (x / (rect.width / 2)) * maxRot
    const rotX = -(y / (rect.height / 2)) * maxRot
    setRotate({ x: rotX, y: rotY })
  }

  const handleMouseEnter = () => {
    if (!interactive) return
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setRotate({ x: 0, y: 0 })
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex items-center select-none [perspective:800px] cursor-pointer group ${className}`}
    >
      {/* Subtle Professional Ambient Glow Backdrop */}
      {withGlow && (
        <div
          className={`absolute -inset-0.5 rounded-xl bg-[#3B82F6]/20 blur-sm transition-opacity duration-300 pointer-events-none ${
            isHovered ? 'opacity-70 blur-md' : 'opacity-0'
          }`}
        />
      )}

      {/* 3D Glass Tile Container */}
      <div
        className={`relative ${box} rounded-xl bg-[#12151C] border border-white/10 p-1 flex items-center justify-center shadow-md transition-all ease-out ${
          isHovered ? 'duration-150 border-white/25 shadow-lg shadow-black/50' : 'duration-300'
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: isHovered
            ? `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateZ(6px)`
            : 'rotateX(0deg) rotateY(0deg) translateZ(0px)'
        }}
      >
        {/* Specular Highlight */}
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />

        {/* Logo Image */}
        <img
          src={marketForgeLogo}
          alt="MarketForge Logo"
          className={`${img} object-contain transition-transform duration-200`}
          loading="eager"
        />
      </div>

      {/* Optional Brand Text */}
      {showText && (
        <span
          className={`font-semibold font-mono tracking-tight text-[#F1F5F9] ml-2.5 transition-colors duration-200 ${
            textClassName || defaultTextSize
          } group-hover:text-white`}
        >
          MarketForge
        </span>
      )}
    </div>
  )
}
