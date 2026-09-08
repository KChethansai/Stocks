import { useUiStore } from '../store/uiStore'

/**
 * Returns whether reduced/instant motion is active.
 * Reads from the existing uiStore motionMode preference.
 *
 * @returns {boolean} true when comfort mode is active
 */
export function useReducedMotion() {
  return useUiStore((s) => s.motionMode) === 'comfort'
}
