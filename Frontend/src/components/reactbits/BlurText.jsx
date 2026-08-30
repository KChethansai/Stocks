import { useEffect, useState } from 'react'

export function BlurText({
  text = '',
  className = '',
  delay = 0.05,
  animateBy = 'words' // 'words' | 'letters'
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const elements = animateBy === 'words' ? text.split(' ') : text.split('')

  return (
    <span className={`inline-flex flex-wrap gap-[0.25em] ${className}`}>
      {elements.map((el, index) => (
        <span
          key={index}
          style={{
            transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * delay}s`,
            filter: mounted ? 'blur(0px)' : 'blur(8px)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(6px)'
          }}
          className="inline-block"
        >
          {el}
        </span>
      ))}
    </span>
  )
}
