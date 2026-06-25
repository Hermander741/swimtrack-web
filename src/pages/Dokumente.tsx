import { useContext, useRef, useState } from 'react'
import { FileText, Trash2, Download, FilePlus } from 'lucide-react'
import { StoreContext } from '../App'
import { Card } from '../components/Card'
import type { PDFDocument } from '../types'
import { generateId } from '../utils/format'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function Dokumente() {
  const store = useContext(StoreContext)!
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<PDFDocument | null>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.type !== 'application/pdf') return
      const reader = new FileReader()
      reader.onload = () => {
        store.addPDF({
          id: generateId(),
          name: file.name.replace('.pdf', ''),
          uploadedAt: new Date().toISOString(),
          size: file.size,
          dataUrl: reader.result as string,
        })
      }
      reader.readAsDataURL(file)
    })
  }

  if (preview) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 safe-top">
          <button onClick={() => setPreview(null)} className="text-sky-400 font-medium text-sm">← Zurück</button>
          <p className="flex-1 text-white text-sm font-medium truncate">{preview.name}</p>
          <a href={preview.dataUrl} download={`${preview.name}.pdf`} className="text-slate-400">
            <Download size={18} />
          </a>
        </div>
        <iframe
          src={preview.dataUrl}
          className="flex-1 w-full border-0"
          title={preview.name}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 pb-24">
      <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-white font-bold text-2xl">Ausschreibungen</h1>
          <p className="text-slate-400 text-sm">{store.pdfs.length} Dokument{store.pdfs.length !== 1 ? 'e' : ''} gespeichert</p>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInput.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          className={`relative border-2 border-dashed rounded-2xl p-8 mb-6 text-center cursor-pointer transition-all ${
            dragging
              ? 'border-sky-400 bg-sky-400/10'
              : 'border-slate-700 hover:border-sky-500/50 hover:bg-slate-800/30'
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <div className="w-14 h-14 bg-sky-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FilePlus size={28} className="text-sky-400" />
          </div>
          <p className="text-white font-semibold mb-1">PDF hochladen</p>
          <p className="text-slate-500 text-sm">Ausschreibungen, Startlisten, Ergebnislisten</p>
          <p className="text-slate-600 text-xs mt-2">Tippen zum Auswählen oder PDF hierher ziehen</p>
        </div>

        {/* Document list */}
        {store.pdfs.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine Dokumente</p>
          </div>
        ) : (
          <div className="space-y-2">
            {store.pdfs.map(doc => (
              <Card
                key={doc.id}
                onClick={() => setPreview(doc)}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <div className="w-10 h-10 bg-rose-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-slate-500 text-xs">{formatSize(doc.size)} · {formatUploadDate(doc.uploadedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={doc.dataUrl}
                    download={`${doc.name}.pdf`}
                    onClick={e => e.stopPropagation()}
                    className="text-slate-500 hover:text-sky-400 transition-colors p-1"
                  >
                    <Download size={15} />
                  </a>
                  <button
                    onClick={e => { e.stopPropagation(); store.removePDF(doc.id) }}
                    className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-xs leading-relaxed">
            <span className="text-slate-300 font-medium">Tipp:</span> Speichere Ausschreibungen (Wettkampf­einladungen) direkt auf deinem Gerät — auch offline verfügbar.
            PDFs werden lokal im Browser gespeichert.
          </p>
        </div>
      </div>
    </div>
  )
}
