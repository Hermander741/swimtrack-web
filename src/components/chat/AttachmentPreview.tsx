import { useState, useRef, useEffect } from 'react'
import type { MessageAttachment } from '../../types'
import { downloadAttachment } from '../../api/chat'

interface Props { attachment: MessageAttachment }

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export function AttachmentPreview({ attachment }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const revokeTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const isImage = attachment.mime_type.startsWith('image/')
  const isVideo = attachment.mime_type.startsWith('video/')

  useEffect(() => {
    return () => { revokeTimers.current.forEach(clearTimeout) }
  }, [])

  async function handleDownload() {
    setLoading(true)
    try {
      const url = await downloadAttachment(attachment.id)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.original_name
      a.click()
      const t = setTimeout(() => URL.revokeObjectURL(url), 5000)
      revokeTimers.current.push(t)
    } catch {
      console.error('Failed to download attachment')
    } finally {
      setLoading(false)
    }
  }

  async function loadMedia() {
    if (blobUrl) return
    setLoading(true)
    try {
      const url = await downloadAttachment(attachment.id)
      setBlobUrl(url)
    } catch {
      console.error('Failed to load media')
    } finally {
      setLoading(false)
    }
  }

  if (isImage) {
    return (
      <div className="mt-2 max-w-xs">
        {blobUrl ? (
          <img
            src={blobUrl}
            alt={attachment.original_name}
            className="rounded-xl max-h-64 object-cover cursor-pointer"
            onClick={() => window.open(blobUrl)}
          />
        ) : (
          <button
            onClick={loadMedia}
            className="w-40 h-28 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 text-sm"
          >
            {loading ? '…' : '📷 Bild laden'}
          </button>
        )}
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className="mt-2 max-w-xs">
        {blobUrl ? (
          <video src={blobUrl} controls className="rounded-xl max-h-64 w-full" />
        ) : (
          <button
            onClick={loadMedia}
            className="w-40 h-28 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 text-sm"
          >
            {loading ? '…' : '🎬 Video laden'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 max-w-xs">
      <span className="text-2xl">📄</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{attachment.original_name}</p>
        <p className="text-slate-400 text-xs">{formatBytes(attachment.size_bytes)}</p>
      </div>
      <button onClick={handleDownload} disabled={loading} className="text-teal-400 text-sm shrink-0">
        {loading ? '…' : '↓'}
      </button>
    </div>
  )
}
