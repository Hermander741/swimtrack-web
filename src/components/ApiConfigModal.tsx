import { useState } from 'react'
import { Modal } from './Modal'
import { useApi } from '../hooks/useApi'
import { Wifi, WifiOff, Check } from 'lucide-react'

interface ApiConfigModalProps {
  open: boolean
  onClose: () => void
}

export function ApiConfigModal({ open, onClose }: ApiConfigModalProps) {
  const api = useApi()
  const [url, setUrl] = useState(api.baseUrl() ?? '')
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function testConnection(testUrl: string) {
    setStatus('testing')
    setErrorMsg('')
    try {
      const res = await fetch(`${testUrl.trim().replace(/\/$/, '')}/health`)
      const json = await res.json() as { ok?: boolean }
      if (json.ok) {
        setStatus('ok')
      } else {
        setStatus('error')
        setErrorMsg('Server antwortet, aber meldet Fehler')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Verbindung fehlgeschlagen — prüfe URL und Tailscale')
    }
  }

  function save() {
    api.saveUrl(url)
    onClose()
    window.location.reload()
  }

  return (
    <Modal open={open} onClose={onClose} title="Backend verbinden">
      <div className="space-y-4">
        <p className="text-slate-400 text-sm">
          Gib die URL deines Mac Mini Backends ein (erreichbar via Tailscale).
        </p>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Backend URL</label>
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setStatus('idle') }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:border-sky-500 outline-none"
            placeholder="http://100.x.x.x:3001"
          />
        </div>
        <button
          type="button"
          onClick={() => testConnection(url)}
          disabled={!url || status === 'testing'}
          className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {status === 'testing' ? (
            <span className="animate-pulse">Verbindung testen…</span>
          ) : status === 'ok' ? (
            <><Check size={14} className="text-emerald-400" /> Verbindung OK</>
          ) : status === 'error' ? (
            <><WifiOff size={14} className="text-rose-400" /> {errorMsg}</>
          ) : (
            <><Wifi size={14} /> Verbindung testen</>
          )}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!url}
          className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Speichern
        </button>
      </div>
    </Modal>
  )
}
