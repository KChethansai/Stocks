export function AnimatedGradientText({
  children,
  className = '',
  from = '#60A5FA',
  via = '#3B82F6',
  to = '#10B981'
}) {
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(to right, ${from}, ${via}, ${to}, ${from})`,
        backgroundSize: '300% 100%'
      }}
      className={`inline-block animate-gradient-text bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  )
}
