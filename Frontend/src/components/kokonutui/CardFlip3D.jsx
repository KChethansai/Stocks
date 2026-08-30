import { useState } from 'react'

export function CardFlip3D({
  front,
  back,
  className = '',
  height = '320px',
  flipTrigger = 'hover' // 'hover' | 'click'
}) {
  const [isFlipped, setIsFlipped] = useState(false)

  const isClick = flipTrigger === 'click'

  return (
    <div
      className={`group relative [perspective:1000px] cursor-pointer ${className}`}
      style={{ minHeight: height }}
      onClick={isClick ? () => setIsFlipped(!isFlipped) : undefined}
    >
      <div
        className={`relative h-full w-full rounded-2xl transition-all duration-500 [transform-style:preserve-3d] ${
          isClick
            ? isFlipped
              ? '[transform:rotateY(180deg)]'
              : ''
            : 'group-hover:[transform:rotateY(180deg)]'
        }`}
      >
        {/* Front Face */}
        <div className="absolute inset-0 h-full w-full rounded-2xl border border-white/10 bg-[#111318] p-6 [backface-visibility:hidden] shadow-lg flex flex-col justify-between">
          {front}
        </div>

        {/* Back Face */}
        <div className="absolute inset-0 h-full w-full rounded-2xl border border-[#3B82F6]/30 bg-[#151820] p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] shadow-xl shadow-[#3B82F6]/10 flex flex-col justify-between">
          {back}
        </div>
      </div>
    </div>
  )
}
