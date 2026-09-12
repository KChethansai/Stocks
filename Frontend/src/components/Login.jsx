import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import GoogleAuthButton from './GoogleAuthButton'
import { ParticleButton } from './kokonutui/ParticleButton'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { BorderBeam } from './magicui/BorderBeam'
import { ShinyText } from './reactbits/ShinyText'
import { Aurora } from './reactbits/Aurora'
import Logo3D from './Logo3D'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const { login, loading } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()

  const onSubmit = async (data) => {
    const res = await login({ email: data.email, password: data.password })
    if (res.success) {
      toast.success('Welcome back to MarketForge!')
      navigate('/dashboard')
    } else {
      toast.error(res.message || 'Invalid email or password')
    }
  }

  return (
    <div className="min-h-screen bg-[#03060b] flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background Aurora */}
      <Aurora className="opacity-15" />

      {/* Left Form Column (Full height on mobile, 480px on desktop) */}
      <div className="w-full lg:w-[480px] flex-shrink-0 bg-[#07090d] flex flex-col justify-center px-8 sm:px-14 lg:px-16 border-r border-white/8 relative z-10 py-12">
        <div className="w-full max-w-sm mx-auto">
          {/* Brand Logo */}
          <div className="mb-10">
            <Link to="/" className="inline-flex items-center group">
              <Logo3D size="md" showText={true} textClassName="text-xl" />
            </Link>
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-[#f8fdff] mb-1.5">
              Welcome back
            </h2>
            <p className="text-xs text-[#b7c6cf]">
              Sign in to your trading workspace.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#b7c6cf] mb-1.5 font-mono">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#84949e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  {...register('email', { required: 'Email is required' })}
                  className="w-full bg-[#0c121b] border border-white/8 rounded-lg py-2.5 pl-10 pr-3 text-xs text-[#f8fdff] placeholder-[#84949e] focus:outline-none focus:border-[#7ce6ff] transition font-mono"
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-[#e87684] mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-[#b7c6cf] font-mono">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#84949e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password', { required: 'Password is required' })}
                  className="w-full bg-[#0c121b] border border-white/8 rounded-lg py-2.5 pl-10 pr-10 text-xs text-[#f8fdff] placeholder-[#84949e] focus:outline-none focus:border-[#7ce6ff] transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#84949e] hover:text-[#f8fdff]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-[#e87684] mt-1">{errors.password.message}</p>
              )}
            </div>

            <ParticleButton
              type="submit"
              disabled={loading}
              tone="blue"
              className="w-full py-3 text-xs font-bold font-mono mt-2"
            >
              <span>{loading ? 'Signing in...' : 'Sign In to Workspace'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </ParticleButton>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-grow border-t border-white/8"></div>
            <span className="flex-shrink-0 mx-3 text-[11px] font-mono text-[#84949e]">
              or continue with
            </span>
            <div className="flex-grow border-t border-white/8"></div>
          </div>

          {/* Google SSO Button */}
          <GoogleAuthButton text="Sign in with Google" />

          {/* Register Link */}
          <p className="mt-8 text-center text-xs text-[#84949e]">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-[#7ce6ff] hover:underline font-medium">
              Create Account
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side: 3D Visual Showcase Area */}
      <div className="hidden lg:flex flex-grow bg-[#03060b] relative items-center justify-center p-12 overflow-hidden">
        <Aurora className="opacity-15" />

        {/* 3D Spotlight Showcase Card */}
        <SpotlightCard
          spotlightColor="rgba(124, 230, 255, 0.25)"
          tiltIntensity={7}
          className="relative z-10 w-full max-w-2xl aspect-[16/10] bg-[#0c121b]/90 rounded-2xl border border-white/10 shadow-2xl p-0 overflow-hidden flex flex-col group"
        >
          <BorderBeam size={200} duration={8} colorFrom="#2eafff" colorTo="#7ed6a3" />

          {/* Top Bar Mock */}
          <div className="h-10 bg-[#0c121b]/90 border-b border-white/8 flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#e87684]/70"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#96cdde]/70"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#7ed6a3]/70"></div>
            </div>
            <div className="ml-4 h-3.5 w-28 bg-white/5 rounded"></div>
          </div>

          {/* Interface Content Mock */}
          <div className="flex-grow p-6 flex flex-col gap-5 justify-between">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-[#f8fdff]">NVDA • NVIDIA Corp</span>
                <p className="text-xl font-bold font-mono text-[#7ed6a3] mt-0.5">$942.81 (+4.24%)</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#7ed6a3]/10 text-[#7ed6a3] font-mono text-xs font-semibold">
                <ShinyText>Live Feed Active</ShinyText>
              </span>
            </div>

            {/* Abstract Visual Bars */}
            <div className="flex-1 bg-[#0e0e10]/90 rounded-xl border border-white/5 p-4 flex items-end gap-3 relative overflow-hidden">
              <div className="w-1/6 bg-gradient-to-t from-[#7ce6ff]/30 to-transparent h-[45%] border-t-2 border-[#7ce6ff] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#7ce6ff]/30 to-transparent h-[65%] border-t-2 border-[#7ce6ff] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#7ce6ff]/30 to-transparent h-[35%] border-t-2 border-[#7ce6ff] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#e87684]/30 to-transparent h-[50%] border-t-2 border-[#e87684] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#7ed6a3]/30 to-transparent h-[85%] border-t-2 border-[#7ed6a3] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#7ce6ff]/30 to-transparent h-[95%] border-t-2 border-[#7ce6ff] rounded-t"></div>
            </div>

            {/* Bottom Row Chips */}
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-[#0c121b]/90 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-[#84949e] uppercase block">Virtual Capital</span>
                <span className="font-bold text-[#f8fdff]">$100,000</span>
              </div>
              <div className="bg-[#0c121b]/90 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-[#84949e] uppercase block">Execution</span>
                <span className="font-bold text-[#7ed6a3]">0ms Latency</span>
              </div>
              <div className="bg-[#0c121b]/90 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-[#84949e] uppercase block">Market Depth</span>
                <span className="font-bold text-[#7ce6ff]">30 Equities</span>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  )
}
