import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import GoogleAuthButton from './GoogleAuthButton'
import { ShimmerButton } from './magicui/ShimmerButton'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { BorderBeam } from './magicui/BorderBeam'
import { ShinyText } from './reactbits/ShinyText'
import { Aurora } from './reactbits/Aurora'
import Logo3D from './Logo3D'

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const { register: registerUser, loading } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()

  const onSubmit = async (data) => {
    const result = await registerUser(data)
    if (result.success) {
      toast.success(result.message || 'Account created successfully! Please sign in.')
      navigate('/login')
      return
    }
    toast.error(result.message || 'Registration failed')
  }

  return (
    <div className="flex w-full min-h-screen overflow-hidden bg-[#050505] text-[#F5F7FA]">
      {/* Left Side: Form Area */}
      <div className="w-full lg:w-[480px] flex-shrink-0 bg-[#09090B] flex flex-col justify-center px-8 sm:px-14 lg:px-16 border-r border-white/8 relative z-10 py-10">
        <div className="w-full max-w-sm mx-auto">
          {/* Brand Logo */}
          <div className="mb-8">
            <Link to="/" className="inline-flex items-center group">
              <Logo3D size="md" showText={true} textClassName="text-xl" />
            </Link>
          </div>

          {/* Welcome Text */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#F5F7FA] mb-1.5">
              Create Account
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              Start practicing with $100,000 in virtual capital.
            </p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1 font-mono">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="traderpro"
                  {...register('username', { required: 'Username is required' })}
                  className="w-full bg-[#151820] border border-white/8 rounded-lg py-2 pl-10 pr-3 text-xs text-[#F5F7FA] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] transition font-mono"
                />
              </div>
              {errors.username && (
                <p className="text-[11px] text-[#EF4444] mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1 font-mono">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  {...register('email', { required: 'Email is required' })}
                  className="w-full bg-[#151820] border border-white/8 rounded-lg py-2 pl-10 pr-3 text-xs text-[#F5F7FA] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] transition font-mono"
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-[#EF4444] mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1 font-mono">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Minimum 6 characters' }
                  })}
                  className="w-full bg-[#151820] border border-white/8 rounded-lg py-2 pl-10 pr-10 text-xs text-[#F5F7FA] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#F5F7FA]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-[#EF4444] mt-1">{errors.password.message}</p>
              )}
            </div>

            <ShimmerButton
              type="submit"
              disabled={loading}
              background="#3B82F6"
              className="w-full py-3 text-xs font-bold font-mono mt-3"
            >
              <span>{loading ? 'Creating account...' : 'Create Account & Claim $100k'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </ShimmerButton>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center">
            <div className="flex-grow border-t border-white/8"></div>
            <span className="flex-shrink-0 mx-3 text-[11px] font-mono text-[#667085]">
              or continue with
            </span>
            <div className="flex-grow border-t border-white/8"></div>
          </div>

          {/* Google SSO Button */}
          <GoogleAuthButton text="Sign up with Google" />

          {/* Login Link */}
          <p className="mt-6 text-center text-xs text-[#667085]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#3B82F6] hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side: 3D Visual Showcase Area */}
      <div className="hidden lg:flex flex-grow bg-[#050505] relative items-center justify-center p-12 overflow-hidden">
        <Aurora className="opacity-15" />

        {/* 3D Spotlight Showcase Card */}
        <SpotlightCard
          spotlightColor="rgba(34, 197, 94, 0.25)"
          tiltIntensity={7}
          className="relative z-10 w-full max-w-2xl aspect-[16/10] bg-[#111318]/90 rounded-2xl border border-white/10 shadow-2xl p-0 overflow-hidden flex flex-col group"
        >
          <BorderBeam size={200} duration={8} colorFrom="#22C55E" colorTo="#3B82F6" />

          {/* Top Bar Mock */}
          <div className="h-10 bg-[#151820]/90 border-b border-white/8 flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/70"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/70"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/70"></div>
            </div>
            <div className="ml-4 h-3.5 w-32 bg-white/5 rounded"></div>
          </div>

          {/* Interface Content Mock */}
          <div className="flex-grow p-6 flex flex-col gap-5 justify-between">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-mono font-bold text-[#F5F7FA]">Instant Practice Trading</span>
                <p className="text-xl font-bold font-mono text-[#3B82F6] mt-0.5">$100,000 Starting Balance</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#3B82F6]/10 text-[#3B82F6] font-mono text-xs font-semibold">
                <ShinyText>100% Risk-Free</ShinyText>
              </span>
            </div>

            {/* Abstract Visual Bars */}
            <div className="flex-1 bg-[#0e0e10]/90 rounded-xl border border-white/5 p-4 flex items-end gap-3 relative overflow-hidden">
              <div className="w-1/6 bg-gradient-to-t from-[#22C55E]/30 to-transparent h-[40%] border-t-2 border-[#22C55E] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#22C55E]/30 to-transparent h-[70%] border-t-2 border-[#22C55E] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#3B82F6]/30 to-transparent h-[55%] border-t-2 border-[#3B82F6] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#22C55E]/30 to-transparent h-[80%] border-t-2 border-[#22C55E] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#3B82F6]/30 to-transparent h-[60%] border-t-2 border-[#3B82F6] rounded-t"></div>
              <div className="w-1/6 bg-gradient-to-t from-[#22C55E]/30 to-transparent h-[90%] border-t-2 border-[#22C55E] rounded-t"></div>
            </div>

            {/* Bottom Row Chips */}
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-[#151820]/90 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-[#667085] uppercase block">Virtual Currency</span>
                <span className="font-bold text-[#22C55E]">No Deposit Needed</span>
              </div>
              <div className="bg-[#151820]/90 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-[#667085] uppercase block">Execution</span>
                <span className="font-bold text-[#F5F7FA]">Instant Orders</span>
              </div>
              <div className="bg-[#151820]/90 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-[#667085] uppercase block">Asset Universe</span>
                <span className="font-bold text-[#3B82F6]">30+ Equities</span>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  )
}
