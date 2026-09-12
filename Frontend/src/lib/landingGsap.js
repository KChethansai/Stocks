import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function hasFullMotion() {
  if (typeof window === 'undefined') return false
  if (document.documentElement.dataset.motion === 'comfort') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function hasFinePointer() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: fine)').matches
}

function isDesktop() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 64rem)').matches
}

// Mirrors the reference breakpoints module: pinned/scrubbed scenes run at
// full fidelity on desktop + fine pointer only; scrubbed parallax degrades
// to full-motion (no pin) elsewhere; comfort mode disables GSAP entirely
// (Motion's isComfort path already renders final states).
export function canPin() {
  return hasFullMotion() && hasFinePointer() && isDesktop()
}

export function canScrub() {
  return hasFullMotion()
}

export function refreshLandingTriggers() {
  ScrollTrigger.refresh()
}

export { gsap, ScrollTrigger }
