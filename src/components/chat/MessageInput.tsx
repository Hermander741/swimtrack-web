import { useState, useRef, useEffect } from 'react'
import type { Message } from '../../types'
import { uploadAttachment } from '../../api/chat'

interface Props {
  channelId: string
  replyTo: Message | null
  onCancelReply: () => void
  onSend: (content: string, replyTo?: string, attachmentIds?: string[]) => void
  onTypingStart: () => void
  onTypingStop: () => void
}

interface PendingAttachment {
  file: File
  attachmentId: string | null
  error: string | null
  uploading: boolean
}

export function MessageInput({ channelId, replyTo, onCancelReply, onSend, onTypingStart, onTypingStop }: Props) {
  const [content, setContent] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTyping = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [content])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      return
    }
    const now = Date.now()
    if (now - lastTyping.current > 2000) {
      onTypingStart()
      lastTyping.current = now
    }
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => onTypingStop(), 3000)
  }

  function handleSend() {
    const text = content.trim()
    const readyIds = pending.filter(p => p.attachmentId).map(p => p.attachmentId!)
    if (!text && readyIds.length === 0) return
    onSend(text, replyTo?.id, readyIds)
    setContent('')
    setPending([])
    onCancelReply()
    if (typingTimer.current) clearTimeout(typingTimer.current)
    onTypingStop()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const file of files) {
      const placeholder: PendingAttachment = { file, attachmentId: null, error: null, uploading: true }
      setPending(prev => [...prev, placeholder])
      const res = await uploadAttachment(channelId, file)
      setPending(prev => prev.map(p =>
        p.file === file
          ? res.ok
            ? { ...p, attachmentId: res.data.attachmentId, uploading: false }
            : { ...p, error: res.error, uploading: false }
          : p,
      ))
    }
  }

  function removeAttachment(file: File) {
    setPending(prev => prev.filter(p => p.file !== file))
  }

  return (
    <div className="border-t border-white/10 px-4 py-3 space-y-2">
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border-l-2 border-teal-500">
          <div className="flex-1 min-w-0">
            <p className="text-teal-400 text-xs">{replyTo.sender_name}</p>
            <p className="text-slate-300 text-xs truncate">{replyTo.content ?? '📎 Anhang'}</p>
          </div>
          <button onClick={onCancelReply} className="text-slate-400 hover:text-white text-sm">✕</button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map(p => (
            <div key={p.file.name} className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-sm">
              <span className="text-white truncate max-w-32">{p.file.name}</span>
              {p.uploading && <span className="text-slate-400">…</span>}
              {p.error && <span className="text-red-400 text-xs">{p.error}</span>}
              {p.attachmentId && <span className="text-teal-400">✓</span>}
              <button onClick={() => removeAttachment(p.file)} className="text-slate-500 hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,video/mp4,video/quicktime,application/pdf"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-slate-400 hover:text-teal-400 text-xl transition-colors mb-1"
        >
          📎
        </button>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht schreiben…"
          rows={1}
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500/50 resize-none overflow-hidden"
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() && pending.filter(p => p.attachmentId).length === 0}
          className="mb-1 w-10 h-10 rounded-full bg-teal-500 hover:bg-teal-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
