export function ShimmerButton({
  children,
  className = '',
  shimmerColor = '#ffffff',
  shimmerSize = '0.1em',
  borderRadius = '10px',
  shimmerDuration = '2.5s',
  background = '#3B82F6',
  onClick,
  disabled = false,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        '--spread': '90deg',
        '--shimmer-color': shimmerColor,
        '--radius': borderRadius,
        '--speed': shimmerDuration,
        '--cut': shimmerSize,
        '--bg': background
      }}
      className={`group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/15 px-5 py-2.5 text-xs font-semibold font-mono text-white [background:var(--bg)] [border-radius:var(--radius)] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 shadow-md shadow-black/30 ${className}`}
      {...props}
    >
      {/* Spark container */}
      <div className="absolute inset-0 -z-30 overflow-visible [container-type:size]">
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="animate-spin-around absolute inset-[-100%] w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>

      {/* Backdrop */}
      <div className="absolute [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)] -z-20 transition-all duration-300 group-hover:brightness-110" />

      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  )
}
