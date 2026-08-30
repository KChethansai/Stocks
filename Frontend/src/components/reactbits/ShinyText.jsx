export function ShinyText({
  children,
  className = '',
  shimmerWidth = 100,
  speed = 3
}) {
  return (
    <span
      style={{
        '--shimmer-width': `${shimmerWidth}px`,
        '--shimmer-speed': `${speed}s`
      }}
      className={`inline-block animate-shiny-text bg-clip-text text-transparent [background-image:linear-gradient(120deg,rgba(255,255,255,0.7)_0%,rgba(255,255,255,1)_50%,rgba(255,255,255,0.7)_100%)] ${className}`}
    >
      {children}
    </span>
  )
}
