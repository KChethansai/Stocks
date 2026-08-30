export function Aurora({
  className = '',
  color1 = '#1E3A8A',
  color2 = '#0F172A',
  color3 = '#064E3B'
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden opacity-25 ${className}`}
      aria-hidden="true"
    >
      <div
        style={{
          background: `radial-gradient(circle at 20% 30%, ${color1} 0%, transparent 50%), radial-gradient(circle at 80% 40%, ${color2} 0%, transparent 50%), radial-gradient(circle at 50% 80%, ${color3} 0%, transparent 60%)`,
          filter: 'blur(80px)'
        }}
        className="absolute -inset-[30%] animate-aurora-drift"
      />
    </div>
  )
}
