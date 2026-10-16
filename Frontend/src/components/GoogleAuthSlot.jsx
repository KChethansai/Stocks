// Deferred Google OAuth boundary. The @react-oauth/google library used to
// ride the initial bundle via main.jsx; it now loads only with the lazy
// Login/Register chunks that actually render the Google button. Behavior is
// unchanged: missing client ID still renders the graceful fallback inside
// GoogleAuthButton.
import { GoogleOAuthProvider } from '@react-oauth/google'
import GoogleAuthButton from './GoogleAuthButton'

export default function GoogleAuthSlot() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleAuthButton />
    </GoogleOAuthProvider>
  )
}
