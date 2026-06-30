import { useRef, useState } from 'react'
import type { Channel } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { BASE } from '../../api/client'
import { uploadChannelAvatar } from '../../api/chat'
import { CreateChannelModal } from './CreateChannelModal'

interface Props {
  channels: Channel[]
  activeChannelId: string | null
  onSelect: (id: string) => void
  onChannelCreated: (ch: Channel) => void
  onChannelUpdated: (ch: Channel) => void
}

function getInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function ChannelAvatar({ channel, canEdit, onUpdated }: {
  channel: Channel
  canEdit: boolean
  onUpdated: (ch: Channel) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const res = await uploadChannelAvatar(channel.id, file)
    if (res.ok) onUpdated(res.data)
    setUploading(false)
    e.target.value = ''
  }

  const avatarUrl = channel.avatar_url ? `${BASE}${channel.avatar_url}` : null

  return (
    <div
      className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold text-white overflow-hidden bg-teal-600/40 relative ${canEdit ? 'cursor-pointer' : ''}`}
      onClick={() => canEdit && inputRef.current?.click()}
      title={canEdit ? 'Foto ändern' : undefined}
    >
      {uploading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : avatarUrl ? (
        <img src={avatarUrl} alt={channel.name} className="w-full h-full object-cover" />
      ) : (
        getInitials(channel.name)
      )}
      {canEdit && (
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      )}
    </div>
  )
}

export function ChannelList({ channels, activeChannelId, onSelect, onChannelCreated, onChannelUpdated }: Props) {
  const { isTrainer } = useAuth()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-white/10">
        <h2 className="text-white font-semibold text-sm uppercase tracking-widest opacity-60">Chats</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {channels.length === 0 && (
          <p className="text-slate-400 text-sm px-4 py-6">Keine Chats vorhanden</p>
        )}
        {channels.map(ch => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch.id)}
            className={[
              'w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors',
              activeChannelId === ch.id
                ? 'bg-teal-500/20 text-teal-400'
                : 'text-slate-300 hover:bg-white/5',
            ].join(' ')}
          >
            <ChannelAvatar
              channel={ch}
              canEdit={isTrainer}
              onUpdated={onChannelUpdated}
            />
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
            + Chat erstellen
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
