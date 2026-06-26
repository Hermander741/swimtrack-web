import { useState, useEffect, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { Channel, Message, PinnedMessage } from '../types'
import { listChannels, listMessages, listPins } from '../api/chat'

interface TypingUser { userId: string; name: string }

export function useChat(socketRef: React.MutableRefObject<Socket | null>) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [pinnedMessages, setPinnedMessages] = useState<Record<string, PinnedMessage[]>>({})
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({})
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({})
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    listChannels().then(res => {
      if (res.ok) setChannels(res.data)
    })
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const onNewMessage = (msg: Message) => {
      setMessages(prev => {
        const existing = prev[msg.channel_id] ?? []
        if (existing.find(m => m.id === msg.id)) return prev
        return { ...prev, [msg.channel_id]: [...existing, msg] }
      })
    }

    const onMessageEdited = (data: { messageId: string; content: string; editedAt: string }) => {
      setMessages(prev => {
        const updated: Record<string, Message[]> = {}
        for (const [cid, msgs] of Object.entries(prev)) {
          updated[cid] = msgs.map(m =>
            m.id === data.messageId ? { ...m, content: data.content, edited_at: data.editedAt } : m,
          )
        }
        return updated
      })
    }

    const onMessageDeleted = (data: { messageId: string; deletedForAll: boolean }) => {
      setMessages(prev => {
        const updated: Record<string, Message[]> = {}
        for (const [cid, msgs] of Object.entries(prev)) {
          updated[cid] = data.deletedForAll
            ? msgs.map(m => m.id === data.messageId ? { ...m, deleted_for_all: true, content: null } : m)
            : msgs.filter(m => m.id !== data.messageId)
        }
        return updated
      })
    }

    const onReactionAdded = (data: { messageId: string; userId: string; userName: string; emoji: string }) => {
      setMessages(prev => {
        const updated: Record<string, Message[]> = {}
        for (const [cid, msgs] of Object.entries(prev)) {
          updated[cid] = msgs.map(m => {
            if (m.id !== data.messageId) return m
            const existing = m.reactions.find(r => r.user_id === data.userId && r.emoji === data.emoji)
            if (existing) return m
            return { ...m, reactions: [...m.reactions, { emoji: data.emoji, user_id: data.userId, user_name: data.userName }] }
          })
        }
        return updated
      })
    }

    const onReactionRemoved = (data: { messageId: string; userId: string; emoji: string }) => {
      setMessages(prev => {
        const updated: Record<string, Message[]> = {}
        for (const [cid, msgs] of Object.entries(prev)) {
          updated[cid] = msgs.map(m => {
            if (m.id !== data.messageId) return m
            return { ...m, reactions: m.reactions.filter(r => !(r.user_id === data.userId && r.emoji === data.emoji)) }
          })
        }
        return updated
      })
    }

    const onTyping = (data: { channelId: string; userId: string; name: string }) => {
      setTypingUsers(prev => {
        const existing = (prev[data.channelId] ?? []).filter(u => u.userId !== data.userId)
        return { ...prev, [data.channelId]: [...existing, { userId: data.userId, name: data.name }] }
      })
      clearTimeout(typingTimers.current[data.userId])
      typingTimers.current[data.userId] = setTimeout(() => {
        setTypingUsers(prev => ({
          ...prev,
          [data.channelId]: (prev[data.channelId] ?? []).filter(u => u.userId !== data.userId),
        }))
      }, 4000)
    }

    const onStoppedTyping = (data: { channelId: string; userId: string }) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.channelId]: (prev[data.channelId] ?? []).filter(u => u.userId !== data.userId),
      }))
    }

    socket.on('new-message', onNewMessage)
    socket.on('message-edited', onMessageEdited)
    socket.on('message-deleted', onMessageDeleted)
    socket.on('reaction-added', onReactionAdded)
    socket.on('reaction-removed', onReactionRemoved)
    socket.on('typing', onTyping)
    socket.on('stopped-typing', onStoppedTyping)

    return () => {
      socket.off('new-message', onNewMessage)
      socket.off('message-edited', onMessageEdited)
      socket.off('message-deleted', onMessageDeleted)
      socket.off('reaction-added', onReactionAdded)
      socket.off('reaction-removed', onReactionRemoved)
      socket.off('typing', onTyping)
      socket.off('stopped-typing', onStoppedTyping)
    }
  }, [socketRef])

  const setActiveChannel = useCallback(async (id: string | null) => {
    setActiveChannelId(id)
    if (!id) return
    if (messages[id]) return
    setLoadingMessages(true)
    const [msgsRes, pinsRes] = await Promise.all([listMessages(id), listPins(id)])
    if (msgsRes.ok) {
      setMessages(prev => ({ ...prev, [id]: msgsRes.data }))
      setHasMore(prev => ({ ...prev, [id]: msgsRes.data.length === 50 }))
    }
    if (pinsRes.ok) setPinnedMessages(prev => ({ ...prev, [id]: pinsRes.data }))
    setLoadingMessages(false)
  }, [messages])

  const loadMoreMessages = useCallback(async (channelId: string) => {
    const existing = messages[channelId]
    if (!existing?.length || !hasMore[channelId]) return
    const oldest = existing[0]
    const res = await listMessages(channelId, oldest.id)
    if (res.ok) {
      setMessages(prev => ({ ...prev, [channelId]: [...res.data, ...(prev[channelId] ?? [])] }))
      setHasMore(prev => ({ ...prev, [channelId]: res.data.length === 50 }))
    }
  }, [messages, hasMore])

  const sendMessage = useCallback((
    channelId: string, content: string, replyTo?: string, attachmentIds?: string[],
  ) => {
    socketRef.current?.emit('send-message', { channelId, content, replyTo, attachmentIds })
  }, [socketRef])

  const editMessage = useCallback((messageId: string, content: string) => {
    socketRef.current?.emit('edit-message', { messageId, content })
  }, [socketRef])

  const deleteMessage = useCallback((messageId: string, forAll: boolean) => {
    socketRef.current?.emit('delete-message', { messageId, forAll })
  }, [socketRef])

  const addReaction = useCallback((messageId: string, emoji: string) => {
    socketRef.current?.emit('add-reaction', { messageId, emoji })
  }, [socketRef])

  const removeReaction = useCallback((messageId: string, emoji: string) => {
    socketRef.current?.emit('remove-reaction', { messageId, emoji })
  }, [socketRef])

  const markRead = useCallback((channelId: string, lastMessageId: string) => {
    socketRef.current?.emit('mark-read', { channelId, lastMessageId })
  }, [socketRef])

  return {
    channels, setChannels,
    activeChannelId, setActiveChannel,
    messages, loadMoreMessages,
    pinnedMessages, setPinnedMessages,
    typingUsers,
    loadingMessages,
    hasMore,
    sendMessage, editMessage, deleteMessage,
    addReaction, removeReaction,
    markRead,
  }
}
