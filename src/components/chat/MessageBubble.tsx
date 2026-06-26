import { useState, useRef } from 'react'
import type { Message } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { AttachmentPreview } from './AttachmentPreview'

interface Props {
  message: Message
  onReply: (msg: Message) => void
  onEdit: (msg: Message) => void
  onDelete: (msgId: string, forAll: boolean) => void
  onPin: (msgId: string) => void
  onReact: (msgId: string, emoji: string) => void
  onRemoveReact: (msgId: string, emoji: string) => void
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏']

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function MessageBubble({ message: msg, onReply, onEdit, onDelete, onPin, onReact, onRemoveReact }: Props) {
  const { user, isTrainer } = useAuth()
  const isOwn = msg.sender_id === user?.id
  const [showActions, setShowActions] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (msg.deleted_for_all) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 py-1`}>
        <p className="text-slate-500 text-xs italic">[Nachricht gelöscht]</p>
      </div>
    )
  }

  function startLongPress() {
    longPressTimer.current = setTimeout(() => setShowActions(true), 500)
  }
  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  const reactionGroups = msg.reactions.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = []
    acc[r.emoji].push(r.user_id)
    return acc
  }, {})

  return (
    <div
      className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} gap-2 px-4 py-1 group`}
      onContextMenu={e => { e.preventDefault(); setShowActions(true) }}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      {!isOwn && (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mt-1"
          style={{ backgroundColor: msg.sender_avatar_color ?? '#0EA5E9' }}
        >
          {getInitials(msg.sender_name)}
        </div>
      )}

      <div className={`max-w-xs md:max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isOwn && (
          <p className="text-slate-400 text-xs mb-1 px-1">{msg.sender_name}</p>
        )}

        {msg.reply_to && msg.reply_preview && (
          <div className={`mb-1 px-3 py-1 rounded-lg border-l-2 border-teal-500 bg-white/5 max-w-full ${isOwn ? 'self-end' : 'self-start'}`}>
            <p className="text-slate-400 text-xs truncate">{msg.reply_preview}</p>
          </div>
        )}

        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-tr-sm'
              : 'glass text-white rounded-tl-sm'
          }`}
        >
          {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
          {msg.attachments.map(a => <AttachmentPreview key={a.id} attachment={a} />)}
          <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className="text-xs opacity-50">{formatTime(msg.created_at)}</span>
            {msg.edited_at && <span className="text-xs opacity-40">bearbeitet</span>}
          </div>
        </div>

        {Object.entries(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactionGroups).map(([emoji, userIds]) => {
              const isMine = userIds.includes(user?.id ?? '')
              return (
                <button
                  key={emoji}
                  onClick={() => isMine ? onRemoveReact(msg.id, emoji) : onReact(msg.id, emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    isMine ? 'bg-teal-500/20 border-teal-500/40 text-teal-300' : 'bg-white/5 border-white/10 text-white/70'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{userIds.length}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className={`hidden group-hover:flex items-center gap-1 self-center ${isOwn ? 'mr-2' : 'ml-2'}`}>
        {QUICK_EMOJIS.slice(0, 4).map(emoji => (
          <button
            key={emoji}
            onClick={() => {
              const mine = msg.reactions.find(r => r.user_id === user?.id && r.emoji === emoji)
              mine ? onRemoveReact(msg.id, emoji) : onReact(msg.id, emoji)
            }}
            className="text-sm hover:scale-125 transition-transform"
          >
            {emoji}
          </button>
        ))}
        <button onClick={() => setShowActions(true)} className="text-slate-400 hover:text-white text-sm ml-1">···</button>
      </div>

      {showActions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" onClick={() => setShowActions(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-2 w-64 shadow-2xl mb-8 md:mb-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-around py-2 border-b border-white/10 mb-2">
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  className="text-xl hover:scale-125 transition-transform"
                  onClick={() => {
                    const mine = msg.reactions.find(r => r.user_id === user?.id && r.emoji === emoji)
                    mine ? onRemoveReact(msg.id, emoji) : onReact(msg.id, emoji)
                    setShowActions(false)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {[
              { label: '↩ Antworten', action: () => { onReply(msg); setShowActions(false) } },
              ...(isOwn ? [{ label: '✏️ Bearbeiten', action: () => { onEdit(msg); setShowActions(false) } }] : []),
              ...(isTrainer ? [{ label: '📌 Anpinnen', action: () => { onPin(msg.id); setShowActions(false) } }] : []),
              { label: '🗑️ Für mich löschen', action: () => { onDelete(msg.id, false); setShowActions(false) } },
              ...(isOwn || user?.role === 'admin' ? [{
                label: '🗑️ Für alle löschen',
                action: () => {
                  if (window.confirm('Nachricht für alle löschen?')) { onDelete(msg.id, true); setShowActions(false) }
                },
              }] : []),
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 rounded-xl"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
