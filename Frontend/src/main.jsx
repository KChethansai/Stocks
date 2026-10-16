import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// NOTE: GoogleOAuthProvider is intentionally NOT mounted here. It lives in
// GoogleAuthSlot (lazy Login/Register chunks) so @react-oauth/google never
// enters the initial landing payload.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
