import { useState, useEffect, useRef } from 'react'
import { Eye, Download, X as XIcon } from 'lucide-react'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { listDocuments, uploadDocument, deleteDocument, documentFileUrl } from '../api/documents'
import { getAccessToken } from '../api/client'
import type { Document } from '../types'

type Category = 'alle' | 'anmeldeformular' | 'vereinsdokument' | 'sonstiges'

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'anmeldeformular', label: 'Anmeldeformulare' },
  { key: 'vereinsdokument', label: 'Vereinsdokumente' },
  { key: 'sonstiges', label: 'Sonstiges' },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function Dokumente() {
  const { isTrainer, isAdmin, user } = useAuth()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<Category>('alle')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState<Exclude<Category, 'alle'>>('vereinsdokument')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (cat: Category) => {
    setLoading(true)
    listDocuments(cat === 'alle' ? undefined : cat).then(res => {
      if (res.ok) setDocs(res.data)
      setLoading(false)
    })
  }

  useEffect(() => { load(activeCategory) }, [activeCategory])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) { setUploadError('Bitte eine PDF-Datei auswählen'); return }
    setUploadError('')
    setUploadLoading(true)
    const res = await uploadDocument(uploadName, uploadCategory as string, uploadFile)
    setUploadLoading(false)
    if (res.ok) {
      setShowUpload(false)
      setUploadName(''); setUploadFile(null); setUploadCategory('vereinsdokument')
      load(activeCategory)
    } else {
      setUploadError((res as { ok: false; error: string }).error)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" wirklich löschen?`)) return
    const res = await deleteDocument(id)
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== id))
  }

  async function fetchBlob(doc: Document): Promise<Blob | null> {
    const token = getAccessToken()
    const r = await fetch(documentFileUrl(doc.id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!r.ok) return null
    return r.blob()
  }

  async function openDoc(doc: Document) {
    const blob = await fetchBlob(doc)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function downloadDoc(doc: Document) {
    const blob = await fetchBlob(doc)
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = doc.name + '.pdf'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  return (
    <PageShell
      title="Dokumente"
      fab={isTrainer ? (
        <button
          onClick={() => setShowUpload(true)}
          className="w-14 h-14 bg-gradient-to-r from-teal-500 to-sky-500 rounded-full flex items-center justify-center text-2xl text-white shadow-lg shadow-teal-500/30 active:scale-95 transition-transform"
        >
          +
        </button>
      ) : undefined}
    >
      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 -mx-4 px-4 mb-4">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${activeCategory === key ? 'bg-teal-500 text-white' : 'glass text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <Card key={doc.id}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400 shrink-0">
                  📄
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{doc.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {formatBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString('de-AT')}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openDoc(doc)}
                    className="w-9 h-9 glass rounded-lg flex items-center justify-center text-teal-400 active:scale-95 transition-transform"
                    aria-label="Öffnen"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => downloadDoc(doc)}
                    className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 active:scale-95 transition-transform"
                    aria-label="Herunterladen"
                  >
                    <Download size={16} />
                  </button>
                  {(isAdmin || (isTrainer && doc.uploaded_by === user?.id)) && (
                    <button
                      onClick={() => handleDelete(doc.id, doc.name)}
                      className="w-9 h-9 glass rounded-lg flex items-center justify-center text-red-400 active:scale-95 transition-transform"
                      aria-label="Löschen"
                    >
                      <XIcon size={16} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {docs.length === 0 && (
            <p className="text-slate-400 text-center py-8">Keine Dokumente vorhanden</p>
          )}
        </div>
      )}

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Dokument hochladen">
        <form onSubmit={handleUpload} className="space-y-4">
          <Input label="Name" value={uploadName} onChange={e => setUploadName(e.target.value)} required />
          <div>
            <label className="block text-xs text-slate-400 mb-2">Kategorie</label>
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIES.filter(c => c.key !== 'alle').map(({ key, label }) => (
                <button
                  key={key} type="button"
                  onClick={() => setUploadCategory(key as Exclude<Category, 'alle'>)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border text-left
                    ${uploadCategory === key ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'glass text-slate-400 border-white/5'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full glass rounded-xl px-4 py-3 text-sm text-left transition-all hover:bg-white/5"
            >
              {uploadFile ? (
                <span className="text-teal-400">{uploadFile.name}</span>
              ) : (
                <span className="text-slate-400">PDF-Datei auswählen...</span>
              )}
            </button>
          </div>
          {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
          <Button type="submit" loading={uploadLoading} className="w-full">Hochladen</Button>
        </form>
      </Modal>
    </PageShell>
  )
}
