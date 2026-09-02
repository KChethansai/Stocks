import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const systemPrefersComfort =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const useUiStore = create(
  persist(
    (set) => ({
      motionMode: systemPrefersComfort ? 'comfort' : 'full',
      setMotionMode: (motionMode) => set({ motionMode })
    }),
    { name: 'marketforge-ui' }
  )
)

export function useMotionMode() {
  const motionMode = useUiStore((s) => s.motionMode)
  const setMotionMode = useUiStore((s) => s.setMotionMode)
  return [motionMode, setMotionMode]
}