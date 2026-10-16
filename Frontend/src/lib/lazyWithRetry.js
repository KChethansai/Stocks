// Retry-tolerant dynamic imports. A chunk import can reject transiently — an
// aborted fetch during a rapid navigation, a dev-server transform race, or a
// flaky CDN in production. Retrying inside the loader keeps such transient
// failures from ever reaching an error boundary; a genuinely missing chunk
// still fails loudly after bounded retries (no loop: the count is fixed at
// 1 + `retries`, then the error propagates).
//
// Platform limit, verified by browser test (Oct 2026, import() × 3 against
// an aborted chunk URL): CHROMIUM records a failed module fetch in the
// module map — attempts 2+ reject in ~0ms WITHOUT re-fetching (1 network
// request total). FIREFOX re-fetches per attempt (3 requests total), so
// retries there genuinely ride out transient blips in-page — consistent with
// the Oct 2026 Firefox chunk-abort storms stopping after retries landed.
// For recorded network failures the retries exhaust quickly and the error
// surfaces; genuine recovery from a recorded failure is a full page reload
// (fresh module registry) — which is what the route/section error UIs
// offer. Retries stay because they are bounded and harmless, and effective
// on Firefox; they must not be described as CDN-failure recovery.
import { lazy } from 'react'

export function retryImport(factory, retries = 2, delayMs = 800) {
  const attempt = (remaining) =>
    factory().catch((err) => {
      if (remaining <= 0) throw err
      return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() =>
        attempt(remaining - 1)
      )
    })
  return attempt(retries)
}

export function lazyWithRetry(factory, retries = 2, delayMs = 800) {
  return lazy(() => retryImport(factory, retries, delayMs))
}
