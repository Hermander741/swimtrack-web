import { useState } from 'react'
import type { Channel } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { CreateChannelModal } from './CreateChannelModal'

interface Props {
  channels: Channel[]
  activeChannelId: string | null
  onSelect: (id: string) => void
  onChannelCreated: (ch: Channel) => void
}

export function ChannelList({ channels, activeChannelId, onSelect, onChannelCreated }: Props) {
  const { isTrainer } = useAuth()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-white/10">
        <h2 className="text-white font-semibold text-sm uppercase tracking-widest opacity-60">Channels</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {channels.length === 0 && (
          <p className="text-slate-400 text-sm px-4 py-6">Keine Channels vorhanden</p>
        )}
        {channels.map(ch => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch.id)}
            className={[
              'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
              activeChannelId === ch.id
                ? 'bg-teal-500/20 text-teal-400'
                : 'text-slate-300 hover:bg-white/5',
            ].join(' ')}
          >
            <span className="text-lg opacity-60">#</span>
            <span className="flex-1 text-sm font-medium truncate">{ch.name}</span>
          </button>
        ))}
      </div>
      {isTrainer && (
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-2 rounded-xl text-sm font-medium text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 transition-colors"
          >
            + Channel erstellen
          </button>
        </div>
      )}
      {showCreate && (
        <CreateChannelModal
          onClose={() => setShowCreate(false)}
          onCreated={(ch) => { onChannelCreated(ch); setShowCreate(false) }}
        />
      )}
    </div>
  )
}
