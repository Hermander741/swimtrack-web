import { useRef, useState } from 'react'
import type { Channel } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { BASE } from '../../api/client'
import { uploadChannelAvatar } from '../../api/chat'
import { CreateChannelModal } from './CreateChannelModal'
import { ImageCropModal } from '../ui/ImageCropModal'

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

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Gestern'
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })
}

function ChannelAvatar({ channel, canEdit, onUpdated }: {
  channel: Channel
  canEdit: boolean
  onUpdated: (ch: Channel) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    e.target.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setUploading(true)
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    const res = await uploadChannelAvatar(channel.id, file)
    if (res.ok) onUpdated(res.data)
    setUploading(false)
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  const avatarUrl = channel.avatar_url ? `${BASE}${channel.avatar_url}` : null

  return (
    <>
      <div
        className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white overflow-hidden bg-teal-600/60 relative ${canEdit ? 'cursor-pointer' : ''}`}
        onClick={e => { if (canEdit) { e.stopPropagation(); inputRef.current?.click() } }}
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
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  )
}

export function ChannelList({ channels, activeChannelId, onSelect, onChannelCreated, onChannelUpdated }: Props) {
  const { isTrainer } = useAuth()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 && (
          <p className="text-slate-400 text-sm px-4 py-8 text-center">Keine Chats vorhanden</p>
        )}
        {channels.map(ch => {
          const unread = ch.unread_count ?? 0
          const isActive = activeChannelId === ch.id
          return (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={[
                'w-full text-left px-4 py-3 flex items-center gap-3 border-b border-white/5 transition-colors active:bg-white/10',
                isActive ? 'bg-teal-500/10' : 'hover:bg-white/5',
              ].join(' ')}
            >
              <ChannelAvatar channel={ch} canEdit={isTrainer} onUpdated={onChannelUpdated} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-semibold truncate ${isActive ? 'text-teal-400' : 'text-white'}`}>
                    {ch.name}
                  </span>
                  {ch.last_message_at && (
                    <span className={`text-xs flex-shrink-0 ${unread > 0 ? 'text-teal-400 font-medium' : 'text-slate-500'}`}>
                      {formatTime(ch.last_message_at)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-sm text-slate-400 truncate">
                    {ch.last_message_deleted ? (
                      <span className="italic text-slate-500">Nachricht gelöscht</span>
                    ) : ch.last_message_content ? (
                      ch.last_message_content
                    ) : (
                      <span className="text-slate-500 text-xs">{ch.description ?? 'Kein Nachrichten'}</span>
                    )}
                  </p>
                  {unread > 0 && (
                    <span className="flex-shrink-0 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-teal-500 text-white text-xs font-bold">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
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
