import { useEffect, useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { ChannelList } from '../components/chat/ChannelList'
import { MessageList } from '../components/chat/MessageList'
import { MessageInput } from '../components/chat/MessageInput'
import { useSocket } from '../hooks/useSocket'
import { useChat } from '../hooks/useChat'
import { useAuth } from '../hooks/useAuth'
import { subscribePush } from '../api/push'
import type { Channel, Message } from '../types'

export function Chat() {
  const { user } = useAuth()
  const socketRef = useSocket()
  const {
    channels, setChannels,
    activeChannelId, setActiveChannel,
    messages, loadMoreMessages,
    pinnedMessages, setPinnedMessages,
    typingUsers,
    hasMore,
    sendMessage, editMessage, deleteMessage,
    addReaction, removeReaction,
    markRead,
  } = useChat(socketRef)

  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editingMsg, setEditingMsg] = useState<Message | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (user) subscribePush().catch(() => {})
  }, [user])

  // Deep-link from push notification: /chat?channel=<uuid>
  useEffect(() => {
    if (channels.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const channelId = params.get('channel')
    if (channelId && channels.find(c => c.id === channelId)) {
      setActiveChannel(channelId)
    }
  }, [channels])

  function handleChannelCreated(ch: Channel) {
    setChannels(prev => [...prev, ch])
    setActiveChannel(ch.id)
  }

  function handleChannelUpdated(ch: Channel) {
    setChannels(prev => prev.map(c => c.id === ch.id ? ch : c))
  }

  function handleEdit(msg: Message) {
    setEditingMsg(msg)
    setEditContent(msg.content ?? '')
  }

  function handleSubmitEdit() {
    if (!editingMsg || !editContent.trim()) return
    editMessage(editingMsg.id, editContent.trim())
    setEditingMsg(null)
    setEditContent('')
  }

  const activeChannel = channels.find(c => c.id === activeChannelId)
  const activeMessages = activeChannelId ? (messages[activeChannelId] ?? []) : []
  const activePins = activeChannelId ? (pinnedMessages[activeChannelId] ?? []) : []
  const activeTyping = activeChannelId ? (typingUsers[activeChannelId] ?? []) : []
  const activeHasMore = activeChannelId ? (hasMore[activeChannelId] ?? false) : false

  function handleTypingStart() {
    if (activeChannelId) socketRef.current?.emit('typing-start', { channelId: activeChannelId })
  }
  function handleTypingStop() {
    if (activeChannelId) socketRef.current?.emit('typing-stop', { channelId: activeChannelId })
  }

  return (
    <PageShell title="Chat" fullHeight hideNav={!!activeChannelId}>
      <div className="flex flex-1 min-h-0">
        {/* Channel sidebar */}
        <div className={`w-full md:w-72 md:block border-r border-white/10 ${activeChannelId ? 'hidden md:block' : 'block'}`}>
          <ChannelList
            channels={channels}
            activeChannelId={activeChannelId}
            onSelect={id => { setReplyTo(null); setEditingMsg(null); setActiveChannel(id) }}
            onChannelCreated={handleChannelCreated}
            onChannelUpdated={handleChannelUpdated}
          />
        </div>

        {/* Message view */}
        <div className={`flex-1 flex flex-col ${activeChannelId ? 'flex' : 'hidden md:flex'}`}>
          {activeChannelId && activeChannel ? (
            <>
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 shrink-0">
                <button onClick={() => setActiveChannel(null)} className="md:hidden text-teal-400 text-sm">←</button>
                <span className="text-white font-semibold">{activeChannel.name}</span>
                {activeChannel.description && (
                  <span className="text-slate-400 text-sm truncate hidden md:block">{activeChannel.description}</span>
                )}
              </div>

              {editingMsg && (
                <div className="px-4 py-2 bg-teal-500/10 border-b border-teal-500/20 flex items-center gap-2 shrink-0">
                  <span className="text-teal-400 text-sm flex-1">Nachricht bearbeiten</span>
                  <button onClick={() => setEditingMsg(null)} className="text-slate-400 hover:text-white text-sm">Abbrechen</button>
                </div>
              )}

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <MessageList
                  channelId={activeChannelId}
                  messages={activeMessages}
                  pinnedMessages={activePins}
                  typingUsers={activeTyping}
                  hasMore={activeHasMore}
                  onLoadMore={() => loadMoreMessages(activeChannelId)}
                  onMarkRead={lastId => markRead(activeChannelId, lastId)}
                  onPinned={pin => setPinnedMessages(prev => {
                    const existing = prev[activeChannelId] ?? []
                    if (existing.some(p => p.id === pin.id)) return prev
                    return { ...prev, [activeChannelId]: [pin, ...existing] }
                  })}
                  onUnpinned={pinId => setPinnedMessages(prev => ({
                    ...prev,
                    [activeChannelId]: (prev[activeChannelId] ?? []).filter(p => p.id !== pinId),
                  }))}
                  onReply={setReplyTo}
                  onEdit={handleEdit}
                  onDelete={deleteMessage}
                  onReact={addReaction}
                  onRemoveReact={removeReaction}
                />

                {editingMsg ? (
                  <div className="border-t border-white/10 px-4 py-3 flex gap-2 shrink-0">
                    <input
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmitEdit() }}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-teal-500/50"
                    />
                    <button onClick={handleSubmitEdit} className="px-4 py-2 bg-teal-500 rounded-xl text-white text-sm">
                      Speichern
                    </button>
                  </div>
                ) : (
                  <MessageInput
                    channelId={activeChannelId}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    onSend={(content, replyToId, attachmentIds) =>
                      sendMessage(activeChannelId, content, replyToId, attachmentIds)
                    }
                    onTypingStart={handleTypingStart}
                    onTypingStop={handleTypingStop}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-400 text-sm">Chat auswählen</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
