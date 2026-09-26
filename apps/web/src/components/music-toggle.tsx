import { Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useLofiMusic } from '@/hooks/use-lofi-music'

export function MusicToggle() {
  const { playing, toggle } = useLofiMusic()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      onClick={toggle}
      aria-label="Toggle lofi music"
      aria-pressed={playing}
      title={playing ? 'Pause lofi music' : 'Play lofi music'}
    >
      {playing ? <Volume2 /> : <VolumeX />}
    </Button>
  )
}
