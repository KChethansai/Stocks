export function LiquidGlassButton({
  children,
  className = '',
  onClick,
  disabled = false,
  variant = 'primary', // 'primary' | 'neon' | 'danger'
  type = 'button',
  ...props
}) {
  const variantStyles = {
    primary: 'border-white/15 bg-white/5 hover:bg-white/10 text-[#F5F7FA] hover:border-white/25 hover:shadow-[#3B82F6]/20',
    neon: 'border-[#3B82F6]/30 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 text-[#3B82F6] hover:border-[#3B82F6]/60 hover:shadow-[#3B82F6]/30',
    danger: 'border-[#EF4444]/30 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] hover:border-[#EF4444]/60 hover:shadow-[#EF4444]/30'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-mono font-semibold backdrop-blur-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 shadow-md ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {/* Top subtle highlight */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  )
}
