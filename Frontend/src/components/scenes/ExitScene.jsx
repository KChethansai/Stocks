import { Link } from 'react-router'
import { motion } from 'motion/react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { TextReveal } from '../../hooks/useTextReveal'
import {
  DURATIONS,
  STAGGER,
  DELAYS,
  EASING,
  fadeUp,
  staggerContainer,
} from '../../lib/motion'
import { useAuth } from '../../store/authStore'
import { ShimmerButton } from '../magicui/ShimmerButton'
import { LiquidGlassButton } from '../kokonutui/LiquidGlassButton'
import { Aurora } from '../reactbits/Aurora'
import Logo3D from '../Logo3D'
import { ArrowRight } from 'lucide-react'

export default function ExitScene() {
  const { isAuthenticated } = useAuth()
  const isComfort = useReducedMotion()

  return (
    <section className="relative py-32 sm:py-40 overflow-hidden">
      {/* Atmospheric background */}
      <Aurora className="opacity-10" />
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.07) 0%, transparent 60%)',
        }} />

      <div className="mf-scene relative z-10">
        <div className="mf-scene-frame max-w-2xl mx-auto text-center">
          <motion.div
            variants={staggerContainer(STAGGER.featureCards, isComfort ? 0 : 0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {/* Logo */}
            <motion.div
              className="flex justify-center mb-8"
              variants={fadeUp(isComfort ? 0 : DURATIONS.eyebrow, 0, EASING.contentReveal)}
            >
              <Logo3D size="lg" />
            </motion.div>

            {/* Heading */}
            <motion.h2
              className="font-sans tracking-tight text-text-primary leading-[1.1] mb-6"
              style={{ fontSize: 'var(--mf-font-display-lg)' }}
              variants={fadeUp(isComfort ? 0 : DURATIONS.title, 0, EASING.textReveal)}
            >
              <TextReveal
                text="Start building conviction today."
                duration={DURATIONS.title}
                stagger={STAGGER.titleWords}
                initialDelay={isComfort ? 0 : DELAYS.titleStart}
                className="text-text-primary"
                blur={!isComfort}
                as="span"
              />
            </motion.h2>

            {/* Body */}
            <motion.p
              className="text-text-secondary leading-relaxed mb-10 max-w-lg mx-auto"
              style={{ fontSize: 'var(--mf-font-body-md)' }}
              variants={fadeUp(isComfort ? 0 : DURATIONS.body, 0, EASING.contentReveal)}
            >
              Create your free account and get $100,000 in virtual capital.
              No credit card, no real risk — just live market data.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap justify-center items-center gap-4"
              variants={fadeUp(isComfort ? 0 : DURATIONS.content, 0, EASING.decelerate)}
            >
              <Link to={isAuthenticated ? '/dashboard' : '/register'}>
                <ShimmerButton background="#3B82F6" className="px-8 py-3.5 text-xs font-mono font-bold">
                  <span className="text-white">{isAuthenticated ? 'Open Dashboard' : 'Create Free Account'}</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </ShimmerButton>
              </Link>
              <Link to={isAuthenticated ? '/markets' : '/login'}>
                <LiquidGlassButton variant="primary" className="px-6 py-3 text-xs font-bold font-mono">
                  {isAuthenticated ? 'Explore Markets' : 'Log In'}
                </LiquidGlassButton>
              </Link>
            </motion.div>

            {/* Trust line */}
            <motion.p
              className="text-[10px] font-mono text-text-muted mt-8"
              variants={fadeUp(isComfort ? 0 : DURATIONS.content, 0, EASING.contentReveal)}
            >
              Free forever · No credit card · $100K virtual capital
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
