// Account workspace: overview, login details, security, preferences, data.
// Real backend fields only (UserAPI: GET/PUT /profile, PUT /password,
// profile-picture POST/PUT/DELETE). No verification badges, no sessions list,
// no fabricated stats. Member-since renders only when createdAt arrives.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import toast from 'react-hot-toast'
import {
  User as UserIcon,
  Lock,
  SlidersHorizontal,
  Database,
  LayoutDashboard,
  Camera,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import { useTrade } from '../store/tradeStore'
import { formatCurrency } from '../utils/marketAnalytics'
import { Button } from './ui/Button'
import { Field } from './ui/Primitives'
import MotionToggle from './layout/MotionToggle'

const SECTIONS = [
  { id: 'account', label: 'Account', Icon: UserIcon },
  { id: 'login', label: 'Login', Icon: UserIcon },
  { id: 'security', label: 'Security', Icon: Lock },
  { id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal },
  { id: 'data', label: 'Data', Icon: Database },
]

function monogram(name) {
  const c = String(name || 'T').trim().charAt(0).toUpperCase()
  return c || 'T'
}

function passwordScore(pw) {
  let s = 0
  if (pw.length >= 6) s += 1
  if (pw.length >= 10) s += 1
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1
  if (/\d/.test(pw)) s += 1
  if (/[^A-Za-z0-9]/.test(pw)) s += 1
  return Math.min(s, 4)
}

export default function Profile() {
  const {
    currentUser,
    fetchProfile,
    updateProfile,
    updatePassword,
    uploadProfilePicture,
    removeProfilePicture,
    uploadProgress,
  } = useAuth()
  const portfolio = useTrade((s) => s.portfolio)

  const [active, setActive] = useState('account')
  const [status, setStatus] = useState('')
  const [avatarBusy, setAvatarBusy] = useState(false)

  // Login form state (initialized from server user, reset on save).
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [loginErrors, setLoginErrors] = useState({})
  const [loginSaving, setLoginSaving] = useState(false)

  // Security form state.
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwErrors, setPwErrors] = useState({})
  const [pwSaving, setPwSaving] = useState(false)

  const firstErrorRef = useRef(null)

  useEffect(() => {
    fetchProfile?.()
  }, [fetchProfile])

  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username || '')
      setEmail(currentUser.email || '')
    }
  }, [currentUser?.username, currentUser?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  // Section spy (scroll-margin anchors; segmented control under lg).
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id.replace('profile-', ''))
        }
      },
      { rootMargin: '-96px 0px -70% 0px' }
    )
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(`profile-${id}`)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  const loginDirty = currentUser && (username !== (currentUser.username || '') || email !== (currentUser.email || ''))
  const pwDirty = currentPw.length > 0 || newPw.length > 0
  const dirtySections = useMemo(
    () => ({ login: Boolean(loginDirty), security: Boolean(pwDirty) }),
    [loginDirty, pwDirty]
  )

  const focusFirstError = () => {
    window.setTimeout(() => firstErrorRef.current?.focus(), 30)
  }

  const saveLogin = async (e) => {
    e?.preventDefault()
    const errors = {}
    if (username.trim().length < 3 || username.trim().length > 30) errors.username = 'Username must be 3–30 characters.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.'
    setLoginErrors(errors)
    if (Object.keys(errors).length) {
      firstErrorRef.current = document.querySelector('[data-login-error="true"]')
      focusFirstError()
      return
    }
    setLoginSaving(true)
    const res = await updateProfile({ username: username.trim(), email: email.trim().toLowerCase() })
    setLoginSaving(false)
    if (res.success) {
      setLoginErrors({})
      setStatus('Login details saved.')
      toast.success('Login details saved.')
    } else {
      // Server returns a single ambiguous message; map to the dirty field(s).
      const msg = res.message || 'Profile update failed.'
      const both = username !== currentUser.username && email !== currentUser.email
      const fieldErrors = {}
      if (/already exists/i.test(msg)) {
        if (email !== currentUser.email && (both || username === currentUser.username)) fieldErrors.email = msg
        else fieldErrors.username = msg
      } else {
        fieldErrors.form = msg
      }
      setLoginErrors(fieldErrors)
      setStatus(`Save failed: ${msg}`)
      toast.error(msg)
      fetchProfile?.()
      firstErrorRef.current = document.querySelector('[data-login-error="true"]')
      focusFirstError()
    }
  }

  const savePassword = async (e) => {
    e?.preventDefault()
    const errors = {}
    if (!currentPw) errors.current = 'Enter your current password.'
    if (newPw.length < 6) errors.new = 'New password must be at least 6 characters.'
    setPwErrors(errors)
    if (Object.keys(errors).length) {
      firstErrorRef.current = document.querySelector('[data-pw-error="true"]')
      focusFirstError()
      return
    }
    setPwSaving(true)
    const res = await updatePassword({ currentPassword: currentPw, newPassword: newPw })
    setPwSaving(false)
    if (res.success) {
      setCurrentPw('')
      setNewPw('')
      setPwErrors({})
      setStatus('Password updated.')
      toast.success('Password updated.')
    } else {
      const msg = res.message || 'Password update failed.'
      setPwErrors(/incorrect/i.test(msg) ? { current: msg } : { new: msg })
      setStatus(`Password update failed: ${msg}`)
      toast.error(msg)
      firstErrorRef.current = document.querySelector('[data-pw-error="true"]')
      focusFirstError()
    }
  }

  const onAvatarFile = async (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Upload a JPG, PNG, or WEBP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.')
      return
    }
    setAvatarBusy(true)
    const res = await uploadProfilePicture(file)
    setAvatarBusy(false)
    if (res.success) {
      setStatus('Profile photo updated.')
      toast.success('Profile photo updated.')
    } else {
      setStatus(`Photo upload failed: ${res.message}`)
      toast.error(res.message || 'Photo upload failed.')
    }
  }

  const onAvatarRemove = async () => {
    setAvatarBusy(true)
    const res = await removeProfilePicture()
    setAvatarBusy(false)
    if (res?.success) {
      setStatus('Profile photo removed.')
      toast.success('Profile photo removed.')
    } else {
      toast.error(res?.message || 'Photo removal failed.')
    }
  }

  const imageUrl =
    currentUser?.profileImage?.secureUrl ||
    (typeof currentUser?.profileImage === 'string' ? currentUser.profileImage : null)
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null
  const isGoogle = currentUser?.provider === 'google'
  const balance = Number(currentUser?.balance ?? portfolio?.user?.balance ?? NaN)
  const holdingsCount = portfolio?.holdings?.length
  const strength = passwordScore(newPw)
  const strengthLabel = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][strength]

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <p className="mf-label text-[var(--brass)] text-xs font-bold tracking-[0.14em] uppercase">Account workspace</p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--ivory)]">Profile &amp; settings</h1>
      <p className="mt-1 text-sm text-[var(--stone)]">Identity, credentials, preferences, and your data links.</p>

      {/* polite status for form outcomes (mirrors toasts for SR users) */}
      <div aria-live="polite" className="sr-only">{status}</div>

      {/* Mobile section nav */}
      <div className="lg:hidden sticky top-14 z-20 -mx-4 px-4 py-2 bg-[#0B0C0E]/95 backdrop-blur mt-6" role="group" aria-label="Profile sections">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-[#111316] p-1">
          {SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`#profile-${id}`}
              aria-current={active === id ? 'true' : undefined}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 min-h-[44px] inline-flex items-center justify-center text-xs font-semibold transition ${
                active === id ? 'bg-white/[0.07] text-[var(--ivory)]' : 'text-[var(--stone)]'
              }`}
            >
              {label}
              {dirtySections[id] && <span aria-hidden="true" className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#D9A441]" />}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-8">
        {/* Desktop sub-nav */}
        <nav aria-label="Profile sections" className="hidden lg:block w-60 shrink-0">
          <div className="sticky top-20 rounded-2xl border border-white/8 bg-[#111316] p-2">
            {SECTIONS.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={`#profile-${id}`}
                aria-label={dirtySections[id] ? `${label} — unsaved changes` : label}
                aria-current={active === id ? 'true' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-[44px] text-sm transition ${
                  active === id ? 'bg-white/[0.06] text-[var(--ivory)]' : 'text-[var(--stone)] hover:text-[var(--ivory)]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {dirtySections[id] ? (
                  <span className="flex items-center gap-1.5 text-xs text-[var(--stone)]">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#D9A441]" />
                    Unsaved
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 space-y-4">
          {/* Account summary header (D9): compact identity row + capital strip.
              Full width; the four control cards below share a 2-col grid. */}
          <section id="profile-account" aria-labelledby="profile-account-h" className="scroll-mt-32 rounded-2xl border border-white/8 bg-[#111316] p-5">
            <h2 id="profile-account-h" className="text-base font-bold text-[var(--ivory)]">Account</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
              <div className="flex items-center gap-3 min-w-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-white/10" />
                ) : (
                  <div aria-hidden="true" className="w-14 h-14 rounded-full bg-[#181B1F] border border-white/10 flex items-center justify-center text-xl font-bold text-[var(--ivory)]">
                    {monogram(currentUser?.username)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-base font-bold text-[var(--ivory)] truncate">{currentUser?.username || 'Trader'}</p>
                  <p className="text-xs text-[var(--stone)] truncate">{currentUser?.email || ''}</p>
                  {memberSince && <p className="text-xs text-[var(--stone-muted)]">Member since {memberSince}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 px-3.5 text-xs font-semibold transition ${avatarBusy ? 'opacity-50' : 'hover:border-[var(--brass)]/50 cursor-pointer'}`}>
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  {imageUrl ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={avatarBusy} onChange={(e) => onAvatarFile(e.target.files?.[0])} />
                </label>
                {imageUrl && (
                  <Button variant="ghost" type="button" disabled={avatarBusy} onClick={onAvatarRemove} className="min-h-[44px] text-xs">
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Remove
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 sm:ml-auto">
                <div>
                  <p className="mf-label">Virtual capital</p>
                  <p className="font-mono font-bold text-base text-[var(--ivory)] tabular-nums">
                    {Number.isFinite(balance) ? formatCurrency(balance) : '—'}
                  </p>
                </div>
                <Link to="/portfolio" className="text-xs font-semibold text-[var(--brass)] hover:underline min-h-[44px] inline-flex items-center">
                  View portfolio
                </Link>
              </div>
            </div>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <p className="text-xs text-[var(--stone)] mt-2 font-mono" role="status">Uploading {uploadProgress}%…</p>
            )}
            <p className="mf-meta mt-2">JPG, PNG, or WEBP under 5MB.</p>
          </section>

          <div className="grid gap-4 xl:grid-cols-2 items-start">

          {/* Login details (editable) */}
          <section id="profile-login" aria-labelledby="profile-login-h" className="scroll-mt-32 rounded-2xl border border-white/8 bg-[#111316] p-6">
            <h2 id="profile-login-h" className="text-base font-bold text-[var(--ivory)]">Login details</h2>
            <form onSubmit={saveLogin} className="mt-4 space-y-3" noValidate>
              <Field label="Username" htmlFor="profile-username" error={loginErrors.username} hint="3–30 characters.">
                <input
                  id="profile-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  data-login-error={loginErrors.username ? 'true' : undefined}
                  aria-invalid={Boolean(loginErrors.username)}
                  className="w-full rounded-xl border border-white/8 bg-[#0B0C0E] px-3.5 py-2.5 min-h-[44px] text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--brass)]"
                />
              </Field>
              <Field label="Email address" htmlFor="profile-email" error={loginErrors.email} hint="Used for sign-in.">
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  data-login-error={loginErrors.email ? 'true' : undefined}
                  aria-invalid={Boolean(loginErrors.email)}
                  className="w-full rounded-xl border border-white/8 bg-[#0B0C0E] px-3.5 py-2.5 min-h-[44px] text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--brass)]"
                />
              </Field>
              {loginErrors.form && <p className="text-xs text-[var(--loss)]" data-login-error="true">{loginErrors.form}</p>}
              <Button type="submit" variant="primary" disabled={!loginDirty || loginSaving} className="min-h-[44px]">
                {loginSaving ? 'Saving…' : 'Save login details'}
              </Button>
            </form>
          </section>

          {/* Security (editable unless Google provider) */}
          <section id="profile-security" aria-labelledby="profile-security-h" className="scroll-mt-32 rounded-2xl border border-white/8 bg-[#111316] p-6">
            <h2 id="profile-security-h" className="text-base font-bold text-[var(--ivory)]">Security</h2>
            {isGoogle ? (
              <p className="mt-3 text-sm text-[var(--stone)]">Signed in with Google — there is no MarketForge password to change. Manage credentials with your Google account.</p>
            ) : (
              <form onSubmit={savePassword} className="mt-4 space-y-3" noValidate>
                <Field label="Current password" htmlFor="profile-current-pw" error={pwErrors.current}>
                  <div className="relative">
                    <input
                      id="profile-current-pw"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      autoComplete="current-password"
                      data-pw-error={pwErrors.current ? 'true' : undefined}
                      aria-invalid={Boolean(pwErrors.current)}
                      className="w-full rounded-xl border border-white/8 bg-[#0B0C0E] px-3.5 py-2.5 pr-11 min-h-[44px] text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--brass)]"
                    />
                    <button type="button" onClick={() => setShowCurrent((v) => !v)} aria-label={showCurrent ? 'Hide current password' : 'Show current password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-[44px] min-h-[44px] text-[var(--stone)]">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="New password" htmlFor="profile-new-pw" error={pwErrors.new} hint="At least 6 characters.">
                  <div className="relative">
                    <input
                      id="profile-new-pw"
                      type={showNew ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      autoComplete="new-password"
                      data-pw-error={pwErrors.new ? 'true' : undefined}
                      aria-invalid={Boolean(pwErrors.new)}
                      className="w-full rounded-xl border border-white/8 bg-[#0B0C0E] px-3.5 py-2.5 pr-11 min-h-[44px] text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--brass)]"
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? 'Hide new password' : 'Show new password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-[44px] min-h-[44px] text-[var(--stone)]">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
                {newPw && (
                  <div className="flex items-center gap-2" role="status">
                    <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden" aria-hidden="true">
                      <div className="h-full rounded-full bg-[var(--brass)] transition-all" style={{ width: `${(strength / 4) * 100}%` }} />
                    </div>
                    <span className="text-xs text-[var(--stone)]">{strengthLabel}</span>
                  </div>
                )}
                <Button type="submit" variant="primary" disabled={!pwDirty || pwSaving} className="min-h-[44px]">
                  {pwSaving ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            )}
          </section>

          {/* Preferences */}
          <section id="profile-preferences" aria-labelledby="profile-preferences-h" className="scroll-mt-32 rounded-2xl border border-white/8 bg-[#111316] p-6">
            <h2 id="profile-preferences-h" className="text-base font-bold text-[var(--ivory)]">Preferences</h2>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--ivory)]">Motion</p>
                <p className="mf-meta mt-0.5">Full plays reveals and chart draws. Comfort renders everything statically. Saved on this device.</p>
              </div>
              <MotionToggle />
            </div>
          </section>

          {/* Data & activity */}
          <section id="profile-data" aria-labelledby="profile-data-h" className="scroll-mt-32 rounded-2xl border border-white/8 bg-[#111316] p-6">
            <h2 id="profile-data-h" className="text-base font-bold text-[var(--ivory)]">Data &amp; activity</h2>
            <ul className="mt-4 space-y-2">
              {[
                { to: '/activity', label: 'Activity ledger', desc: `Every fill with its order key${Number.isFinite(holdingsCount) ? ` · ${holdingsCount} open positions` : ''}` },
                { to: '/activity', label: 'Export CSV', desc: 'Filtered view, latest 100 rows, from the ledger' },
                { to: '/watchlist', label: 'Watchlist & price alerts', desc: 'Symbols you follow and the thresholds watching them' },
              ].map(({ to, label, desc }) => (
                <li key={label}>
                  <Link to={to} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0B0C0E] px-4 py-3 min-h-[44px] transition hover:border-[var(--brass)]/40">
                    <span>
                      <span className="block text-sm font-semibold text-[var(--ivory)]">{label}</span>
                      <span className="block text-xs text-[var(--stone)] mt-0.5">{desc}</span>
                    </span>
                    <span aria-hidden="true" className="text-[var(--brass)]">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          </div>{/* /grid */}

          <p className="flex items-center gap-2 text-sm text-[var(--stone)]">
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            Signed in as {currentUser?.email || 'your account'}. Balances change only through fills.
          </p>
        </div>
      </div>
    </div>
  )
}
