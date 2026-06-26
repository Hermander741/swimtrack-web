import { useEffect } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { ChannelList } from '../components/chat/ChannelList'
import { useSocket } from '../hooks/useSocket'
import { useChat } from '../hooks/useChat'
import { useAuth } from '../hooks/useAuth'
import { subscribePush } from '../api/push'
import type { Channel } from '../types'

function EmptyState() {
  return (
    <div className="hidden md:flex flex-1 items-center justify-center">
      <p className="text-slate-400 text-sm">Channel auswählen</p>
    </div>
  )
}

function MessageViewPlaceholder({ channelId, onBack }: { channelId: string; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <button onClick={onBack} className="md:hidden text-teal-400 text-sm">←</button>
        <span className="text-white font-semibold">#{channelId}</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Nachrichten — implementiert in Task 9
      </div>
    </div>
  )
}

export function Chat() {
  const { user } = useAuth()
  const socketRef = useSocket()
  const { channels, setChannels, activeChannelId, setActiveChannel } = useChat(socketRef)

  useEffect(() => {
    if (user) subscribePush().catch(() => {})
  }, [user])

  function handleChannelCreated(ch: Channel) {
    setChannels(prev => [...prev, ch])
    setActiveChannel(ch.id)
  }

  return (
    <PageShell title="Chat">
      <div className="flex h-full -mx-4 -mt-4">
        <div className={`w-full md:w-72 md:block border-r border-white/10 ${activeChannelId ? 'hidden md:block' : 'block'}`}>
          <ChannelList
            channels={channels}
            activeChannelId={activeChannelId}
            onSelect={setActiveChannel}
            onChannelCreated={handleChannelCreated}
          />
        </div>
        <div className={`flex-1 flex flex-col ${activeChannelId ? 'block' : 'hidden md:flex'}`}>
          {activeChannelId
            ? <MessageViewPlaceholder channelId={activeChannelId} onBack={() => setActiveChannel(null)} />
            : <EmptyState />
          }
        </div>
      </div>
    </PageShell>
  )
}
