import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../store/authStore'
import { consumeSessionExpiredNotice } from '../lib/session'
import GoogleAuthSlot from './GoogleAuthSlot'
import Logo3D from './Logo3D'
import { Button } from './ui/Button'
import { Field } from './ui/Primitives'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const { login, loading } = useAuth()
  const navigate = useNavigate()

  // Session-expiry notice persisted across the sign-in redirect.
  useEffect(() => {
    consumeSessionExpiredNotice()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({ mode: 'onBlur' })

  const onSubmit = async (data) => {
    const res = await login({ email: data.email, password: data.password })
    if (res.success) {
      toast.success('Welcome back to MarketForge.')
      navigate('/dashboard')
    } else {
      toast.error(res.message || 'Sign-in failed. Check your email and password, then try again.')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]" aria-label="MarketForge home">
          <Logo3D size="md" showText={true} textClassName="text-xl" />
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-[var(--ivory)]">Welcome back</h1>
      <p className="mt-1 text-sm text-[var(--stone)]">Sign in to your trading workspace.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <Field label="Email address" htmlFor="login-email" error={errors.email?.message}>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--stone-muted)]" aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register('email', {
                required: 'Enter your email address.',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' }
              })}
              className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--ink-950)] py-2.5 pl-10 pr-3 text-sm text-[var(--ivory)] placeholder-[var(--stone-muted)] transition focus:border-[var(--brass)] focus:outline-none"
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="login-password" error={errors.password?.message}>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--stone-muted)]" aria-hidden="true" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              {...register('password', { required: 'Enter your password.' })}
              className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--ink-950)] py-2.5 pl-10 pr-10 text-sm text-[var(--ivory)] placeholder-[var(--stone-muted)] transition focus:border-[var(--brass)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--stone-muted)] transition hover:text-[var(--ivory)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] rounded"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Button type="submit" disabled={loading} className="w-full py-2.5">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="my-6 flex items-center">
        <div className="flex-grow border-t border-[var(--hairline)]" />
        <span className="mx-3 flex-shrink-0 text-xs text-[var(--stone-muted)]">or continue with</span>
        <div className="flex-grow border-t border-[var(--hairline)]" />
      </div>

      <GoogleAuthSlot />

      <p className="mt-8 text-center text-xs text-[var(--stone-muted)]">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-[var(--brass)] hover:underline">
          Create account
        </Link>
      </p>
    </div>
  )
}
