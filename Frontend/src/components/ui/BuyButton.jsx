import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { TrendingUp, Check, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BuyButton({
  label,
  onClick,
  disabled = false,
  className,
  size = 'md',
  icon: CustomIcon
}) {
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const timeoutRef = useRef(null)

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const sizeClasses = {
    sm: 'text-xs py-2 px-3.5 gap-1.5',
    md: 'text-xs sm:text-sm py-2.5 px-4 sm:px-5 gap-2',
    lg: 'text-sm sm:text-base py-3 px-6 gap-2.5'
  }

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleClick = async (e) => {
    e?.preventDefault?.()
    if (status !== 'idle' || disabled) return
    setStatus('loading')

    try {
      const result = await onClick()
      if (result && result.success === false) {
        setStatus('error')
        timeoutRef.current = setTimeout(() => setStatus('idle'), 1800)
      } else {
        setStatus('success')
        timeoutRef.current = setTimeout(() => setStatus('idle'), 2200)
      }
    } catch {
      setStatus('error')
      timeoutRef.current = setTimeout(() => setStatus('idle'), 1800)
    }
  }

  const getBackgroundColor = () => {
    if (status === 'error') return '#F0656E'
    return '#2ECF8E'
  }

  const getTextColor = () => {
    if (status === 'error') return '#FFFFFF'
    return '#06090F'
  }

  const IconComponent = CustomIcon || TrendingUp
  const currentIconSize = iconSizes[size] || 16

  return (
    <motion.button
      type="button"
      whileTap={disabled || status !== 'idle' ? {} : { scale: 0.96 }}
      onClick={handleClick}
      disabled={disabled || status !== 'idle'}
      className={cn(
        'relative inline-flex items-center justify-center font-mono font-bold rounded-xl select-none transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ECF8E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06090F]',
        sizeClasses[size] || sizeClasses.md,
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className
      )}
      style={{
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        boxShadow:
          status === 'success'
            ? '0 0 24px rgba(46, 207, 142, 0.45), 0 4px 12px rgba(0, 0, 0, 0.4)'
            : '0 2px 8px rgba(0, 0, 0, 0.25)'
      }}
      animate={{
        backgroundColor: getBackgroundColor(),
        boxShadow:
          status === 'success'
            ? '0 0 24px rgba(46, 207, 142, 0.45), 0 4px 12px rgba(0, 0, 0, 0.4)'
            : '0 2px 8px rgba(0, 0, 0, 0.25)'
      }}
      transition={{ duration: 0.25 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === 'idle' && (
          <motion.span
            key="idle"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-2"
          >
            <motion.span
              whileHover={prefersReducedMotion ? {} : { y: -2, rotate: -4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <IconComponent size={currentIconSize} className="shrink-0 stroke-[2.5]" />
            </motion.span>
            <span className="truncate">{label}</span>
          </motion.span>
        )}

        {status === 'loading' && (
          <motion.span
            key="loading"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-2"
          >
            {/* Basket launch motion for icon */}
            <motion.span
              animate={
                prefersReducedMotion
                  ? {}
                  : {
                      y: [-2, -14, 0],
                      x: [0, 4, 0],
                      rotate: [0, 15, 0],
                      scale: [1, 1.2, 1]
                    }
              }
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              <Loader2 className="animate-spin shrink-0" size={currentIconSize} />
            </motion.span>
            <span>Filling Order...</span>
          </motion.span>
        )}

        {status === 'success' && (
          <motion.span
            key="success"
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: [0.6, 1.12, 1], opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 220 }}
            className="inline-flex items-center gap-2"
          >
            <motion.span
              initial={prefersReducedMotion ? {} : { rotate: -45, scale: 0 }}
              animate={prefersReducedMotion ? {} : { rotate: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 300, delay: 0.05 }}
            >
              <Check size={currentIconSize} className="shrink-0 stroke-[3]" />
            </motion.span>
            <span>Order Filled!</span>
          </motion.span>
        )}

        {status === 'error' && (
          <motion.span
            key="error"
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : {
                    scale: 1,
                    opacity: 1,
                    x: [0, -4, 4, -4, 4, 0]
                  }
            }
            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 14,
              stiffness: 280,
              x: { duration: 0.4 }
            }}
            className="inline-flex items-center gap-2"
          >
            <AlertCircle size={currentIconSize} className="shrink-0 stroke-[2.5]" />
            <span>Order Failed</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
