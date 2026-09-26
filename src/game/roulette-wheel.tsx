import type * as React from 'react'
import { useEffect, useMemo, useState } from 'react'

import { CATEGORIES } from '@/lib/challenges'
import { cn } from '@/lib/cn'
import type { Category } from '@/lib/types'

const R = 118
const CX = 150
const CY = 150
const INNER = 46
const SEGMENTS = CATEGORIES.length
const SEG = 360 / SEGMENTS
/** Pointer sits at 12 o'clock; the wheel turns so the winner lands under it. */
const POINTER_ANGLE = -90

const spinTransition =
  'transition-transform duration-[1500ms] [transition-timing-function:cubic-bezier(0.16,0.84,0.24,1)] motion-reduce:transition-none'

/** Both the wedge group and the label group ride the same rotation. */
function spinStyle(rotation: number): React.CSSProperties {
  return {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: `${CX}px ${CY}px`,
  }
}

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

function wedgePath(startAngle: number, endAngle: number) {
  const a = polar(startAngle, R)
  const b = polar(endAngle, R)
  const ai = polar(startAngle, INNER)
  const bi = polar(endAngle, INNER)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${ai.x} ${ai.y}`,
    `L ${a.x} ${a.y}`,
    `A ${R} ${R} 0 ${large} 1 ${b.x} ${b.y}`,
    `L ${bi.x} ${bi.y}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${ai.x} ${ai.y}`,
    'Z',
  ].join(' ')
}

/**
 * Fixed 1.5s spin (PRD §12). The winner is chosen before the wheel starts, so
 * the animation is pure decoration and every client lands on the same wedge.
 */
export function RouletteWheel({
  landed,
  spinning,
  spinCount,
  reducedMotion,
  className,
}: {
  landed: Category | null
  spinning: boolean
  spinCount: number
  reducedMotion: boolean
  className?: string
}) {
  const [rotation, setRotation] = useState(0)

  const target = useMemo(() => {
    if (!landed) return null
    const index = CATEGORIES.findIndex((c) => c.id === landed)
    if (index < 0) return null
    // Centre of the winning wedge, in wheel-local degrees.
    const wedgeCentre = index * SEG + SEG / 2
    return wedgeCentre
  }, [landed])

  useEffect(() => {
    if (reducedMotion || !target) return
    // Always travel forward, at least four full turns, so it never unwinds.
    const desired = POINTER_ANGLE - target
    const current = ((rotation % 360) + 360) % 360
    let delta = desired - current
    while (delta < 0) delta += 360
    setRotation(current + 360 * 4 + delta)
    // `rotation` is intentionally excluded: re-running on every change would
    // restart the animation mid-spin. `spinCount` is what starts a new spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, spinCount, target])

  return (
    <div className={cn('relative aspect-square w-full max-w-[19rem]', className)}>
      {/* pointer */}
      <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1">
        <svg viewBox="0 0 24 30" className="size-5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" aria-hidden="true">
          <path d="M12 30 2 8a10 10 0 1 1 20 0Z" fill="var(--primary)" />
          <circle cx="12" cy="9" r="3.5" fill="var(--background)" />
        </svg>
      </div>

      <svg viewBox="0 0 300 300" className="size-full" role="img" aria-label="Category roulette">
        <defs>
          <filter id="wheel-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r={R + 14} fill="var(--card)" stroke="var(--border)" />

        <g className={spinTransition} style={spinStyle(rotation)}>
          {CATEGORIES.map((cat, i) => {
            const start = i * SEG
            const isWinner = landed === cat.id
            return (
              <path
                key={cat.id}
                d={wedgePath(start, start + SEG)}
                fill={cat.accent}
                opacity={landed && !isWinner ? 0.22 : 0.92}
                stroke="var(--background)"
                strokeWidth={1.5}
                style={{ transition: 'opacity 260ms ease' }}
              />
            )
          })}
        </g>

        {/* labels ride with the wheel */}
        <g className={spinTransition} style={spinStyle(rotation)}>
          {CATEGORIES.map((cat, i) => {
            const mid = i * SEG + SEG / 2
            const p = polar(mid, 88)
            return (
              <text
                key={cat.id}
                x={p.x}
                y={p.y}
                fill={cat.accent}
                fontSize="11"
                fontWeight="700"
                letterSpacing="1.4"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid + 90} ${p.x} ${p.y})`}
                className="font-mono"
              >
                {cat.short}
              </text>
            )
          })}
        </g>

        {/* hub */}
        <g filter="url(#wheel-shadow)">
          <circle cx={CX} cy={CY} r={INNER - 2} fill="var(--background)" stroke="var(--border)" />
        </g>
        <circle
          cx={CX}
          cy={CY}
          r={INNER - 14}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          opacity={spinning ? 0.9 : 0.35}
        />
      </svg>
    </div>
  )
}
