import { useCallback, useEffect, useState } from 'react'

/** Swap this to change the background track; anything under `public/` works. */
const TRACK_SRC = '/lofi-loop.mp3'
const DEFAULT_VOLUME = 0.35

/**
 * One element for the whole app so every header instance drives the same
 * playback instead of stacking overlapping loops.
 */
let audio: HTMLAudioElement | null = null
let playing = false
let volume = DEFAULT_VOLUME

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function getAudio() {
  if (audio === null) {
    audio = new Audio(TRACK_SRC)
    audio.loop = true
    audio.preload = 'none'
    audio.volume = volume
    audio.addEventListener('play', () => {
      playing = true
      emit()
    })
    audio.addEventListener('pause', () => {
      playing = false
      emit()
    })
  }
  return audio
}

export function useLofiMusic() {
  const [, force] = useState(0)

  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const toggle = useCallback(() => {
    const el = getAudio()
    if (playing) {
      el.pause()
      return
    }
    // Autoplay policies reject play() outside a gesture, and a failed resume
    // must not leave the button stuck showing "playing".
    el.play().catch(() => {
      playing = false
      emit()
    })
  }, [])

  const setVolume = useCallback((next: number) => {
    volume = Math.min(1, Math.max(0, next))
    if (audio !== null) audio.volume = volume
    emit()
  }, [])

  return { playing, toggle, volume, setVolume }
}
