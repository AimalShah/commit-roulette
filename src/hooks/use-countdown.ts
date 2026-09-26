import { useEffect, useRef, useState } from 'react'

/**
 * Server-trusted countdown: every client renders from `endsAt` rather than
 * counting locally, so a late joiner and the host see the same clock.
 * Ticks at 10Hz for a smooth ring without a render storm.
 */
export function useCountdown(endsAt: number | null, totalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (endsAt === null) return
    setNow(Date.now())

    let last = 0
    const loop = (t: number) => {
      if (t - last >= 100) {
        last = t
        setNow(Date.now())
      }
      frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [endsAt])

  if (endsAt === null) {
    return { remainingMs: totalMs, elapsedMs: 0, progress: 0, expired: false }
  }

  const remainingMs = Math.max(0, endsAt - now)
  const elapsedMs = Math.max(0, Math.min(totalMs, totalMs - remainingMs))

  return {
    remainingMs,
    elapsedMs,
    progress: totalMs > 0 ? elapsedMs / totalMs : 0,
    expired: remainingMs <= 0,
  }
}
