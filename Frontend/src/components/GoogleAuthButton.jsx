import { useState } from 'react'
import { useNavigate } from 'react-router'
import { GoogleLogin } from '@react-oauth/google'
import toast from 'react-hot-toast'
import { useAuth } from '../store/authStore'

export default function GoogleAuthButton() {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleSuccess = async (credentialResponse) => {
    setLoading(true)
    try {
      const result = await loginWithGoogle(credentialResponse.credential)
      if (result.success) {
        toast.success('Authenticated successfully!')
        navigate('/dashboard')
      } else {
        toast.error(result.message || 'Google authentication failed')
      }
    } catch {
      toast.error('Google authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleError = () => {
    toast.error('Google Sign-In was cancelled or failed. Please try again.')
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    return (
      <div className="w-full text-center py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-xs text-[#9CA3AF]">
        Google OAuth not configured in .env
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[40px]">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#3B82F6] font-semibold animate-pulse">
          <svg className="animate-spin h-4 w-4 text-[#3B82F6]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Authenticating with Google...
        </div>
      ) : (
        <div className="w-full flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            theme="filled_black"
            shape="rectangular"
            size="large"
            width="320"
            useOneTap={false}
            auto_select={false}
          />
        </div>
      )}
    </div>
  )
}
