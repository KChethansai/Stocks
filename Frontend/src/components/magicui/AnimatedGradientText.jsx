export function AnimatedGradientText({
  children,
  className = '',
  from = '#bdf7ff',
  via = '#7ce6ff',
  to = '#2eafff'
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
