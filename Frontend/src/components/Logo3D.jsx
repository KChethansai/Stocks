/* Vector wordmark + monogram. Replaces the PNG tilt logo: no tilt, no glow.
 * Props preserved for existing callers (size, showText, textClassName). */

const sizes = {
  xs: { box: 'h-7 w-7', text: 'text-sm' },
  sm: { box: 'h-8 w-8', text: 'text-base' },
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
}

function Mark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="MarketForge">
      <rect width="64" height="64" rx="12" fill="#181B1F" />
      <path
        d="M14 44 L26 28 L34 36 L50 18"
        fill="none"
        stroke="#ECE9E2"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="18" r="4" fill="#C9A96E" />
    </svg>
  )
}

export default function Logo3D({ size = 'md', showText = false, textClassName = '', className = '' }) {
  const s = sizes[size] || sizes.md
  const box = typeof s === 'string' ? s : s.box
  const text = typeof s === 'object' ? s.text : 'text-base'
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark className={box} />
      {showText && (
        <span className={`font-semibold tracking-tight text-[var(--ivory)] ${text} ${textClassName}`}>
          MarketForge
        </span>
      )}
    </span>
  )
}
