// security config: centralizes production-safe Express middleware.
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './env.js'

export const securityMiddleware = [
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Allow popups (Google sign-in uses postMessage between popup/iframe)
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
  }),
  compression(),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.nodeEnv === 'production' ? 300 : 10000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' }
  })
]

// Brute-force guard for credential endpoints (login + social sign-in)
// CSRF defense-in-depth: reject state-changing requests whose Origin is not a
// configured client. Mirrors the CORS allowlist (server.js) — configured
// client URLs plus any localhost origin in non-production — but runs
// independently of the cors package so no downgrade path exists if the
// allowlist ever changes downstream. Requests without an Origin/Referer
// (cron, curl, server-to-server) are allowed — browsers always send Origin
// on cross-site submissions.
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

export const stateChangingOriginGuard = (req, res, next) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) return next()

  const raw = req.headers.origin || req.headers.referer
  if (!raw) return next()

  let host = ''
  try {
    host = new URL(raw).origin
  } catch {
    host = ''
  }

  const isLocalDev = env.nodeEnv !== 'production' && LOCAL_ORIGIN_RE.test(host)
  if (host && !env.clientUrls.includes(host) && !isLocalDev) {
    return res.status(403).json({ message: 'Origin not allowed' })
  }

  next()
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts, please try again later' }
})

const hasUnsafeKey = (value) => {
  if (!value || typeof value !== 'object') return false
  return Object.keys(value).some((key) => {
    if (key.startsWith('$') || key.includes('.')) return true
    return hasUnsafeKey(value[key])
  })
}

export const rejectUnsafePayload = (req, res, next) => {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.params) || hasUnsafeKey(req.query)) {
    return res.status(400).json({ message: 'Invalid request payload' })
  }

  next()
}
