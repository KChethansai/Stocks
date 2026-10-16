import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useAuth } from '../store/authStore'

// Session-expiry handling shared by the global 401 interceptor (registered
// once in App) and the auth store (which clears the flag on sign-in, so a
// second expiry in the same page lifetime still notifies and redirects).
let notified = false

export function resetSessionExpiry() {
  notified = false
}

export function setupSessionExpiry() {
  const id = axios.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err.response?.status
      const url = String(err.config?.url || '')
      const isAuthCall =
        /\/user-api\/(login|register)$/.test(url) || /\/api\/auth\/google$/.test(url)
      if (
        status === 401 &&
        !isAuthCall &&
        useAuth.getState().isAuthenticated &&
        !notified
      ) {
        notified = true
        useAuth.setState({ currentUser: null, isAuthenticated: false, initializing: false })
        try {
          sessionStorage.setItem('mf-session-expired', '1')
        } catch {
          // storage unavailable — login page simply won't show the notice
        }
        window.location.assign('/login')
      }
      return Promise.reject(err)
    }
  )
  return () => axios.interceptors.response.eject(id)
}

export function consumeSessionExpiredNotice() {
  try {
    if (sessionStorage.getItem('mf-session-expired') === '1') {
      sessionStorage.removeItem('mf-session-expired')
      // Deferred so the login form paints first.
      setTimeout(() => toast.error('Your session expired. Please sign in again.'), 300)
    }
  } catch {
    // storage unavailable — nothing to consume
  }
}
