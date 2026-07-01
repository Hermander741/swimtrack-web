import { useEffect, useRef, useCallback } from 'react'
import type { Message, PinnedMessage } from '../../types'
import { pinMessage } from '../../api/chat'
import { MessageBubble } from './MessageBubble'
import { PinnedMessages } from './PinnedMessages'
import { TypingIndicator } from './TypingIndicator'

interface TypingUser { userId: string; name: string }

interface Props {
  channelId: string
  messages: Message[]
  pinnedMessages: PinnedMessage[]
  typingUsers: TypingUser[]
  hasMore: boolean
  onLoadMore: () => void
  onMarkRead: (lastId: string) => void
  onPinned: (pin: PinnedMessage) => void
  onUnpinned: (pinId: string) => void
  onReply: (msg: Message) => void
  onEdit: (msg: Message) => void
  onDelete: (msgId: string, forAll: boolean) => void
  onReact: (msgId: string, emoji: string) => void
  onRemoveReact: (msgId: string, emoji: string) => void
}

function formatDateLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Heute'
  if (d.toDateString() === yesterday.toDateString()) return 'Gestern'
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function MessageList({
  channelId, messages, pinnedMessages, typingUsers, hasMore,
  onLoadMore, onMarkRead, onPinned, onUnpinned, onReply, onEdit, onDelete, onReact, onRemoveReact,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const prevLen = useRef(0)
  // Keep latest onMarkRead in a ref so it never triggers the effect
  const onMarkReadRef = useRef(onMarkRead)
  useEffect(() => { onMarkReadRef.current = onMarkRead })

  useEffect(() => {
    if (atBottom.current) {
      // instant on initial load (many messages), smooth when a single new one arrives
      const behavior = messages.length - prevLen.current > 1 ? 'instant' : 'smooth'
      bottomRef.current?.scrollIntoView({ behavior })
    }
    prevLen.current = messages.length
    const last = messages[messages.length - 1]
    if (last) onMarkReadRef.current(last.id)
  }, [messages])

  useEffect(() => {
    if (!topRef.current || !hasMore) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) onLoadMore()
    }, { threshold: 0.1 })
    observer.observe(topRef.current)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  function handleScroll() {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    atBottom.current = scrollHeight - scrollTop - clientHeight < 60
  }

  const handlePin = useCallback(async (msgId: string) => {
    const res = await pinMessage(channelId, msgId)
    if (res.ok) onPinned(res.data)
  }, [channelId, onPinned])

  const groups: { label: string; messages: { msg: Message; isGrouped: boolean }[] }[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1]
    const label = formatDateLabel(msg.created_at)
    const isGrouped = !!prev
      && prev.sender_id === msg.sender_id
      && !prev.deleted_for_all
      && new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 2 * 60 * 1000
      && formatDateLabel(prev.created_at) === label
    const last = groups[groups.length - 1]
    if (last?.label === label) last.messages.push({ msg, isGrouped })
    else groups.push({ label, messages: [{ msg, isGrouped }] })
  }

  return (
    <div className="flex flex-col h-full">
      <PinnedMessages channelId={channelId} pins={pinnedMessages} onUnpinned={onUnpinned} />
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto py-4"
        onScroll={handleScroll}
      >
        {hasMore && <div ref={topRef} className="h-4" />}
        {groups.map(group => (
          <div key={group.label}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-slate-500 text-xs bg-ocean-950 px-2">{group.label}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            {group.messages.map(({ msg, isGrouped }) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isGrouped={isGrouped}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onPin={handlePin}
                onReact={onReact}
                onRemoveReact={onRemoveReact}
              />
            ))}
          </div>
        ))}
        <TypingIndicator users={typingUsers} />
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
