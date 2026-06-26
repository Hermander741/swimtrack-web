import { useState } from 'react'
import type { PinnedMessage } from '../../types'
import { unpinMessage } from '../../api/chat'
import { useAuth } from '../../hooks/useAuth'

interface Props {
  channelId: string
  pins: PinnedMessage[]
  onUnpinned: (pinId: string) => void
}

export function PinnedMessages({ channelId, pins, onUnpinned }: Props) {
  const { isTrainer } = useAuth()
  const [open, setOpen] = useState(false)
  const [unpinning, setUnpinning] = useState<string | null>(null)

  if (pins.length === 0) return null

  async function handleUnpin(pin: PinnedMessage) {
    setUnpinning(pin.id)
    const res = await unpinMessage(channelId, pin.id)
    if (res.ok) onUnpinned(pin.id)
    setUnpinning(null)
  }

  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 text-teal-400 text-xs font-medium hover:bg-white/5"
      >
        <span>📌</span>
        <span>{pins.length} angepinnte Nachricht{pins.length !== 1 ? 'en' : ''}</span>
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="divide-y divide-white/10">
          {pins.map(pin => (
            <div key={pin.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-slate-400 text-xs mb-1">{pin.sender_name}</p>
                <p className="text-white text-sm truncate">{pin.content ?? '[Anhang]'}</p>
              </div>
              {isTrainer && (
                <button
                  onClick={() => handleUnpin(pin)}
                  disabled={unpinning === pin.id}
                  className="text-slate-500 hover:text-red-400 text-sm shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
