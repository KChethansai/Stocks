import { useEffect, useRef, useState, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  User,
  Shield,
  Camera,
  Trash2,
  Eye,
  EyeOff,
  Wallet,
  Calendar,
  Mail,
  Lock
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { ShimmerButton } from './magicui/ShimmerButton'
import { NumberTicker } from './magicui/NumberTicker'
import { ShinyText } from './reactbits/ShinyText'
import { Button } from './ui/Button'

export default function Profile() {
  const fileInputRef = useRef(null)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  const {
    currentUser,
    loading,
    uploadProgress,
    updateProfile,
    updatePassword,
    uploadProfilePicture,
    removeProfilePicture
  } = useAuth()

  const {
    register: registerDetails,
    handleSubmit: handleDetailsSubmit,
    formState: { errors: detailErrors, isDirty: isDetailsDirty },
    reset: resetDetails
  } = useForm({
    defaultValues: {
      username: currentUser?.username || '',
      email: currentUser?.email || ''
    }
  })

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    control: passwordControl
  } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: ''
    }
  })

  const newPwValue = useWatch({ control: passwordControl, name: 'newPassword' }) || ''

  useEffect(() => {
    resetDetails({
      username: currentUser?.username || '',
      email: currentUser?.email || ''
    })
  }, [currentUser, resetDetails])

  const onDetailsSubmit = async (data) => {
    const result = await updateProfile(data)
    if (result.success) {
      toast.success(result.message || 'Profile updated successfully')
      return
    }
    toast.error(result.message || 'Profile update failed')
  }

  const onPasswordSubmit = async (data) => {
    const result = await updatePassword(data)
    if (result.success) {
      toast.success(result.message || 'Password changed successfully')
      resetPassword()
      return
    }
    toast.error(result.message || 'Password change failed')
  }

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error('Please upload a JPG, PNG, or WEBP under 5MB')
      return
    }
    const result = await uploadProfilePicture(file)
    if (result.success) {
      toast.success(result.message || 'Profile picture updated')
      return
    }
    toast.error(result.message || 'Upload failed')
  }

  const handleRemoveProfileImage = async () => {
    const result = await removeProfilePicture()
    if (result.success) {
      toast.success(result.message || 'Profile picture removed')
      return
    }
    toast.error(result.message || 'Removal failed')
  }

  const profileImageUrl =
    currentUser?.profileImage?.secureUrl ||
    (typeof currentUser?.profileImage === 'string' ? currentUser?.profileImage : null)
  const fallbackInitial = currentUser?.username?.charAt(0)?.toUpperCase() || 'U'

  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      })
    : 'Recently'

  // Password strength helper
  const pwStrength = useMemo(() => {
    if (!newPwValue) return 0
    let score = 0
    if (newPwValue.length >= 8) score += 1
    if (/[A-Z]/.test(newPwValue)) score += 1
    if (/[0-9]/.test(newPwValue)) score += 1
    if (/[^A-Za-z0-9]/.test(newPwValue)) score += 1
    return score
  }, [newPwValue])

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="pb-2">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-[#3B82F6]" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F7FA]">
            <ShinyText>Account & Security Settings</ShinyText>
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1">
          Manage your identity, personal details, security credentials, and virtual account balance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Identity Card & Virtual Account (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Identity & Avatar Card */}
          <SpotlightCard
            spotlightColor="rgba(59, 130, 246, 0.15)"
            tiltIntensity={4}
            className="rounded-2xl border border-white/8 bg-[#111318]/95 p-6 shadow-xl text-center"
          >
            <div className="relative inline-block mx-auto mb-4">
              <div className="w-24 h-24 rounded-full p-0.5 bg-gradient-to-tr from-[#3B82F6] to-[#22C55E] mx-auto">
                <div className="w-full h-full rounded-full overflow-hidden bg-[#09090B] flex items-center justify-center text-3xl font-bold text-[#F5F7FA]">
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt={currentUser?.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    fallbackInitial
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-lg transition cursor-pointer"
                title="Change photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <h2 className="text-lg font-bold text-[#F5F7FA]">{currentUser?.username || 'Trader'}</h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{currentUser?.email}</p>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-4 text-xs text-[#667085]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#3B82F6]" />
                Joined {memberSince}
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#22C55E]" />
                Verified
              </span>
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <p className="text-xs text-[#3B82F6] mt-2 font-mono">Uploading {uploadProgress}%...</p>
            )}

            <div className="flex gap-2 mt-5">
              <Button
                type="button"
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex-1 py-2 rounded-xl"
              >
                Upload Photo
              </Button>
              {profileImageUrl && (
                <Button
                  type="button"
                  variant="outline-danger"
                  onClick={handleRemoveProfileImage}
                  disabled={loading}
                  className="p-2 rounded-xl"
                  title="Remove photo"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleProfileImageChange}
              className="hidden"
            />
          </SpotlightCard>

          {/* Account Balance Snapshot */}
          <SpotlightCard
            spotlightColor="rgba(34, 197, 94, 0.15)"
            tiltIntensity={4}
            className="rounded-2xl border border-white/8 bg-[#111318]/95 p-6 shadow-xl"
          >
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-[#22C55E]" />
              <h3 className="text-sm font-bold text-[#F5F7FA]">Virtual Capital Allocation</h3>
            </div>
            <p className="text-2xl font-bold font-mono text-[#F5F7FA]">
              $<NumberTicker value={Number(currentUser?.balance || 100000)} decimalPlaces={2} />
            </p>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Your practice trading balance is refreshed automatically on executed buy and sell orders.
            </p>
          </SpotlightCard>
        </div>

        {/* Right Column: Account Details Form & Password Change (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Personal Details Form */}
          <div className="rounded-2xl border border-white/8 bg-[#111318]/95 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
              <Mail className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-base font-bold text-[#F5F7FA]">Account Information</h3>
            </div>

            <form onSubmit={handleDetailsSubmit(onDetailsSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    {...registerDetails('username', { required: 'Username is required' })}
                    className="w-full rounded-xl border border-white/8 bg-[#09090B] px-3.5 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6]"
                  />
                  {detailErrors.username && (
                    <p className="text-xs text-[#EF4444] mt-1">{detailErrors.username.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    {...registerDetails('email', { required: 'Email is required' })}
                    className="w-full rounded-xl border border-white/8 bg-[#09090B] px-3.5 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6]"
                  />
                  {detailErrors.email && (
                    <p className="text-xs text-[#EF4444] mt-1">{detailErrors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <ShimmerButton
                  type="submit"
                  disabled={loading || !isDetailsDirty}
                  background="#3B82F6"
                  className="px-5 py-2 text-xs font-semibold font-mono"
                >
                  Save Profile Changes
                </ShimmerButton>
              </div>
            </form>
          </div>

          {/* Security & Password Change Form */}
          <div className="rounded-2xl border border-white/8 bg-[#111318]/95 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
              <Lock className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="text-base font-bold text-[#F5F7FA]">Change Password</h3>
            </div>

            <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    {...registerPassword('currentPassword', { required: 'Current password is required' })}
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-white/8 bg-[#09090B] px-3.5 py-2.5 pr-10 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3.5 top-3 text-[#667085] hover:text-[#F5F7FA]"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-xs text-[#EF4444] mt-1">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    {...registerPassword('newPassword', {
                      required: 'New password is required',
                      minLength: { value: 6, message: 'Minimum 6 characters' }
                    })}
                    placeholder="Enter new password (min. 6 characters)"
                    className="w-full rounded-xl border border-white/8 bg-[#09090B] px-3.5 py-2.5 pr-10 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3.5 top-3 text-[#667085] hover:text-[#F5F7FA]"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-xs text-[#EF4444] mt-1">{passwordErrors.newPassword.message}</p>
                )}

                {/* Password strength bar */}
                {newPwValue && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          pwStrength <= 1
                            ? 'w-1/4 bg-[#EF4444]'
                            : pwStrength === 2
                            ? 'w-2/4 bg-[#F59E0B]'
                            : pwStrength === 3
                            ? 'w-3/4 bg-[#3B82F6]'
                            : 'w-full bg-[#22C55E]'
                        }`}
                      ></div>
                    </div>
                    <span className="text-[0.68rem] text-[#9CA3AF]">
                      Strength:{' '}
                      {pwStrength <= 1
                        ? 'Weak'
                        : pwStrength === 2
                        ? 'Fair'
                        : pwStrength === 3
                        ? 'Good'
                        : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <ShimmerButton
                  type="submit"
                  disabled={loading}
                  background="#F59E0B"
                  className="px-5 py-2 text-xs font-semibold font-mono"
                >
                  Update Password
                </ShimmerButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
